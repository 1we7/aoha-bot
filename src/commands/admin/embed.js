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

function compileComponentsV2(state) {
    if (!state.items || state.items.length === 0) return [];

    const container = new ContainerBuilder()
        .setAccentColor(state.accentColor || 9132875);

    for (const item of state.items) {
        if (item.type === 10) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(item.content)
            );
        } else if (item.type === 14) {
            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(item.spacing || 1).setDivider(item.divider !== false)
            );
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
            container.addMediaGalleryComponents(gallery);
        } else if (item.type === 9) {
            const section = new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(item.textContent || ' ')
                );

            if (item.button) {
                const btn = new ButtonBuilder()
                    .setStyle(item.button.style || ButtonStyle.Primary)
                    .setLabel(item.button.label || 'Bouton');

                if (item.button.action_type === 'link') {
                    btn.setURL(item.button.data || 'https://discord.com');
                } else {
                    btn.setCustomId(item.button.id);
                }

                if (item.button.emoji) {
                    const parsedEmoji = parseEmojiString(item.button.emoji);
                    if (parsedEmoji) btn.setEmoji(parsedEmoji);
                }

                section.setAccessory(btn);
            }

            container.addSectionComponents(section);
        }
    }

    return [container];
}

function buildSendPayload(state) {
    const payload = {};

    if (state.rawData) {
        if (state.rawData.content) payload.content = state.rawData.content;
        if (state.rawData.embeds?.length > 0) payload.embeds = state.rawData.embeds;
    }

    const advancedComponents = compileComponentsV2(state);
    if (advancedComponents.length > 0) {
        payload.components = advancedComponents;
        payload.flags = MessageFlags.IsComponentsV2;
    } else if (state.rawData?.components?.length > 0) {
        payload.components = state.rawData.components;
        const hasV2Container = state.rawData.components.some(c => c.type === 17);
        if (hasV2Container) payload.flags = MessageFlags.IsComponentsV2;
    }

    return payload;
}

function renderAdminPanel(state) {
    const hasData = !!(state.rawData || state.items.length > 0);

    let compositionText = '';
    if (!hasData) {
        compositionText = '*Aucun contenu chargé. Utilise le bouton d\'importation ci-dessous.*';
    } else {
        if (state.rawData?.content) compositionText += `💬 **Texte :** Présent\n`;
        if (state.rawData?.embeds?.length) compositionText += `🖼️ **Embeds :** ${state.rawData.embeds.length} chargé(s)\n`;
        if (state.items.length > 0) compositionText += `🧩 **Composants Avancés :** ${state.items.length} chargé(s)\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle('⚙️ Aoha - Émetteur de Messages')
        .setColor(state.accentColor || 9132875)
        .setDescription('Colle directement le payload JSON généré depuis un éditeur externe pour l\'envoyer dans le salon de ton choix.')
        .addFields({ name: '📋 Données détectées', value: compositionText });

    const rows = [];

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

    rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('v2_execute_publish')
            .setLabel('🚀 Publier le message')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!hasData)
    ));

    return { embeds: [embed], components: rows, flags: MessageFlags.Ephemeral };
}

function renderChannelPicker(state) {
    const embed = new EmbedBuilder()
        .setTitle('📢 Choisir le salon de destination')
        .setColor(state.accentColor || 9132875)
        .setDescription('Sélectionne le salon dans lequel envoyer le message.');

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('v2_pick_channel')
                    .setPlaceholder('Choisir un salon...')
                    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('v2_back')
                    .setLabel('⬅️ Retour')
                    .setStyle(ButtonStyle.Secondary)
            )
        ],
        flags: MessageFlags.Ephemeral
    };
}

function renderConfirm(state) {
    const embed = new EmbedBuilder()
        .setTitle('✅ Confirmer l\'envoi')
        .setColor(state.accentColor || 9132875)
        .setDescription(`Tu es sur le point d\'envoyer le message dans <#${state.channelId}>.\n\nConfirmer ?`);

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('v2_confirm_yes')
                    .setLabel('✅ Confirmer')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('v2_confirm_no')
                    .setLabel('❌ Annuler')
                    .setStyle(ButtonStyle.Danger)
            )
        ],
        flags: MessageFlags.Ephemeral
    };
}

