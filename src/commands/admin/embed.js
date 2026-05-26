const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType
} = require('discord.js');
const db = require('../../database');

// Convertit une chaîne emoji (ex: 🌟 ou <:nom:id>) en objet pour l'API Discord
function parseEmojiString(emojiStr) {
    if (!emojiStr) return null;
    const customEmojiRegex = /<a?:([a-zA-Z0-9_]+):([0-9]+)>/;
    const match = emojiStr.match(customEmojiRegex);
    if (match) {
        return { name: match[1], id: match[2], animated: emojiStr.startsWith('<a:') };
    }
    return { name: emojiStr };
}

// Compile l'état local au format strict Discord Components V2
function compileComponentsV2(state, disableForPreview = false) {
    if (!state.items || state.items.length === 0) return [];

    // On englobe tout dans un Container racine (Type 17) pour avoir la barre de couleur à gauche
    return [
        {
            type: 17,
            accent_color: state.accentColor,
            components: state.items.map(item => {
                if (item.type === 10) { // Text Display
                    return { type: 10, content: item.content };
                }
                if (item.type === 14) { // Separator
                    return { type: 14, spacing: 1, divider: true };
                }
                if (item.type === 9) { // Section (Texte + Bouton à droite)
                    const section = {
                        type: 9,
                        content: item.content || ' '
                    };
                    if (item.button) {
                        section.accessory = {
                            type: 2,
                            style: item.button.style || 1,
                            label: item.button.label,
                            custom_id: item.button.action_type === 'link' ? undefined : (disableForPreview ? `prev_${item.button.id}` : item.button.id),
                            url: item.button.action_type === 'link' ? item.button.data : undefined,
                            disabled: disableForPreview && item.button.action_type !== 'link'
                        };
                        if (item.button.emoji) {
                            section.accessory.emoji = parseEmojiString(item.button.emoji);
                        }
                    }
                    return section;
                }
                return item;
            })
        }
    ];
}

