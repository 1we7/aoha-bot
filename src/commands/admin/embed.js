const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, ChannelType, 
    MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, 
    MediaGalleryBuilder
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

    const container = new ContainerBuilder()
        .setAccentColor(state.accentColor || 9132875);

    for (const item of state.items) {
        if (item.type === 10) {
            container.addComponent(new TextDisplayBuilder().setContent(item.content));
        } else if (item.type === 14) {
            container.addComponent(new SeparatorBuilder().setSpacing(item.spacing || 1).setDivider(item.divider !== false));
        } else if (item.type === 12) {
            const gallery = new MediaGalleryBuilder();
            if (item.items) {
                for (const mediaItem of item.items) {
                    gallery.addItems({
                        media: { url: mediaItem.media?.url || mediaItem.url },
                        description: mediaItem.description
                    });
                }
            }
            container.addComponent(gallery);
        } else if (item.type === 9) {
            const section = new SectionBuilder()
                .addComponent(new TextDisplayBuilder().setContent(item.textContent || ' '));

            if (item.button) {
                const btn = new ButtonBuilder()
                    .setStyle(item.button.style || ButtonStyle.Primary)
                    .setLabel(item.button.label || 'Bouton');

                if (item.button.action_type === 'link') {
                    btn.setURL(item.button.data || 'https://discord.com');
                } else {
                    btn.setCustomId(disableForPreview ? `prev_${item.button.id}` : item.button.id);
                    if (disableForPreview) btn.setDisabled(true);
                }

                if (item.button.emoji) {
                    const parsedEmoji = parseEmojiString(item.button.emoji);
                    if (parsedEmoji) btn.setEmoji(parsedEmoji);
                }

                section.setAccessory(btn);
            }
            container.addComponent(section);
        }
    }

    return [container];
}