function parseJsonIntoState(parsed, state) {
    state.rawData = parsed;

    let rootArray = null;
    if (parsed.components) rootArray = parsed.components;
    else if (Array.isArray(parsed)) rootArray = parsed;
    else if (parsed.type === 17) rootArray = [parsed];

    state.items = [];
    if (!Array.isArray(rootArray)) return;

    for (const rootComp of rootArray) {
        if (rootComp.type !== 17) continue;
        if (rootComp.accent_color) state.accentColor = rootComp.accent_color;
        if (!Array.isArray(rootComp.components)) continue;

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
                if (child.accessory?.type === 2) {
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

        await interaction.reply(renderAdminPanel(state));

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 1800000
        });

        collector.on('collect', async i => {
            try {
                if (i.customId === 'v2_wipe') {
                    state.items = [];
                    state.rawData = null;
                    state.channelId = null;
                    return await i.update(renderAdminPanel(state));
                }

                if (i.customId === 'v2_json_import') {
                    const uniqueId = `m_json_${i.id}`;
                    const modal = new ModalBuilder()
                        .setCustomId(uniqueId)
                        .setTitle('Importateur Direct JSON')
                        .addComponents(
                            new ActionRowBuilder().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('json_data')
                                    .setLabel('Colle ton payload JSON complet')
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setRequired(true)
                            )
                        );
                    await i.showModal(modal);

                    const mInt = await i.awaitModalSubmit({ filter: mi => mi.customId === uniqueId, time: 900000 }).catch(() => null);
                    if (!mInt) return;

                    try {
                        const parsed = JSON.parse(mInt.fields.getTextInputValue('json_data'));
                        parseJsonIntoState(parsed, state);
                        return await mInt.update(renderAdminPanel(state));
                    } catch {
                        return await mInt.reply({ content: '❌ JSON invalide ou mal formé.', ephemeral: true });
                    }
                }

                if (i.customId === 'v2_execute_publish') {
                    return await i.update(renderChannelPicker(state));
                }

                if (i.customId === 'v2_pick_channel') {
                    state.channelId = i.values[0];
                    return await i.update(renderConfirm(state));
                }

                if (i.customId === 'v2_back') {
                    return await i.update(renderAdminPanel(state));
                }

                if (i.customId === 'v2_confirm_no') {
                    state.channelId = null;
                    return await i.update(renderAdminPanel(state));
                }

                if (i.customId === 'v2_confirm_yes') {
                    await i.deferUpdate();

                    const targetChannel = await interaction.guild.channels.fetch(state.channelId).catch(() => null);
                    if (!targetChannel) {
                        return await i.editReply({ content: '❌ Salon introuvable.', embeds: [], components: [] });
                    }

                    const sendPayload = buildSendPayload(state);
                    const hasContent = sendPayload.content || sendPayload.embeds?.length > 0 || sendPayload.components?.length > 0;

                    if (!hasContent) {
                        return await i.editReply({ content: '❌ Aucun contenu à envoyer.', embeds: [], components: [] });
                    }

                    // Sauvegarde des boutons custom en BDD
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

                    await targetChannel.send(sendPayload);
                    collector.stop();

                    return await i.editReply({
                        content: `✅ Message envoyé avec succès dans <#${state.channelId}> !`,
                        embeds: [],
                        components: []
                    });
                }

            } catch (error) {
                console.error('[embed.js] Erreur :', error);
                try {
                    if (i.deferred || i.replied) {
                        await i.followUp({ content: `❌ Erreur : \`${error.message}\``, ephemeral: true });
                    } else {
                        await i.reply({ content: `❌ Erreur : \`${error.message}\``, ephemeral: true });
                    }
                } catch {}
            }
        });
    }
};
