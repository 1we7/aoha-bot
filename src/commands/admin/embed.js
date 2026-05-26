const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
    ChannelSelectMenuBuilder, ChannelType
} = require('discord.js');

const db = require('../../database');

function parseEmojiString(emojiStr) {
    if (!emojiStr) return null;
    const customEmojiRegex = /<a?:([a-zA-Z0-9_]+):([0-9]+)>/;
    const match = emojiStr.match(customEmojiRegex);
    if (match) {
        return { name: match[1], id: match[2], animated: emojiStr.startsWith('<a:') };
    }
    return { name: emojiStr };
}

function compileComponentsV2(state, disableForPreview = false) {
    if (!state.items || state.items.length === 0) return [];

    const container = {
        type: 17,
        accent_color: state.accentColor || 9132875,
        components: []
    };

    for (const item of state.items) {
        if (item.type === 10) {
            container.components.push({ type: 10, content: item.content });
        } else if (item.type === 14) {
            container.components.push({ type: 14, spacing: item.spacing || 1, divider: item.divider !== false });
        } else if (item.type === 12) {
            container.components.push({ type: 12, items: item.items || [] });
        } else if (item.type === 9) {
            const section = {
                type: 9,
                components: [{ type: 10, content: item.textContent || ' ' }]
            };

            if (item.button) {
                const btn = {
                    type: 2,
                    style: item.button.style || 1,
                    label: item.button.label || 'Bouton'
                };

                if (item.button.action_type === 'link') {
                    btn.url = item.button.data || 'https://discord.com';
                } else {
                    btn.custom_id = disableForPreview ? `prev_${item.button.id}` : item.button.id;
                    if (disableForPreview) btn.disabled = true;
                }

                if (item.button.emoji) {
                    const parsedEmoji = parseEmojiString(item.button.emoji);
                    if (parsedEmoji) btn.emoji = parsedEmoji;
                }

                section.accessory = btn;
            }

            container.components.push(section);
        }
    }

    return [container];
}

