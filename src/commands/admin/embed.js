const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder,
    ChannelType
} = require('discord.js');
const db = require('../../database');

// ─── Helpers ────────────────────────────────────────────────────────────────

function stepBar(current, total) {
    const filled = '█'.repeat(current);
    const empty  = '░'.repeat(total - current);
    return `\`${filled}${empty}\` Étape ${current}/${total}`;
}

function buildNavRow(step, totalSteps, extras = []) {
    const row = new ActionRowBuilder();
    if (step > 1)          row.addComponents(new ButtonBuilder().setCustomId('prev').setLabel('◀ Précédent').setStyle(ButtonStyle.Secondary));
    if (extras.length)     row.addComponents(...extras);
    if (step < totalSteps) row.addComponents(new ButtonBuilder().setCustomId('next').setLabel('Suivant ▶').setStyle(ButtonStyle.Primary));
    if (step === totalSteps) row.addComponents(new ButtonBuilder().setCustomId('publish').setLabel('🚀 Publier').setStyle(ButtonStyle.Success));
    return row;
}

const TOTAL_STEPS = 5;
const STEP_LABELS = ['', 'Titre & Description', 'Couleur', 'Image', 'Boutons', 'Salon & Publication'];

// ─── Render de chaque étape ──────────────────────────────────────────────────

function renderStep(step, state) {
    const preview = new EmbedBuilder().setColor(state.color || '#5865f2');
    if (state.title)       preview.setTitle(state.title);
    if (state.description) preview.setDescription(state.description);
    if (state.imageURL)    preview.setImage(state.imageURL);
    if (state.thumbnailURL) preview.setThumbnail(state.thumbnailURL);

    let content = `**🛠️ Constructeur d'Embed — ${STEP_LABELS[step]}**\n${stepBar(step, TOTAL_STEPS)}\n\n`;

    const components = [];

    if (step === 1) {
        content += `📝 **Titre :** ${state.title || '*non défini*'}\n📄 **Description :** ${state.description ? state.description.slice(0, 80) + (state.description.length > 80 ? '…' : '') : '*non définie*'}`;
        const editRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('edit_title_desc').setLabel('✏️ Modifier Titre & Description').setStyle(ButtonStyle.Primary)
        );
        components.push(editRow, buildNavRow(step, TOTAL_STEPS));
    }

    else if (step === 2) {
        content += `🎨 **Couleur actuelle :** ${state.color || '#5865f2'}`;
        const editRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('edit_color').setLabel('🎨 Choisir une couleur').setStyle(ButtonStyle.Primary)
        );
        components.push(editRow, buildNavRow(step, TOTAL_STEPS));
    }

    else if (step === 3) {
        content += `🖼️ **Image principale :** ${state.imageURL || '*aucune*'}\n🖼️ **Miniature :** ${state.thumbnailURL || '*aucune*'}`;
        const editRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('edit_image').setLabel('🖼️ Définir image / miniature').setStyle(ButtonStyle.Primary)
        );
        components.push(editRow, buildNavRow(step, TOTAL_STEPS));
    }

    else if (step === 4) {
        const btnCount = state.buttons.length;
        content += `🔘 **Boutons configurés : ${btnCount}/5**\n`;
        state.buttons.forEach((b, idx) => {
            content += `\n**${idx + 1}.** \`${b.label}\` — type: \`${b.type}\`${b.text ? ` | texte avant: *${b.text.slice(0,30)}*` : ''}`;
        });
        if (!btnCount) content += '\n*Aucun bouton ajouté*';

        const addRow = new ActionRowBuilder();
        if (btnCount < 5) addRow.addComponents(new ButtonBuilder().setCustomId('add_btn').setLabel('➕ Ajouter un bouton').setStyle(ButtonStyle.Success));
        if (btnCount > 0) addRow.addComponents(new ButtonBuilder().setCustomId('remove_btn').setLabel('🗑️ Supprimer le dernier').setStyle(ButtonStyle.Danger));
        components.push(addRow, buildNavRow(step, TOTAL_STEPS));
    }

    else if (step === 5) {
        content += `📢 **Salon cible :** ${state.channelId ? `<#${state.channelId}>` : '*non sélectionné*'}\n\nVérifiez l'aperçu ci-dessous puis publiez.`;
        const chanRow = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('pick_channel')
                .setPlaceholder('Choisir le salon de publication')
                .addChannelTypes(ChannelType.GuildText)
        );
        components.push(chanRow, buildNavRow(step, TOTAL_STEPS));
    }

    return { content, embeds: [preview], components, ephemeral: true };
}

