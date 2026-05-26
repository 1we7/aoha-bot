const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, StringSelectMenuBuilder,
    ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType
} = require('discord.js');
const db = require('../../database');

// --- FONCTION UTILITAIRE : GÉNÉRER LES RANGÉES DE BOUTONS ---
// Gère l'affichage "Texte + Bouton" (Gauche/Droite) ou classique
function buildButtonRows(buttons, disableForPreview = false) {
    const rows = [];
    let currentOutsideRow = new ActionRowBuilder();

    for (const btn of buttons) {
        const actualBtn = new ButtonBuilder()
            .setCustomId(btn.type === 'link' ? undefined : (disableForPreview ? `prev_${btn.id}` : btn.id))
            .setLabel(btn.label || 'Bouton')
            .setStyle(btn.style);
            
        if (btn.type === 'link') actualBtn.setURL(btn.data || 'https://discord.com');
        if (disableForPreview) actualBtn.setDisabled(true);

        // Si le bouton a un layout "intérieur" (Texte à côté)
        if (btn.layout === 'left' || btn.layout === 'right') {
            const ghostBtn = new ButtonBuilder()
                .setCustomId(`ghost_${Math.random().toString(36).slice(2)}`)
                .setLabel(btn.ghostText || ' ')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const mixedRow = new ActionRowBuilder();
            if (btn.layout === 'left') mixedRow.addComponents(ghostBtn, actualBtn);
            if (btn.layout === 'right') mixedRow.addComponents(actualBtn, ghostBtn);
            
            // Les layouts intérieurs prennent une ligne entière pour l'esthétique
            rows.push(mixedRow);
        } else {
            // Layout extérieur (classique)
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

// --- VUE 1 : DASHBOARD PRINCIPAL ---
function renderMain(state) {
    const embed = new EmbedBuilder().setColor(state.color || '#2b2d31');
    if (state.title) embed.setTitle(state.title);
    embed.setDescription(state.description || '*Description vide...*');
    if (state.imageURL) embed.setImage(state.imageURL);
    if (state.thumbnailURL) embed.setThumbnail(state.thumbnailURL);

    // Ligne 1 : Contrôles de l'Embed & Import
    const rowMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('main_menu').setPlaceholder('✏️ Modifier l\'Embed...').addOptions(
            { label: 'Titre', value: 'edit_title', emoji: '📝' },
            { label: 'Description', value: 'edit_desc', emoji: '📄' },
            { label: 'Couleur', value: 'edit_color', emoji: '🎨' },
            { label: 'Images', value: 'edit_images', emoji: '🖼️' },
            { label: 'Importer JSON', value: 'import_json', emoji: '📥' }
        )
    );

    // Ligne 2 : Actions Boutons & Publication
    const rowActions = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('go_add_btn').setLabel('➕ Ajouter un Bouton').setStyle(ButtonStyle.Success).setDisabled(state.buttons.length >= 5),
        new ButtonBuilder().setCustomId('remove_btn').setLabel('🗑️ Suppr. Dernier').setStyle(ButtonStyle.Danger).setDisabled(state.buttons.length === 0),
        new ButtonBuilder().setCustomId('publish').setLabel('🚀 Publier').setStyle(ButtonStyle.Primary).setDisabled(!state.description || !state.channelId)
    );

    // Ligne 3 : Sélection du Salon sans ID
    const rowChannel = new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId('select_channel').setPlaceholder(state.channelId ? '✅ Salon sélectionné (clique pour changer)' : '📢 Choisir le salon d\'envoi').setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
    );

    // On ajoute les boutons de l'utilisateur EN DIRECT sous les menus
    const userButtonRows = buildButtonRows(state.buttons, true); // true = désactivés pour l'aperçu

    // On s'assure de ne pas dépasser 5 rangées (Discord Limit)
    const finalComponents = [rowMenu, rowActions, rowChannel];
    // Si l'utilisateur crée trop de rangées de boutons, on affiche ce qu'on peut
    for (let i = 0; i < userButtonRows.length && finalComponents.length < 5; i++) {
        finalComponents.push(userButtonRows[i]);
    }

    return { content: '**🛠️ Créateur d\'Embed V2**', embeds: [embed], components: finalComponents };
}

