const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../../database');

function stepBar(current, total) {
    const filled = '█'.repeat(current);
    const empty  = '░'.repeat(total - current);
    return `\`${filled}${empty}\` Étape ${current}/${total}`;
}

const TOTAL_STEPS = 5;
const STEP_LABELS = ['', 'Titre & Description', 'Couleur', 'Image', 'Boutons', 'Salon & Publication'];

function buildNavRow(step) {
    const row = new ActionRowBuilder();
    if (step > 1) row.addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('◀ Précédent').setStyle(ButtonStyle.Secondary)
    );
    if (step < TOTAL_STEPS) row.addComponents(
        new ButtonBuilder().setCustomId('next').setLabel('Suivant ▶').setStyle(ButtonStyle.Primary)
    );
    if (step === TOTAL_STEPS) row.addComponents(
        new ButtonBuilder().setCustomId('publish').setLabel('🚀 Publier').setStyle(ButtonStyle.Success)
    );
    return row;
}

function renderStep(step, state) {
    const preview = new EmbedBuilder().setColor(state.color || '#5865f2');
    if (state.title)        preview.setTitle(state.title);
    if (state.description)  preview.setDescription(state.description);
    if (state.imageURL)     preview.setImage(state.imageURL);
    if (state.thumbnailURL) preview.setThumbnail(state.thumbnailURL);

    let content = `**🛠️ Constructeur d'Embed — ${STEP_LABELS[step]}**\n${stepBar(step, TOTAL_STEPS)}\n\n`;
    const components = [];

    if (step === 1) {
        content += `📝 **Titre :** ${state.title || '*non défini*'}\n📄 **Description :** ${state.description ? state.description.slice(0, 80) + (state.description.length > 80 ? '…' : '') : '*non définie*'}`;
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('edit_title_desc').setLabel('✏️ Modifier Titre & Description').setStyle(ButtonStyle.Primary)
            ),
            buildNavRow(step)
        );
    }
    else if (step === 2) {
        content += `🎨 **Couleur actuelle :** ${state.color || '#5865f2'}`;
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('edit_color').setLabel('🎨 Choisir une couleur').setStyle(ButtonStyle.Primary)
            ),
            buildNavRow(step)
        );
    }
    else if (step === 3) {
        content += `🖼️ **Image principale :** ${state.imageURL || '*aucune*'}\n🖼️ **Miniature :** ${state.thumbnailURL || '*aucune*'}`;
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('edit_image').setLabel('🖼️ Définir image / miniature').setStyle(ButtonStyle.Primary)
            ),
            buildNavRow(step)
        );
    }
    else if (step === 4) {
        const btnCount = state.buttons.length;
        content += `🔘 **Boutons configurés : ${btnCount}/5**\n`;
        state.buttons.forEach((b, idx) => {
            content += `\n**${idx + 1}.** \`${b.label}\` — type: \`${b.type}\`${b.text ? ` | texte à côté: *${b.text.slice(0, 30)}*` : ''}`;
        });
        if (!btnCount) content += '\n*Aucun bouton ajouté*';

        const addRow = new ActionRowBuilder();
        if (btnCount < 5) addRow.addComponents(
            new ButtonBuilder().setCustomId('add_btn').setLabel('➕ Ajouter un bouton').setStyle(ButtonStyle.Success)
        );
        if (btnCount > 0) addRow.addComponents(
            new ButtonBuilder().setCustomId('remove_btn').setLabel('🗑️ Supprimer le dernier').setStyle(ButtonStyle.Danger)
        );
        components.push(addRow, buildNavRow(step));
    }
    else if (step === 5) {
        content += `📢 **Salon cible :** ${state.channelId ? `<#${state.channelId}>` : '*non sélectionné*'}\n\nVérifiez l'aperçu ci-dessous puis publiez.`;
        components.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pick_channel').setLabel('📢 Choisir le salon').setStyle(ButtonStyle.Primary)
            ),
            buildNavRow(step)
        );
    }

    return { content, embeds: [preview], components, ephemeral: true };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Créer un embed interactif étape par étape'),

    async execute(interaction) {
        const state = {
            step: 1,
            title: '', description: '', color: '#5865f2',
            imageURL: '', thumbnailURL: '',
            buttons: [], channelId: null
        };

        const msg = await interaction.reply({ ...renderStep(1, state), fetchReply: true });
        const collector = msg.createMessageComponentCollector({ time: 900000 });

        collector.on('collect', async i => {

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
                } catch (e) { console.error('modal title_desc:', e); }
                return;
            }

            // Étape 2 — Couleur
            if (i.customId === 'edit_color') {
                const modal = new ModalBuilder().setCustomId('m_color').setTitle('Couleur Hex');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('color').setLabel('Code hex (ex: #ff0000)').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.color)
                    )
                );
                await i.showModal(modal);
                try {
                    const s = await i.awaitModalSubmit({ time: 60000 });
                    const val = s.fields.getTextInputValue('color').trim();
                    state.color = val.startsWith('#') ? val : `#${val}`;
                    await s.update(renderStep(state.step, state));
                } catch (e) { console.error('modal color:', e); }
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
                } catch (e) { console.error('modal image:', e); }
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
                        new TextInputBuilder().setCustomId('text').setLabel('Texte affiché à côté du bouton (optionnel)').setStyle(TextInputStyle.Short).setRequired(false)
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
                } catch (e) { console.error('modal btn:', e); }
                return;
            }

            // Étape 4 — Supprimer dernier bouton
            if (i.customId === 'remove_btn') {
                state.buttons.pop();
                return i.update(renderStep(state.step, state));
            }

            // Étape 5 — Choisir salon via modal
            if (i.customId === 'pick_channel') {
                const modal = new ModalBuilder().setCustomId('m_channel').setTitle('Salon de publication');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('channel_id').setLabel('ID du salon (clic droit → Copier l\'ID)').setStyle(TextInputStyle.Short).setRequired(true)
                    )
                );
                await i.showModal(modal);
                try {
                    const s = await i.awaitModalSubmit({ time: 60000 });
                    state.channelId = s.fields.getTextInputValue('channel_id').trim();
                    await s.update(renderStep(state.step, state));
                } catch (e) { console.error('modal channel:', e); }
                return;
            }

            // Publication
            if (i.customId === 'publish') {
                if (!state.channelId) {
                    return i.reply({ content: '❌ Sélectionne d\'abord un salon.', ephemeral: true });
                }

                const targetChannel = interaction.guild.channels.cache.get(state.channelId);
                if (!targetChannel) {
                    return i.reply({ content: '❌ Salon introuvable. Vérifie l\'ID.', ephemeral: true });
                }

                const finalEmbed = new EmbedBuilder().setColor(state.color);
                if (state.title)        finalEmbed.setTitle(state.title);
                if (state.description)  finalEmbed.setDescription(state.description);
                if (state.imageURL)     finalEmbed.setImage(state.imageURL);
                if (state.thumbnailURL) finalEmbed.setThumbnail(state.thumbnailURL);

                const finalComponents = [];
                for (const btn of state.buttons) {
                    const row = new ActionRowBuilder();
                    if (btn.text) {
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`ghost_${Math.random().toString(36).slice(2)}`)
                                .setLabel(btn.text)
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
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