// ─── Commande principale ─────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Créer un embed interactif étape par étape'),

    async execute(interaction) {
        const state = {
            step: 1,
            title: '',
            description: '',
            color: '#5865f2',
            imageURL: '',
            thumbnailURL: '',
            buttons: [],   // { id, label, type, data, text, align }
            channelId: null
        };

        const msg = await interaction.reply({ ...renderStep(1, state), fetchReply: true });
        const collector = msg.createMessageComponentCollector({ time: 900000 });

        collector.on('collect', async i => {
            // Navigation
            if (i.customId === 'next') {
                state.step = Math.min(state.step + 1, TOTAL_STEPS);
                return i.update(renderStep(state.step, state));
            }
            if (i.customId === 'prev') {
                state.step = Math.max(state.step - 1, 1);
                return i.update(renderStep(state.step, state));
            }

            // Étape 1 — Titre & Description
            if (i.customId === 'edit_title_desc') {
                const modal = new ModalBuilder().setCustomId('m_title_desc').setTitle('Titre & Description');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('title').setLabel('Titre (optionnel)').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.title)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(state.description)
                    )
                );
                await i.showModal(modal);
                try {
                    const s = await i.awaitModalSubmit({ time: 120000 });
                    state.title       = s.fields.getTextInputValue('title') || '';
                    state.description = s.fields.getTextInputValue('desc');
                    await s.update(renderStep(state.step, state));
                } catch {}
                return;
            }

            // Étape 2 — Couleur
            if (i.customId === 'edit_color') {
                const modal = new ModalBuilder().setCustomId('m_color').setTitle('Couleur Hex');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('color').setLabel('Code couleur hexadécimal (ex: #ff0000)').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.color)
                    )
                );
                await i.showModal(modal);
                try {
                    const s = await i.awaitModalSubmit({ time: 60000 });
                    const val = s.fields.getTextInputValue('color').trim();
                    state.color = val.startsWith('#') ? val : `#${val}`;
                    await s.update(renderStep(state.step, state));
                } catch {}
                return;
            }

            // Étape 3 — Image
            if (i.customId === 'edit_image') {
                const modal = new ModalBuilder().setCustomId('m_image').setTitle('Images');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('img').setLabel('URL image principale (optionnel)').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.imageURL)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('thumb').setLabel('URL miniature (optionnel)').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.thumbnailURL)
                    )
                );
                await i.showModal(modal);
                try {
                    const s = await i.awaitModalSubmit({ time: 60000 });
                    state.imageURL     = s.fields.getTextInputValue('img').trim();
                    state.thumbnailURL = s.fields.getTextInputValue('thumb').trim();
                    await s.update(renderStep(state.step, state));
                } catch {}
                return;
            }

            // Étape 4 — Ajouter bouton
            if (i.customId === 'add_btn') {
                const modal = new ModalBuilder().setCustomId('m_btn').setTitle('Configurer le bouton');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('label').setLabel('Texte du bouton').setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('type').setLabel('Type : link / mp / eph / ticket').setStyle(TextInputStyle.Short).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('data').setLabel('URL ou contenu (selon le type)').setStyle(TextInputStyle.Short).setRequired(false)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('text').setLabel('Texte affiché À CÔTÉ du bouton (optionnel)').setStyle(TextInputStyle.Short).setRequired(false)
                    )
                );
                await i.showModal(modal);
                try {
                    const s = await i.awaitModalSubmit({ time: 120000 });
                    state.buttons.push({
                        id:    `btn_${Date.now()}`,
                        label: s.fields.getTextInputValue('label'),
                        type:  s.fields.getTextInputValue('type').toLowerCase().trim(),
                        data:  s.fields.getTextInputValue('data').trim(),
                        text:  s.fields.getTextInputValue('text').trim()
                    });
                    await s.update(renderStep(state.step, state));
                } catch {}
                return;
            }

            // Étape 4 — Supprimer dernier bouton
            if (i.customId === 'remove_btn') {
                state.buttons.pop();
                return i.update(renderStep(state.step, state));
            }

            // Étape 5 — Choisir salon
            if (i.customId === 'pick_channel') {
                state.channelId = i.values[0];
                return i.update(renderStep(state.step, state));
            }

            // Publication
            if (i.customId === 'publish') {
                if (!state.channelId) {
                    return i.reply({ content: '❌ Sélectionne d\'abord un salon.', ephemeral: true });
                }

                const targetChannel = interaction.guild.channels.cache.get(state.channelId);
                if (!targetChannel) return i.reply({ content: '❌ Salon introuvable.', ephemeral: true });

                const finalEmbed = new EmbedBuilder().setColor(state.color);
                if (state.title)        finalEmbed.setTitle(state.title);
                if (state.description)  finalEmbed.setDescription(state.description);
                if (state.imageURL)     finalEmbed.setImage(state.imageURL);
                if (state.thumbnailURL) finalEmbed.setThumbnail(state.thumbnailURL);

                // Construction des composants
                const finalComponents = [];
                for (const btn of state.buttons) {
                    const row = new ActionRowBuilder();

                    // Texte à côté = bouton désactivé fantôme avant le vrai bouton
                    if (btn.text) {
                        row.addComponents(
                            new ButtonBuilder().setCustomId(`ghost_${Math.random().toString(36).slice(2)}`).setLabel(btn.text).setStyle(ButtonStyle.Secondary).setDisabled(true)
                        );
                    }

                    const actualBtn = new ButtonBuilder().setLabel(btn.label);
                    if (btn.type === 'link') {
                        actualBtn.setStyle(ButtonStyle.Link).setURL(btn.data || 'https://discord.com');
                    } else {
                        actualBtn.setStyle(ButtonStyle.Primary).setCustomId(btn.id);
                        const mapType = btn.type === 'eph' ? 'ephemeral' : btn.type;
                        db.prepare('INSERT OR REPLACE INTO custom_buttons (custom_id, action_type, action_data, guild_id) VALUES (?, ?, ?, ?)')
                          .run(btn.id, mapType, btn.data, interaction.guild.id);
                    }
                    row.addComponents(actualBtn);
                    finalComponents.push(row);
                }

                await targetChannel.send({ embeds: [finalEmbed], components: finalComponents });
                await i.update({ content: `✅ Embed publié dans <#${state.channelId}> !`, embeds: [], components: [] });
                collector.stop();
            }
        });
    }
};