function renderAdminPanel(state) {
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Aoha - Émetteur de Messages')
        .setColor(state.accentColor || 9132875)
        .setDescription('Colle directement le payload JSON généré depuis un éditeur externe (comme discord-webhook.com) pour l\'envoyer dans le salon de ton choix.');

    let compositionText = '';
    const hasData = state.rawData || state.items.length > 0;

    if (!hasData) {
        compositionText = '*Aucun contenu chargé. Utilise le bouton d\'importation ci-dessous.*';
    } else {
        if (state.rawData) {
            if (state.rawData.content) compositionText += `💬 **Texte :** Présent\n`;
            if (state.rawData.embeds && state.rawData.embeds.length) {
                compositionText += `🖼️ **Embeds :** ${state.rawData.embeds.length} chargé(s)\n`;
            }
        }
        if (state.items.length > 0) {
            compositionText += `🧩 **Composants Avancés :** ${state.items.length} chargé(s)\n`;
        }
    }

    embed.addFields(
        { name: '📋 Données détectées', value: compositionText },
        { name: '📢 Salon cible', value: state.channelId ? `<#${state.channelId}>` : '❌ Non assigné', inline: true }
    );

    const rows = [];

    // Ligne 1 : Choix du salon
    const rowChannel = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('v2_set_channel')
            .setPlaceholder('📢 Choisir le salon de destination')
            .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    );
    rows.push(rowChannel);

    // Ligne 2 : Outils d'importation et utilitaires
    const rowActions = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('v2_json_import')
            .setLabel('📥 Importer un JSON')
            .setStyle(ButtonStyle.Secondary)
    );

    if (!hasData) {
        rowActions.addComponents(
            new ButtonBuilder()
                .setLabel('🌐 Créer sur Discord-Webhook')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord-webhook.com/app')
        );
    } else {
        rowActions.addComponents(
            new ButtonBuilder()
                .setCustomId('v2_wipe')
                .setLabel('💥 Tout vider')
                .setStyle(ButtonStyle.Danger)
        );
    }
    rows.push(rowActions);

    // Ligne 3 : Publication
    const isReadyToPublish = hasData && state.channelId;
    const rowPublish = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('v2_execute_publish')
            .setLabel('🚀 Publier le message')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!isReadyToPublish)
    );
    rows.push(rowPublish);

    return {
        embeds: [embed],
        components: rows,
        ephemeral: true
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Générer et publier un message complet via JSON'),

    async execute(interaction) {
        const state = {
            accentColor: 9132875,
            channelId: null,
            items: [],
            rawData: null
        };

        const msg = await interaction.reply({ ...renderAdminPanel(state), withResponse: true });
        const collector = msg.resource.message.createMessageComponentCollector({ time: 1800000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            if (i.isChannelSelectMenu() && i.customId === 'v2_set_channel') {
                state.channelId = i.values[0];
                return i.update(renderAdminPanel(state));
            }

            if (i.isButton()) {
                if (i.customId === 'v2_wipe') {
                    state.items = [];
                    state.rawData = null;
                    return i.update(renderAdminPanel(state));
                }

                if (i.customId === 'v2_json_import') {
                    const uniqueId = `m_v2_json_import_${i.id}`;
                    const m = new ModalBuilder().setCustomId(uniqueId).setTitle('Importateur Direct JSON');
                    m.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('json_data')
                                .setLabel('Colle ton payload JSON complet')
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                        )
                    );
                    await i.showModal(m);

                    const mInt = await i.awaitModalSubmit({ filter: mi => mi.customId === uniqueId, time: 900000 }).catch(() => null);
                    if (!mInt) return;

                    try {
                        const jsonRaw = mInt.fields.getTextInputValue('json_data');
                        const parsed = JSON.parse(jsonRaw);

                        // Sauvegarde globale pour gérer le texte et les vrais embeds
                        state.rawData = parsed;

                        // Rétrocompatibilité si le JSON contient aussi des composants
                        let rootArray = null;
                        if (parsed.components) rootArray = parsed.components;
                        else if (Array.isArray(parsed)) rootArray = parsed;
                        else if (parsed.type === 17) rootArray = [parsed];

                        state.items = [];
                        if (Array.isArray(rootArray)) {
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
                                                        id: child.accessory.custom_id || `btn_${Date.now()}`,
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
                        return mInt.update(renderAdminPanel(state));
                    } catch (err) {
                        return mInt.reply({ content: '❌ Structure JSON invalide ou mal formée.', ephemeral: true });
                    }
                }

                if (i.customId === 'v2_execute_publish') {
                    await i.deferUpdate();

                    const targetChannel = await interaction.guild.channels.fetch(state.channelId).catch(() => null);
                    if (!targetChannel) {
                        return interaction.followUp({ content: '❌ Salon introuvable. Vérifie les permissions du bot.', ephemeral: true });
                    }

                    // Préparation de la charge utile d'envoi à Discord
                    const sendPayload = {};

                    if (state.rawData) {
                        if (state.rawData.content) sendPayload.content = state.rawData.content;
                        if (state.rawData.embeds && state.rawData.embeds.length > 0) {
                            sendPayload.embeds = state.rawData.embeds;
                        }
                    }

                    // Gestion des composants avancés (Components V2)
                    const advancedComponents = compileComponentsV2(state, false);

                    if (advancedComponents.length > 0) {
                        // Cas 1 : des composants V2 ont été parsés depuis le JSON
                        sendPayload.components = advancedComponents;
                        sendPayload.flags = [MessageFlags.IsComponentsV2];
                    } else if (state.rawData?.components && state.rawData.components.length > 0) {
                        // Cas 2 : le JSON brut contient des composants, on les passe directement
                        sendPayload.components = state.rawData.components;

                        // On ajoute le flag IsComponentsV2 si le JSON contient un container (type 17)
                        const hasV2Container = state.rawData.components.some(c => c.type === 17);
                        if (hasV2Container) {
                            sendPayload.flags = [MessageFlags.IsComponentsV2];
                        }
                    }

                    // Vérifie qu'il y a bien quelque chose à envoyer
                    const hasContent = sendPayload.content || 
                                       (sendPayload.embeds && sendPayload.embeds.length > 0) || 
                                       (sendPayload.components && sendPayload.components.length > 0);

                    if (!hasContent) {
                        return interaction.followUp({ 
                            content: '❌ Aucun contenu à envoyer. Le JSON importé ne contient ni texte, ni embed, ni composant reconnu.', 
                            ephemeral: true 
                        });
                    }

                    // Traitement de la base de données pour les boutons d'actions personnalisés
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

                    try {
                        await targetChannel.send(sendPayload);

                        collector.stop();
                        return interaction.editReply({ 
                            content: `✅ Message envoyé avec succès dans <#${state.channelId}> !`, 
                            embeds: [], 
                            components: [] 
                        });
                        
                    } catch (error) {
                        console.error('[embed.js] Erreur lors de l\'envoi :', error);
                        return interaction.followUp({ 
                            content: `❌ Échec du transfert. Discord a refusé le format.\n**Détail :** \`${error.message}\``, 
                            ephemeral: true 
                        });
                    }
                }
            }
        });
    }
};
