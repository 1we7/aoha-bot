const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
    ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType
} = require('discord.js');
const db = require('../../database');

function buildButtonRows(buttons, disableForPreview = false) {
    const rows = [];
    let currentOutsideRow = new ActionRowBuilder();

    for (const btn of buttons) {
        const actualBtn = new ButtonBuilder()
            .setCustomId(btn.type === 'link' ? undefined : (disableForPreview ? `prev_${btn.id}` : btn.id))
            .setLabel(btn.label || 'Bouton')
            .setStyle(btn.style || ButtonStyle.Primary);
            
        if (btn.emoji) actualBtn.setEmoji(btn.emoji);
        if (btn.type === 'link') actualBtn.setURL(btn.data || 'https://discord.com');
        if (disableForPreview) actualBtn.setDisabled(true);

        if (btn.layout === 'left' || btn.layout === 'right') {
            const ghostBtn = new ButtonBuilder()
                .setCustomId(`ghost_${Math.random().toString(36).slice(2)}`)
                .setLabel(btn.ghostText || ' ')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const mixedRow = new ActionRowBuilder();
            if (btn.layout === 'left') mixedRow.addComponents(ghostBtn, actualBtn);
            if (btn.layout === 'right') mixedRow.addComponents(actualBtn, ghostBtn);
            
            rows.push(mixedRow);
        } else {
            currentOutsideRow.addComponents(actualBtn);
            if (currentOutsideRow.components.length === 5) {
                rows.push(currentOutsideRow);
                currentOutsideRow = new ActionRowBuilder();
            }
        }
    }
    if (currentOutsideRow.components.length > 0) rows.push(currentOutsideRow);
    return rows;
}

function renderMain(state) {
    const embed = new EmbedBuilder().setColor(state.color || '#2b2d31');
    if (state.title) embed.setTitle(state.title);
    embed.setDescription(state.description || '*Description vide...*');
    if (state.imageURL) embed.setImage(state.imageURL);
    if (state.thumbnailURL) embed.setThumbnail(state.thumbnailURL);

    const rowMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('main_menu').setPlaceholder('✏️ Modifier l\'Embed...').addOptions(
            { label: 'Titre', value: 'edit_title', emoji: '📝' },
            { label: 'Description', value: 'edit_desc', emoji: '📄' },
            { label: 'Couleur', value: 'edit_color', emoji: '🎨' },
            { label: 'Images', value: 'edit_images', emoji: '🖼️' },
            { label: 'Importer JSON (Components V2)', value: 'import_json', emoji: '📥', description: 'Importe Embed + Boutons' }
        )
    );

    const rowActions = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('go_add_btn').setLabel('➕ Ajouter un Bouton').setStyle(ButtonStyle.Success).setDisabled(state.buttons.length >= 5),
        new ButtonBuilder().setCustomId('remove_btn').setLabel('🗑️ Suppr. Dernier').setStyle(ButtonStyle.Danger).setDisabled(state.buttons.length === 0),
        new ButtonBuilder().setCustomId('publish').setLabel('🚀 Publier').setStyle(ButtonStyle.Primary).setDisabled(!state.description || !state.channelId)
    );

    const rowChannel = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder(state.channelId ? '✅ Salon sélectionné (clique pour changer)' : '📢 Choisir le salon d\'envoi').setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    );

    const userButtonRows = buildButtonRows(state.buttons, true);

    const finalComponents = [rowMenu, rowActions, rowChannel];
    for (let i = 0; i < userButtonRows.length && finalComponents.length < 5; i++) {
        finalComponents.push(userButtonRows[i]);
    }

    return { content: '**🛠️ Aoha Embed Builder V2**', embeds: [embed], components: finalComponents };
}