function renderAdminPanel(state) {
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Aoha - Constructeur de Messages Components V2')
        .setColor(state.accentColor || 9132875)
        .setDescription('Ajoute des blocs séquentiels à l\'intérieur de ton container natif Discord V2. Tu peux aussi importer directement un export de site externe.');

    let compositionText = '';
    if (state.items.length === 0) {
        compositionText = '*Aucun composant injecté pour le moment. Remplis la liste ci-dessous.*';
    } else {
        state.items.forEach((item, index) => {
            if (item.type === 10) {
                compositionText += `\`[${index + 1}] Text Display:\` ${item.content.substring(0, 50)}...\n`;
            } else if (item.type === 14) {
                compositionText += `\`[${index + 1}] Separator\` (Ligne de séparation horizontale)\n`;
            } else if (item.type === 12) {
                compositionText += `\`[${index + 1}] Media Gallery\` (${item.items?.length || 0} image(s))\n`;
            } else if (item.type === 9) {
                const btnInfo = item.button ? ` [Bouton : "${item.button.label}" (${item.button.action_type})]` : '';
                compositionText += `\`[${index + 1}] Section :\` ${item.textContent?.substring(0, 30)}...${btnInfo}\n`;
            }
        });
    }

    embed.addFields(
        { name: '📋 Éléments empilés dans l\'ordre', value: compositionText },
        { name: '📢 Salon de cible', value: state.channelId ? `<#${state.channelId}>` : '❌ Non assigné', inline: true },
        { name: '🎨 Couleur Latérale (Int)', value: `\`${state.accentColor}\``, inline: true }
    );

    const rowMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('v2_select_action').setPlaceholder('➕ Insérer un nouvel élément...').addOptions(
            { label: 'Section avec Bouton (Type 9)', value: 'add_section', emoji: '🔘', description: 'Texte à gauche et bouton d\'action à droite' },
            { label: 'Bloc de Texte (Type 10)', value: 'add_text', emoji: '📝', description: 'Paragraphe Markdown autonome' },
            { label: 'Ligne de Séparation (Type 14)', value: 'add_separator', emoji: '➖', description: 'Ajoute de l\'espace et une bordure de démarcation' },
            { label: 'Galerie Média (Type 12)', value: 'add_media', emoji: '🖼️', description: 'Affiche des bannières/images intégrées' }
        )
    );

    const rowAdminButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('v2_set_color').setLabel('🎨 Couleur').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('v2_json_import').setLabel('📥 Importer JSON V2').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('v2_pop_item').setLabel('🗑️ Suppr Dernier').setStyle(ButtonStyle.Danger).setDisabled(state.items.length === 0),
        new ButtonBuilder().setCustomId('v2_wipe').setLabel('💥 Tout vider').setStyle(ButtonStyle.Danger).setDisabled(state.items.length === 0)
    );

    const rowChannel = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('v2_set_channel').setPlaceholder('📢 Définir le salon de destination').setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    );

    const rowPublish = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('v2_execute_publish').setLabel('🚀 Publier le Message V2').setStyle(ButtonStyle.Primary).setDisabled(state.items.length === 0 || !state.channelId)
    );

    return {
        embeds: [embed],
        components: [rowMenu, rowAdminButtons, rowChannel, rowPublish],
        ephemeral: true
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Générer un message natif utilisant la structure Discord Components V2'),

    async execute(interaction) {
        const state = {
            accentColor: 9132875,
            channelId: null,
            items: []
        };

        const msg = await interaction.reply({ ...renderAdminPanel(state), withResponse: true });
        const collector = msg.resource.message.createMessageComponentCollector({ time: 1800000 });

        // FIX 1 : fonction utilitaire pour rafraîchir le panneau depuis n'importe quel contexte
        // (component interaction OU modal interaction avec message original)
        async function refreshPanel(i, useFollowup = false) {
            if (useFollowup) {
                // Depuis une modale : on edit le message original via l'interaction slash d'origine
                return interaction.editReply(renderAdminPanel(state));
            }
            return i.update(renderAdminPanel(state));
        }

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            if (i.isChannelSelectMenu() && i.customId === 'v2_set_channel') {
                state.channelId = i.values[0];
                return i.update(renderAdminPanel(state));
            }

            if (i.isStringSelectMenu() && i.customId === 'v2_select_action') {
                const choice = i.values[0];

                if (choice === 'add_section') {
                    const m = new ModalBuilder().setCustomId('m_v2_add_section').setTitle('Section avec Bouton (Type 9)');
                    m.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text_content').setLabel('Texte de la section (Markdown)').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('### Titre du Ticket\nCliquez pour ouvrir un ticket.')),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn_label').setLabel('Label du bouton').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ouvrir Ticket')),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn_type').setLabel('Type d\'action (link / ticket / eph / mp)').setStyle(TextInputStyle.Short).setRequired(true).setValue('ticket')),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn_data').setLabel('Données (URL, msg ou ROLE_ID,CAT_ID si ticket)').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Ex si ticket : 123456789012345678,987654321098765432')),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn_emoji').setLabel('Emoji du bouton (Optionnel)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('🎫'))
                    );
                    return i.showModal(m);
                }

                if (choice === 'add_text') {
                    const m = new ModalBuilder().setCustomId('m_v2_add_text').setTitle('Bloc de Texte (Type 10)');
                    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text_content').setLabel('Contenu textuel (Markdown)').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                    return i.showModal(m);
                }

                if (choice === 'add_media') {
                    const m = new ModalBuilder().setCustomId('m_v2_add_media').setTitle('Galerie Média (Type 12)');
                    m.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('img_url').setLabel('URL de l\'image').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('img_desc').setLabel('Description alt alternative (Optionnel)').setStyle(TextInputStyle.Short).setRequired(false))
                    );
                    return i.showModal(m);
                }

                if (choice === 'add_separator') {
                    state.items.push({ type: 14, spacing: 1, divider: true });
                    return i.update(renderAdminPanel(state));
                }
            }

            if (i.isButton()) {
                if (i.customId === 'v2_pop_item') {
                    state.items.pop();
                    return i.update(renderAdminPanel(state));
                }
                if (i.customId === 'v2_wipe') {
                    state.items = [];
                    return i.update(renderAdminPanel(state));
                }
                if (i.customId === 'v2_set_color') {
                    const m = new ModalBuilder().setCustomId('m_v2_set_color').setTitle('Modifier l\'accent du container');
                    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color_value').setLabel('Code Int (ex: 9132875) ou Hex (ex: #8b5cf6)').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.accentColor.toString())));
                    return i.showModal(m);
                }
                if (i.customId === 'v2_json_import') {
                    const m = new ModalBuilder().setCustomId('m_v2_json_import').setTitle('Importateur Direct Components V2');
                    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('json_data').setLabel('Colle le payload JSON complet').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                    return i.showModal(m);
                }

                // FIX 2 : deferUpdate avant l'opération async pour éviter le timeout d'interaction
                if (i.customId === 'v2_execute_publish') {
                    await i.deferUpdate();

                    const targetChannel = interaction.guild.channels.cache.get(state.channelId);
                    if (!targetChannel) {
                        return interaction.followUp({ content: '❌ Salon introuvable.', ephemeral: true });
                    }

                    const finalComponentsPayload = compileComponentsV2(state, false);

                    for (const item of state.items) {
                        if (item.type === 9 && item.button && item.button.action_type !== 'link') {
                            const dbActionType = item.button.action_type === 'eph' ? 'ephemeral' : item.button.action_type;
                            db.prepare('INSERT OR REPLACE INTO custom_buttons (custom_id, action_type, action_data, guild_id) VALUES (?, ?, ?, ?)').run(
                                item.button.id,
                                dbActionType,
                                item.button.data || '',
                                interaction.guild.id
                            );
                        }
                    }

                    await targetChannel.send({
                        flags: 32768,
                        components: finalComponentsPayload
                    });

                    collector.stop();
                    return interaction.editReply({ content: `✅ Message de type Components V2 propulsé avec succès dans <#${state.channelId}> !`, embeds: [], components: [] });
                }
            }
        });

        // FIX 3 : collecteur de modales corrigé — deferUpdate + editReply au lieu de mInt.update()
        const modalListener = async (mInt) => {
            if (!mInt.isModalSubmit() || mInt.user.id !== interaction.user.id) return;

            // On vérifie que la modale appartient bien à cette session
            const knownModals = ['m_v2_add_section', 'm_v2_add_text', 'm_v2_add_media', 'm_v2_set_color', 'm_v2_json_import'];
            if (!knownModals.includes(mInt.customId)) return;

            // Accuser réception immédiatement pour éviter "cette interaction a échoué"
            await mInt.deferUpdate();

            if (mInt.customId === 'm_v2_add_section') {
                const textContent = mInt.fields.getTextInputValue('text_content');
                const btnLabel = mInt.fields.getTextInputValue('btn_label');
                const btnType = mInt.fields.getTextInputValue('btn_type').toLowerCase().trim();
                const btnData = mInt.fields.getTextInputValue('btn_data');
                const btnEmoji = mInt.fields.getTextInputValue('btn_emoji');

                const generatedBtnId = `v2_action_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

                state.items.push({
                    type: 9,
                    textContent: textContent,
                    button: {
                        id: generatedBtnId,
                        label: btnLabel,
                        action_type: btnType,
                        data: btnData,
                        emoji: btnEmoji,
                        style: btnType === 'link' ? 5 : 1
                    }
                });
            }

            if (mInt.customId === 'm_v2_add_text') {
                state.items.push({
                    type: 10,
                    content: mInt.fields.getTextInputValue('text_content')
                });
            }

            if (mInt.customId === 'm_v2_add_media') {
                state.items.push({
                    type: 12,
                    items: [{
                        media: { url: mInt.fields.getTextInputValue('img_url') },
                        description: mInt.fields.getTextInputValue('img_desc') || undefined
                    }]
                });
            }

            if (mInt.customId === 'm_v2_set_color') {
                const rawColor = mInt.fields.getTextInputValue('color_value').trim();
                if (rawColor.startsWith('#')) {
                    state.accentColor = parseInt(rawColor.replace('#', ''), 16);
                } else {
                    state.accentColor = parseInt(rawColor) || 9132875;
                }
            }

            if (mInt.customId === 'm_v2_json_import') {
                try {
                    const jsonRaw = mInt.fields.getTextInputValue('json_data');
                    const parsed = JSON.parse(jsonRaw);

                    let rootArray = null;
                    if (parsed.components) rootArray = parsed.components;
                    else if (Array.isArray(parsed)) rootArray = parsed;
                    else if (parsed.type === 17) rootArray = [parsed];

                    if (Array.isArray(rootArray)) {
                        state.items = [];
                        for (const rootComp of rootArray) {
                            if (rootComp.type === 17) {
                                if (rootComp.accent_color) state.accentColor = rootComp.accent_color;
                                if (Array.isArray(rootComp.components)) {
                                    for (const child of rootComp.components) {
                                        if (child.type === 10) {
                                            state.items.push({ type: 10, content: child.content || '' });
                                        } else if (child.type === 14) {
                                            state.items.push({ type: 14, spacing: child.spacing || 1, divider: child.divider !== false });
                                        } else if (child.type === 12) {
                                            state.items.push({ type: 12, items: child.items || [] });
                                        } else if (child.type === 9) {
                                            let textVal = '';
                                            if (Array.isArray(child.components) && child.components[0]) {
                                                textVal = child.components[0].content || '';
                                            }
                                            let btnObj = null;
                                            if (child.accessory && child.accessory.type === 2) {
                                                let emojiString = '';
                                                if (child.accessory.emoji) {
                                                    const em = child.accessory.emoji;
                                                    emojiString = em.id ? `<:${em.name}:${em.id}>` : em.name;
                                                }
                                                btnObj = {
                                                    id: child.accessory.custom_id || `v2_btn_${Date.now()}`,
                                                    label: child.accessory.label || 'Ouvrir',
                                                    style: child.accessory.style || 1,
                                                    action_type: child.accessory.url ? 'link' : 'ticket',
                                                    data: child.accessory.url || '',
                                                    emoji: emojiString
                                                };
                                            }
                                            state.items.push({ type: 9, textContent: textVal, button: btnObj });
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {
                    // deferUpdate est déjà envoyé, on utilise followUp pour l'erreur
                    return interaction.followUp({ content: '❌ Structure JSON V2 invalide ou incompatible.', ephemeral: true });
                }
            }

            // Rafraîchissement du panneau via editReply sur l'interaction slash d'origine
            await interaction.editReply(renderAdminPanel(state));
        };

        interaction.client.on('interactionCreate', modalListener);
        collector.on('end', () => interaction.client.removeListener('interactionCreate', modalListener));
    }
};