// Rendu du panneau de contrôle d'administration
function renderAdminPanel(state) {
    // Génère l'aperçu réel en V2
    const previewComponents = compileComponentsV2(state, true);

    // Composants de contrôle de l'admin (V1 classique pour l'interface de gestion)
    const rowMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('v2_menu').setPlaceholder('➕ Ajouter un élément V2...').addOptions(
            { label: 'Ajouter un Bloc Option (Section + Bouton)', value: 'add_section', emoji: '🎫', description: 'Idéal pour les tickets ou boutons d\'actions' },
            { label: 'Ajouter un Texte Simple (Text Display)', value: 'add_text', emoji: '📄' },
            { label: 'Ajouter un Séparateur (Separator)', value: 'add_separator', emoji: '➖' },
            { label: 'Changer la couleur de l\'accent', value: 'edit_color', emoji: '🎨' },
            { label: 'Importer un JSON complet', value: 'import_json_v2', emoji: '📥' }
        )
    );

    const rowActions = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('v2_clear').setLabel('🗑️ Vider le dernier').setStyle(ButtonStyle.Danger).setDisabled(state.items.length === 0),
        new ButtonBuilder().setCustomId('v2_publish').setLabel('🚀 Publier le message V2').setStyle(ButtonStyle.Primary).setDisabled(state.items.length === 0 || !state.channelId)
    );

    const rowChannel = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('v2_channel').setPlaceholder(state.channelId ? '✅ Salon sélectionné' : '📢 Choisir le salon d\'envoi').setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    );

    // On fusionne l'aperçu du message V2 (en haut) avec l'interface admin (en bas)
    // Discord applique le flag 32768 au message complet
    return {
        content: '### 🛠️ Aoha - Constructeur de Message Components V2\n*Voici l\'aperçu de ton rendu actuel :*',
        flags: 32768, // Active le rendu natif V2
        components: [...previewComponents, rowMenu, rowActions, rowChannel].slice(0, 5) // Garde la limite Discord sauve
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Créer un message natif avec la structure Discord Components V2'),

    async execute(interaction) {
        // Initialisation de l'état
        const state = {
            accentColor: 9132875, // Couleur par défaut de ta capture
            channelId: null,
            items: [] // Stocke l'arbre ordonné des éléments V2
        };

        const msg = await interaction.reply({ ...renderAdminPanel(state), ephemeral: true, withResponse: true });
        const collector = msg.resource.message.createMessageComponentCollector({ time: 1800000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            if (i.isChannelSelectMenu() && i.customId === 'v2_channel') {
                state.channelId = i.values[0];
                return i.update(renderAdminPanel(state));
            }

            if (i.isStringSelectMenu() && i.customId === 'v2_menu') {
                const choice = i.values[0];

                if (choice === 'add_section') {
                    // La modale exacte basée sur ta capture d'écran !
                    const m = new ModalBuilder().setCustomId('m_v2_section').setTitle('Configurer le nouveau bouton');
                    m.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn_label').setLabel('Texte du bouton *').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ouvrir')),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn_type').setLabel('Type : link / mp / eph / ticket *').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('ticket')),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('btn_data').setLabel('URL ou contenu (selon le type)').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Si ticket -> Entre: ROLE_ID,CATEGORY_ID')),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('section_content').setLabel('Texte affiché à côté (optionnel)').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('### Titre\nDescription ici...'))
                    );
                    return i.showModal(m);
                }

                if (choice === 'add_text') {
                    const m = new ModalBuilder().setCustomId('m_v2_text').setTitle('Ajouter un Text Display');
                    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('content').setLabel('Texte (Markdown supporté)').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                    return i.showModal(m);
                }

                if (choice === 'edit_color') {
                    const m = new ModalBuilder().setCustomId('m_v2_color').setTitle('Modifier l\'accent du Container');
                    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Couleur Int (ex: 9132875) ou Hex (ex: #8b5cf6)').setStyle(TextInputStyle.Short).setRequired(true)));
                    return i.showModal(m);
                }

                if (choice === 'import_json_v2') {
                    const m = new ModalBuilder().setCustomId('m_v2_json').setTitle('Importer un JSON Components V2');
                    m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('json').setLabel('Colle le JSON complet (Type 17 inclus)').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                    return i.showModal(m);
                }

                if (choice === 'add_separator') {
                    state.items.push({ type: 14 });
                    return i.update(renderAdminPanel(state));
                }
            }

            if (i.isButton()) {
                if (i.customId === 'v2_clear') {
                    state.items.pop();
                    return i.update(renderAdminPanel(state));
                }

                if (i.customId === 'v2_publish') {
                    const targetChannel = interaction.guild.channels.cache.get(state.channelId);
                    if (!targetChannel) return i.reply({ content: '❌ Salon introuvable.', ephemeral: true });

                    // Génération finale des composants V2
                    const finalComponents = compileComponentsV2(state, false);

                    // Enregistrement en BDD de tous les boutons interactifs programmés
                    for (const item of state.items) {
                        if (item.type === 9 && item.button && item.button.action_type !== 'link') {
                            const dbType = item.button.action_type === 'eph' ? 'ephemeral' : item.button.action_type;
                            db.prepare('INSERT OR REPLACE INTO custom_buttons (custom_id, action_type, action_data, guild_id) VALUES (?, ?, ?, ?)').run(
                                item.button.id,
                                dbType,
                                item.button.data || '',
                                interaction.guild.id
                            );
                        }
                    }

                    // Envoi natif du message V2 sans embed
                    await targetChannel.send({
                        flags: 32768,
                        components: finalComponents
                    });

                    collector.stop();
                    return i.update({ content: `✅ Message Components V2 publié avec succès dans <#${state.channelId}> !`, components: [] });
                }
            }
        });

        // Gestionnaire des retours de modales
        const modalListener = async (mInt) => {
            if (!mInt.isModalSubmit() || mInt.user.id !== interaction.user.id) return;

            if (mInt.customId === 'm_v2_section') {
                const label = mInt.fields.getTextInputValue('btn_label');
                const type = mInt.fields.getTextInputValue('btn_type').toLowerCase().trim();
                const data = mInt.fields.getTextInputValue('btn_data');
                const content = mInt.fields.getTextInputValue('section_content');

                const buttonId = `v2_btn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

                state.items.push({
                    type: 9, // Toujours structure en Section pour aligner à droite
                    content: content || ' ',
                    button: {
                        id: buttonId,
                        label: label,
                        action_type: type,
                        data: data,
                        style: type === 'link' ? 5 : 1 // Style lien ou primaire par défaut
                    }
                });
            }

            if (mInt.customId === 'm_v2_text') {
                state.items.push({
                    type: 10,
                    content: mInt.fields.getTextInputValue('content')
                });
            }

            if (mInt.customId === 'm_v2_color') {
                const inputColor = mInt.fields.getTextInputValue('color').trim();
                if (inputColor.startsWith('#')) {
                    state.accentColor = parseInt(inputColor.replace('#', ''), 16);
                } else {
                    state.accentColor = parseInt(inputColor) || 9132875;
                }
            }

            if (mInt.customId === 'm_v2_json') {
                try {
                    const parsed = JSON.parse(mInt.fields.getTextInputValue('json'));
                    const componentsRoot = parsed.components || parsed;

                    if (Array.isArray(componentsRoot)) {
                        state.items = [];
                        for (const comp of componentsRoot) {
                            if (comp.type === 17) { // Extraction depuis le container racine
                                if (comp.accent_color) state.accentColor = comp.accent_color;
                                if (comp.components) {
                                    for (const child of comp.components) {
                                        if (child.type === 9) { // Section convertie pour notre éditeur
                                            let btnData = null;
                                            if (child.accessory && child.accessory.type === 2) {
                                                btnData = {
                                                    id: child.accessory.custom_id || `v2_btn_${Date.now()}`,
                                                    label: child.accessory.label || 'Ouvrir',
                                                    action_type: child.accessory.url ? 'link' : 'ticket',
                                                    data: child.accessory.url || '',
                                                    style: child.accessory.style || 1
                                                };
                                            }
                                            state.items.push({ type: 9, content: child.content, button: btnData });
                                        } else {
                                            state.items.push(child);
                                        }
                                    }
                                }
                            } else {
                                state.items.push(comp);
                            }
                        }
                    }
                } catch (e) {
                    return mInt.reply({ content: '❌ Code JSON V2 invalide.', ephemeral: true });
                }
            }

            await mInt.update(renderAdminPanel(state));
        };

        interaction.client.on('interactionCreate', modalListener);
        collector.on('end', () => interaction.client.removeListener('interactionCreate', modalListener));
    }
};