function renderBtnBuilder(state) {
    const btn = state.draftBtn;
    
    // Rendu visuel de l'emoji pour l'aperçu
    const emojiPreview = btn.emoji ? `${btn.emoji} ` : '';
    
    const embed = new EmbedBuilder().setColor('#2b2d31').setTitle('⚙️ Configuration du Bouton')
        .setDescription(`**Aperçu actuel :**\n\n` +
            `**Nom :** ${emojiPreview}${btn.label}\n**Type :** ${btn.type || '⚠️ Non défini'}\n` +
            `**Disposition :** ${btn.layout}\n**Texte fantôme :** ${btn.ghostText || '*Aucun*'}`);

    const typeMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('btn_type').setPlaceholder('1️⃣ Choisir le Type d\'action').addOptions(
            { label: 'Lien Web', value: 'link' }, { label: 'Message Éphémère', value: 'eph' },
            { label: 'Message Privé (MP)', value: 'mp' }, { label: 'Créer un Ticket', value: 'ticket' }
        )
    );

    // Bouton rotatif pour le layout (Remplace le menu déroulant pour sauver 1 ligne)
    const layoutLabels = { outside: 'Standard', left: 'Texte à Gauche', right: 'Texte à Droite' };
    const btnLayoutToggle = new ButtonBuilder().setCustomId('btn_toggle_layout').setLabel(`🔄 Disp. : ${layoutLabels[btn.layout]}`).setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_edit_name').setLabel('✏️ Nom & Emoji').setStyle(ButtonStyle.Secondary),
        btnLayoutToggle,
        new ButtonBuilder().setCustomId('btn_edit_ghost').setLabel('👻 Texte Layout').setStyle(ButtonStyle.Secondary).setDisabled(btn.layout === 'outside'),
        new ButtonBuilder().setCustomId('btn_edit_data').setLabel('⚙️ Lien / Message').setStyle(ButtonStyle.Primary).setDisabled(btn.type === 'ticket' || !btn.type)
    );

    const components = [typeMenu, actionRow];

    // Ajout des menus Tickets si besoin (2 lignes max)
    if (btn.type === 'ticket') {
        components.push(new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('btn_ticket_role').setPlaceholder('👤 Rôle Staff (Qui peut voir)')));
        components.push(new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('btn_ticket_category').setPlaceholder('📂 Catégorie des tickets').setChannelTypes([ChannelType.GuildCategory])));
    }

    // La ligne de sauvegarde tiendra toujours dans les 5 lignes max !
    const finishRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_save').setLabel('✅ Sauvegarder').setStyle(ButtonStyle.Success).setDisabled(!btn.type || (btn.type === 'ticket' && (!btn.roleId || !btn.categoryId))),
        new ButtonBuilder().setCustomId('btn_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Danger)
    );
    components.push(finishRow);

    return { content: '', embeds: [embed], components: components };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Créer un embed interactif V2 avec composants pour Aoha'),

    async execute(interaction) {
        const state = {
            view: 'main',
            title: '', description: '', color: '#2b2d31', imageURL: '', thumbnailURL: '',
            buttons: [], channelId: null, draftBtn: null
        };

        const msg = await interaction.reply({ ...renderMain(state), ephemeral: true, withResponse: true });
        const collector = msg.resource.message.createMessageComponentCollector({ time: 1800000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            if (state.view === 'main') {
                if (i.isChannelSelectMenu() && i.customId === 'select_channel') {
                    state.channelId = i.values[0];
                    return i.update(renderMain(state));
                }

                if (i.isStringSelectMenu() && i.customId === 'main_menu') {
                    const choice = i.values[0];
                    if (choice === 'edit_title') {
                        const m = new ModalBuilder().setCustomId('m_title').setTitle('Titre');
                        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Titre').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.title)));
                        return i.showModal(m);
                    }
                    if (choice === 'edit_desc') {
                        const m = new ModalBuilder().setCustomId('m_desc').setTitle('Description');
                        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Texte').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(state.description)));
                        return i.showModal(m);
                    }
                    if (choice === 'edit_color') {
                        const m = new ModalBuilder().setCustomId('m_color').setTitle('Couleur');
                        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Hex (#ff0000)').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.color)));
                        return i.showModal(m);
                    }
                    if (choice === 'edit_images') {
                        const m = new ModalBuilder().setCustomId('m_images').setTitle('Images');
                        m.addComponents(
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('img').setLabel('Grande Image URL').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.imageURL)),
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumb').setLabel('Miniature URL').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.thumbnailURL))
                        );
                        return i.showModal(m);
                    }
                    if (choice === 'import_json') {
                        const m = new ModalBuilder().setCustomId('m_json').setTitle('Import Components V2 (Discohook, etc)');
                        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Colle le JSON complet ici').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                        return i.showModal(m);
                    }
                }

                if (i.isButton()) {
                    if (i.customId === 'remove_btn') {
                        state.buttons.pop();
                        return i.update(renderMain(state));
                    }
                    if (i.customId === 'go_add_btn') {
                        state.view = 'btn_builder';
                        state.draftBtn = { id: `btn_${Date.now()}`, label: 'Nouveau Bouton', style: ButtonStyle.Primary, type: null, data: '', emoji: '', roleId: null, categoryId: null, layout: 'outside', ghostText: '' };
                        return i.update(renderBtnBuilder(state));
                    }
                    if (i.customId === 'publish') {
                        const targetChannel = interaction.guild.channels.cache.get(state.channelId);
                        if (!targetChannel) return i.reply({ content: '❌ Salon invalide.', ephemeral: true });

                        const finalEmbed = new EmbedBuilder().setColor(state.color).setDescription(state.description);
                        if (state.title) finalEmbed.setTitle(state.title);
                        if (state.imageURL) finalEmbed.setImage(state.imageURL);
                        if (state.thumbnailURL) finalEmbed.setThumbnail(state.thumbnailURL);

                        const finalComponents = buildButtonRows(state.buttons, false);

                        for (const btn of state.buttons) {
                            if (btn.type !== 'link') {
                                const mapType = btn.type === 'eph' ? 'ephemeral' : btn.type;
                                const dataToSave = btn.type === 'ticket' ? JSON.stringify({ role: btn.roleId, category: btn.categoryId }) : btn.data;
                                db.prepare('INSERT OR REPLACE INTO custom_buttons (custom_id, action_type, action_data, guild_id) VALUES (?, ?, ?, ?)').run(btn.id, mapType, dataToSave, interaction.guild.id);
                            }
                        }

                        await targetChannel.send({ embeds: [finalEmbed], components: finalComponents });
                        collector.stop();
                        return i.update({ content: `✅ Publié dans <#${state.channelId}> !`, embeds: [], components: [] });
                    }
                }
            }

            if (state.view === 'btn_builder') {
                if (i.isStringSelectMenu() && i.customId === 'btn_type') {
                    state.draftBtn.type = i.values[0];
                    return i.update(renderBtnBuilder(state));
                }
                
                if (i.isRoleSelectMenu() && i.customId === 'btn_ticket_role') {
                    state.draftBtn.roleId = i.values[0];
                    return i.update(renderBtnBuilder(state));
                }
                
                if (i.isChannelSelectMenu() && i.customId === 'btn_ticket_category') {
                    state.draftBtn.categoryId = i.values[0];
                    return i.update(renderBtnBuilder(state));
                }

                if (i.isButton()) {
                    if (i.customId === 'btn_toggle_layout') {
                        const next = { outside: 'left', left: 'right', right: 'outside' };
                        state.draftBtn.layout = next[state.draftBtn.layout];
                        return i.update(renderBtnBuilder(state));
                    }
                    if (i.customId === 'btn_cancel') {
                        state.view = 'main';
                        return i.update(renderMain(state));
                    }
                    if (i.customId === 'btn_save') {
                        state.buttons.push(state.draftBtn);
                        state.view = 'main';
                        return i.update(renderMain(state));
                    }
                    if (i.customId === 'btn_edit_name') {
                        const m = new ModalBuilder().setCustomId('m_btn_name').setTitle('Nom, Style & Emoji');
                        m.addComponents(
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Texte du bouton').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.draftBtn.label)),
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('style').setLabel('Couleur (1=Bleu, 2=Gris, 3=Vert, 4=Rouge)').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.draftBtn.style.toString())),
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (Optionnel, ex: 🌟 ou <:nom:id>)').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.draftBtn.emoji || ''))
                        );
                        return i.showModal(m);
                    }
                    if (i.customId === 'btn_edit_ghost') {
                        const m = new ModalBuilder().setCustomId('m_btn_ghost').setTitle('Texte de Disposition');
                        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Texte affiché à côté').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.draftBtn.ghostText || '')));
                        return i.showModal(m);
                    }
                    if (i.customId === 'btn_edit_data') {
                        const m = new ModalBuilder().setCustomId('m_btn_data').setTitle('Données de l\'action');
                        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('data').setLabel(state.draftBtn.type === 'link' ? 'URL' : 'Message').setStyle(state.draftBtn.type === 'link' ? TextInputStyle.Short : TextInputStyle.Paragraph).setRequired(true).setValue(state.draftBtn.data || '')));
                        return i.showModal(m);
                    }
                }
            }
        });

        const modalListener = async (mInt) => {
            if (!mInt.isModalSubmit() || mInt.user.id !== interaction.user.id) return;

            if (mInt.customId === 'm_title') state.title = mInt.fields.getTextInputValue('val');
            if (mInt.customId === 'm_desc') state.description = mInt.fields.getTextInputValue('val');
            if (mInt.customId === 'm_color') state.color = mInt.fields.getTextInputValue('val').startsWith('#') ? mInt.fields.getTextInputValue('val') : `#${mInt.fields.getTextInputValue('val')}`;
            if (mInt.customId === 'm_images') {
                state.imageURL = mInt.fields.getTextInputValue('img');
                state.thumbnailURL = mInt.fields.getTextInputValue('thumb');
            }
            if (mInt.customId === 'm_json') {
                try {
                    const parsed = JSON.parse(mInt.fields.getTextInputValue('val'));
                    const emb = parsed.embeds ? parsed.embeds[0] : parsed;
                    
                    // Extraction Embed
                    if (emb.title) state.title = emb.title;
                    if (emb.description) state.description = emb.description;
                    if (emb.color) state.color = `#${emb.color.toString(16).padStart(6, '0')}`;
                    if (emb.image) state.imageURL = emb.image.url;
                    if (emb.thumbnail) state.thumbnailURL = emb.thumbnail.url;

                    // EXTRACTION DES BOUTONS (COMPONENTS V2)
                    if (parsed.components && Array.isArray(parsed.components)) {
                        state.buttons = [];
                        for (const row of parsed.components) {
                            for (const btn of row.components) {
                                if (btn.type === 2) { // 2 = type Bouton dans l'API Discord
                                    let emojiFormat = '';
                                    if (btn.emoji) {
                                        emojiFormat = btn.emoji.id ? `<:${btn.emoji.name}:${btn.emoji.id}>` : btn.emoji.name;
                                    }
                                    state.buttons.push({
                                        id: btn.custom_id || `btn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                        label: btn.label || '',
                                        style: btn.style || 1,
                                        type: btn.url ? 'link' : 'eph', // Par défaut link ou éphémère si inconnu
                                        data: btn.url || '*Message importé par défaut*',
                                        emoji: emojiFormat,
                                        layout: 'outside'
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    return mInt.reply({ content: '❌ JSON Invalide ou mal formaté.', ephemeral: true });
                }
            }

            if (mInt.customId === 'm_btn_name') {
                state.draftBtn.label = mInt.fields.getTextInputValue('label');
                state.draftBtn.style = parseInt(mInt.fields.getTextInputValue('style')) || 1;
                state.draftBtn.emoji = mInt.fields.getTextInputValue('emoji');
            }
            if (mInt.customId === 'm_btn_ghost') state.draftBtn.ghostText = mInt.fields.getTextInputValue('text');
            if (mInt.customId === 'm_btn_data') state.draftBtn.data = mInt.fields.getTextInputValue('data');

            await mInt.update(state.view === 'main' ? renderMain(state) : renderBtnBuilder(state));
        };

        interaction.client.on('interactionCreate', modalListener);
        collector.on('end', () => interaction.client.removeListener('interactionCreate', modalListener));
    }
};
