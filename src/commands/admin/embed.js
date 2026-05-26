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
        .setTitle('⚙️ Aoha - Émetteur de Messages Components V2')
        .setColor(state.accentColor || 9132875)
        .setDescription('Colle directement le payload JSON généré depuis un éditeur externe pour l\'envoyer dans le salon de ton choix.');

    let compositionText = '';
    if (state.items.length === 0) {
        compositionText = '*Aucun composant chargé. Utilise le bouton d\'importation ci-dessous.*';
    } else {
        state.items.forEach((item, index) => {
            if (item.type === 10) compositionText += `\`[${index + 1}] Text Display\`\n`;
            else if (item.type === 14) compositionText += `\`[${index + 1}] Separator\`\n`;
            else if (item.type === 12) compositionText += `\`[${index + 1}] Media Gallery\`\n`;
            else if (item.type === 9) compositionText += `\`[${index + 1}] Section d'action\`\n`;
        });
    }

    embed.addFields(
        { name: '📋 Structure du JSON importé', value: compositionText },
        { name: '📢 Salon cible', value: state.channelId ? `<#${state.channelId}>` : '❌ Non assigné', inline: true },
        { name: '🎨 Couleur (Int)', value: `\`${state.accentColor}\``, inline: true }
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

    // Condition d'affichage pour le bouton d'aide / redirection ou suppression
    if (state.items.length === 0) {
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
    const rowPublish = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('v2_execute_publish')
            .setLabel('🚀 Publier le Message V2')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(state.items.length === 0 || !state.channelId)
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
        .setDescription('Générer et publier un message natif Discord Components V2 via JSON'),

    async execute(interaction) {
        const state = {
            accentColor: 9132875,
            channelId: null,
            items: []
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
                    return i.update(renderAdminPanel(state));
                }

                if (i.customId === 'v2_json_import') {
                    const uniqueId = `m_v2_json_import_${i.id}`;
                    const m = new ModalBuilder().setCustomId(uniqueId).setTitle('Importateur Direct Components V2');
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
                        return mInt.update(renderAdminPanel(state));
                    } catch (err) {
                        return mInt.reply({ content: '❌ Structure JSON V2 invalide ou corrompue.', ephemeral: true });
                    }
                }

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
                        flags: [MessageFlags.IsComponentsV2],
                        components: finalComponentsPayload
                    });

                    collector.stop();
                    return interaction.editReply({ content: `✅ Message de type Components V2 propulsé avec succès dans <#${state.channelId}> !`, embeds: [], components: [] });
                }
            }
        });
    }
};