// --- VUE 2 : CONSTRUCTEUR DE BOUTON ---
function renderBtnBuilder(state) {
    const btn = state.draftBtn;
    const embed = new EmbedBuilder().setColor('#2b2d31').setTitle('⚙️ Configuration du Bouton')
        .setDescription(`**Aperçu de la configuration actuelle :**\n\n` +
            `**Nom :** ${btn.label}\n**Type :** ${btn.type || '⚠️ Non défini'}\n` +
            `**Disposition :** ${btn.layout}\n**Texte fantôme :** ${btn.ghostText || '*Aucun*'}`);

    // Ligne 1 : Choix du Type
    const typeMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('btn_type').setPlaceholder('1️⃣ Choisir le Type d\'action').addOptions(
            { label: 'Lien Web', value: 'link' }, { label: 'Message Éphémère', value: 'eph' },
            { label: 'Message Privé (MP)', value: 'mp' }, { label: 'Créer un Ticket', value: 'ticket' }
        )
    );

    // Ligne 2 : Choix du Layout
    const layoutMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('btn_layout').setPlaceholder('2️⃣ Choisir la Disposition').addOptions(
            { label: 'Standard (Boutons alignés)', value: 'outside' },
            { label: 'Texte à GAUCHE du bouton', value: 'left' },
            { label: 'Texte à DROITE du bouton', value: 'right' }
        )
    );

    // Ligne 3 : Actions basiques & Config spécifique
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_edit_name').setLabel('Nom & Style').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_edit_ghost').setLabel('Texte Layout').setStyle(ButtonStyle.Secondary).setDisabled(btn.layout === 'outside'),
        new ButtonBuilder().setCustomId('btn_edit_data').setLabel('⚙️ Données (URL/Message)').setStyle(ButtonStyle.Primary).setDisabled(btn.type === 'ticket' || !btn.type)
    );

    // Ligne 4 (Conditionnelle pour Ticket) : Menus Rôle/Catégorie
    let ticketRow = null;
    if (btn.type === 'ticket') {
        ticketRow = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder().setCustomId('btn_ticket_role').setPlaceholder('👤 Rôle Staff (Qui peut voir)'),
            new ChannelSelectMenuBuilder().setCustomId('btn_ticket_category').setPlaceholder('📂 Catégorie de création').setChannelTypes([ChannelType.GuildCategory])
        );
        // Les SelectMenus prennent toute la largeur, on ne peut en mettre qu'un par ActionRow normalement, 
        // mais Discord.js permet certains combos. Pour être sûr, on divise si besoin, mais restons sur une ligne.
        // NOTE: Discord force 1 SelectMenu par ActionRow.
        ticketRow = [
            new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('btn_ticket_role').setPlaceholder('👤 Rôle Staff (Qui peut voir)')),
            new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('btn_ticket_category').setPlaceholder('📂 Catégorie des tickets').setChannelTypes([ChannelType.GuildCategory]))
        ];
    }

    // Ligne de validation
    const finishRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_save').setLabel('✅ Sauvegarder ce bouton').setStyle(ButtonStyle.Success).setDisabled(!btn.type),
        new ButtonBuilder().setCustomId('btn_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Danger)
    );

    const components = [typeMenu, layoutMenu, actionRow];
    if (ticketRow) components.push(...ticketRow);
    // On s'assure de ne pas dépasser 5 (si on a 2 ticketRows, on doit compacter actionRow)
    // Pour éviter le crash, on met finishRow à la place d'actionRow si besoin, mais ici on a max 5 lignes.
    if (components.length < 5) components.push(finishRow);

    return { content: '', embeds: [embed], components: components.slice(0, 5) };
}

// --- LA COMMANDE ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Créer un embed interactif V2 avec composants'),

    async execute(interaction) {
        const state = {
            view: 'main',
            title: '', description: '', color: '#2b2d31', imageURL: '', thumbnailURL: '',
            buttons: [], channelId: null, draftBtn: null
        };

        const msg = await interaction.reply({ ...renderMain(state), ephemeral: true, withResponse: true });
        const collector = msg.resource.message.createMessageComponentCollector({ time: 1800000 }); // 30 minutes

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return;

            // ==========================================
            // LOGIQUE VUE PRINCIPALE
            // ==========================================
            if (state.view === 'main') {
                
                // --- SÉLECTION DE SALON DIRECTE ---
                if (i.isChannelSelectMenu() && i.customId === 'select_channel') {
                    state.channelId = i.values[0];
                    return i.update(renderMain(state));
                }

                // --- GESTION DU MENU PRINCIPAL (Titre, Desc, etc) ---
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
                        const m = new ModalBuilder().setCustomId('m_json').setTitle('Import JSON');
                        m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('val').setLabel('Colle le JSON ici').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                        return i.showModal(m);
                    }
                }

                // --- ACTIONS BOUTONS ---
                if (i.isButton()) {
                    if (i.customId === 'remove_btn') {
                        state.buttons.pop();
                        return i.update(renderMain(state));
                    }
                    if (i.customId === 'go_add_btn') {
                        // Switcher vers la vue Constructeur
                        state.view = 'btn_builder';
                        state.draftBtn = { id: `btn_${Date.now()}`, label: 'Nouveau Bouton', style: ButtonStyle.Primary, type: null, data: '', roleId: null, categoryId: null, layout: 'outside', ghostText: '' };
                        return i.update(renderBtnBuilder(state));
                    }
                    if (i.customId === 'publish') {
                        const targetChannel = interaction.guild.channels.cache.get(state.channelId);
                        if (!targetChannel) return i.reply({ content: '❌ Salon invalide.', ephemeral: true });

                        const finalEmbed = new EmbedBuilder().setColor(state.color).setDescription(state.description);
                        if (state.title) finalEmbed.setTitle(state.title);
                        if (state.imageURL) finalEmbed.setImage(state.imageURL);
                        if (state.thumbnailURL) finalEmbed.setThumbnail(state.thumbnailURL);

                        const finalComponents = buildButtonRows(state.buttons, false); // false = boutons actifs

                        // Enregistrement dans la DB Aoha
                        for (const btn of state.buttons) {
                            if (btn.type !== 'link') {
                                const mapType = btn.type === 'eph' ? 'ephemeral' : btn.type;
                                // Si c'est un ticket, on sauvegarde le rôle et la catégorie dans action_data (JSON)
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

            // ==========================================
            // LOGIQUE VUE CONSTRUCTEUR DE BOUTON
            // ==========================================
            if (state.view === 'btn_builder') {
                if (i.isStringSelectMenu()) {
                    if (i.customId === 'btn_type') state.draftBtn.type = i.values[0];
                    if (i.customId === 'btn_layout') state.draftBtn.layout = i.values[0];
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
                        const m = new ModalBuilder().setCustomId('m_btn_name').setTitle('Nom & Style');
                        m.addComponents(
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Texte du bouton').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.draftBtn.label)),
                            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('style').setLabel('Style (1=Bleu, 2=Gris, 3=Vert, 4=Rouge)').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.draftBtn.style.toString()))
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

        // ==========================================
        // GESTIONNAIRE DE MODALS GLOBAL
        // ==========================================
        const modalListener = async (mInt) => {
            if (!mInt.isModalSubmit() || mInt.user.id !== interaction.user.id) return;

            // Updates Main Dashboard
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
                    if (emb.title) state.title = emb.title;
                    if (emb.description) state.description = emb.description;
                    if (emb.color) state.color = `#${emb.color.toString(16).padStart(6, '0')}`;
                    if (emb.image) state.imageURL = emb.image.url;
                    if (emb.thumbnail) state.thumbnailURL = emb.thumbnail.url;
                } catch (e) {
                    return mInt.reply({ content: '❌ JSON Invalide.', ephemeral: true });
                }
            }

            // Updates Button Builder
            if (mInt.customId === 'm_btn_name') {
                state.draftBtn.label = mInt.fields.getTextInputValue('label');
                state.draftBtn.style = parseInt(mInt.fields.getTextInputValue('style')) || 1;
            }
            if (mInt.customId === 'm_btn_ghost') state.draftBtn.ghostText = mInt.fields.getTextInputValue('text');
            if (mInt.customId === 'm_btn_data') state.draftBtn.data = mInt.fields.getTextInputValue('data');

            // Render depending on current view
            await mInt.update(state.view === 'main' ? renderMain(state) : renderBtnBuilder(state));
        };

        interaction.client.on('interactionCreate', modalListener);
        collector.on('end', () => interaction.client.removeListener('interactionCreate', modalListener));
    }
};
