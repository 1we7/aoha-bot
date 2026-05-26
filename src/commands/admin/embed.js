const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder,
    TextInputBuilder, TextInputStyle, ComponentType
} = require('discord.js');
const db = require('../../database');

// --- FONCTIONS UTILITAIRES (Simples) ---

// 1. Construit l'aperçu de l'embed basé sur l'état actuel
function buildPreview(state) {
    const preview = new EmbedBuilder()
        .setColor(state.color || '#5865f2');

    if (state.title) preview.setTitle(state.title);
    
    // Discord requiert une description ou un titre ou une image au minimum.
    // Pour l'aperçu, on met un placeholder si c'est vide.
    preview.setDescription(state.description || '***Aucune description définie...***\n*(Cliquez sur le bouton 📄 Description pour en ajouter une)*');
    
    if (state.imageURL) preview.setImage(state.imageURL);
    if (state.thumbnailURL) preview.setThumbnail(state.thumbnailURL);
    return preview;
}

// 2. Génère le Dashboard complet (Aperçu + TOUS les boutons de contrôle)
function renderDashboard(state) {
    // L'Aperçu
    const previewEmbed = buildPreview(state);

    // Texte d'info sur les boutons configurés
    let infoText = `**🛠️ Tableau de Bord du Constructeur d'Embed**\n\n🔘 **Boutons configurés : ${state.buttons.length}/5**\n`;
    state.buttons.forEach((b, idx) => {
        infoText += `> **${idx + 1}.** \`${b.label}\` (${b.type})\n`;
    });
    
    if (state.channelId) infoText += `\n📢 **Salon cible :** <#${state.channelId}>`;

    // --- LES COMPOSANTS (L'Interface V2) ---

    // Ligne 1 : Les bases (Titre, Desc, Couleur)
    const rowContent = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('edit_title').setLabel('✏️ Titre').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('edit_desc').setLabel('📄 Description').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('edit_color').setLabel('🎨 Couleur').setStyle(ButtonStyle.Secondary)
    );

    // Ligne 2 : Les visuels (Image, Thumbnail)
    const rowVisuals = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('edit_image').setLabel('🖼️ Image Principale').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('edit_thumb').setLabel('🖼️ Miniature (Thumbnail)').setStyle(ButtonStyle.Secondary)
    );

    // Ligne 3 : La gestion des boutons (Ajouter, Supprimer)
    const rowButtonsActions = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('add_btn').setLabel('➕ Ajouter un Bouton').setStyle(ButtonStyle.Success).setDisabled(state.buttons.length >= 5),
        new ButtonBuilder().setCustomId('remove_btn').setLabel('🗑️ Supprimer Dernier').setStyle(ButtonStyle.Danger).setDisabled(state.buttons.length === 0)
    );

    // Ligne 4 : Publication
    const rowPublish = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pick_channel').setLabel('📢 Choisir Salon').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('publish').setLabel('🚀 Publier l\'Embed').setStyle(ButtonStyle.Success).setDisabled(!state.description || !state.channelId) // Désactivé si pas de desc ou pas de salon
    );

    // On retourne le message complet
    return { 
        content: infoText,
        embeds: [previewEmbed], 
        components: [rowContent, rowVisuals, rowButtonsActions, rowPublish], 
        flags: 64 // Toujours éphémère pour le créateur
    };
}

// --- LA COMMANDE MODULE ---

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Créer un embed interactif via un tableau de bord (V2)'),

    async execute(interaction) {
        // État initial de l'embed
        const state = {
            title: '', description: '', color: '#5865f2',
            imageURL: '', thumbnailURL: '',
            buttons: [], channelId: null
        };

        // Envoi initial du Dashboard
        const msg = await interaction.reply({ ...renderDashboard(state), withResponse: true });
        
        // Collector sur 15 minutes (900000 ms)
        const collector = msg.resource.message.createMessageComponentCollector({ time: 900000 });

        collector.on('collect', async i => {
            // Sécurité : Seul le créateur peut interagir
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: "❌ Cette interface n'est pas pour toi.", flags: 64 });
            }

            // --- GESTION DES MODALS (Au clic sur les boutons) ---

            // ✏️ Titre
            if (i.customId === 'edit_title') {
                const modal = new ModalBuilder().setCustomId('m_title').setTitle('Titre de l\'Embed');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('title').setLabel('Quel est le titre ?').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.title)
                ));
                await i.showModal(modal);
                return; // On stoppe l'exécution ici, le traitement se fait dans l'event modalSubmit
            }

            // 📄 Description
            if (i.customId === 'edit_desc') {
                const modal = new ModalBuilder().setCustomId('m_desc').setTitle('Description de l\'Embed');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('desc').setLabel('Quel est le contenu ?').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(state.description)
                ));
                await i.showModal(modal);
                return;
            }

            // 🎨 Couleur
            if (i.customId === 'edit_color') {
                const modal = new ModalBuilder().setCustomId('m_color').setTitle('Couleur de l\'Embed');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('color').setLabel('Code Hex (ex: #ff0000)').setStyle(TextInputStyle.Short).setRequired(true).setValue(state.color)
                ));
                await i.showModal(modal);
                return;
            }

            // 🖼️ Image Principale
            if (i.customId === 'edit_image') {
                const modal = new ModalBuilder().setCustomId('m_image').setTitle('URL de l\'Image Principale');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('img_url').setLabel('URL Directe (.png, .jpg, etc.)').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.imageURL)
                ));
                await i.showModal(modal);
                return;
            }

            // 🖼️ Thumbnail
            if (i.customId === 'edit_thumb') {
                const modal = new ModalBuilder().setCustomId('m_thumb').setTitle('URL de la Miniature');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('thumb_url').setLabel('URL Directe (.png, .jpg, etc.)').setStyle(TextInputStyle.Short).setRequired(false).setValue(state.thumbnailURL)
                ));
                await i.showModal(modal);
                return;
            }

            // 📢 Choisir Salon
            if (i.customId === 'pick_channel') {
                const modal = new ModalBuilder().setCustomId('m_channel').setTitle('Salon de publication');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('channel_id').setLabel("ID du salon").setStyle(TextInputStyle.Short).setRequired(true).setValue(state.channelId || '')
                ));
                await i.showModal(modal);
                return;
            }

            // ➕ Ajouter un Bouton (Ta structure Modal complexe d'origine)
            if (i.customId === 'add_btn') {
                const modal = new ModalBuilder().setCustomId('m_btn_add').setTitle('Configurer le nouveau bouton');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Texte du bouton').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('type').setLabel('Type : link / mp / eph / ticket').setStyle(TextInputStyle.Short).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('data').setLabel('URL ou contenu (selon le type)').setStyle(TextInputStyle.Short).setRequired(false)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Texte affiché à côté (optionnel)').setStyle(TextInputStyle.Short).setRequired(false))
                );
                await i.showModal(modal);
                return;
            }

            // --- ACTIONS DIRECTES (Sans Modal) ---

            // 🗑️ Supprimer dernier bouton
            if (i.customId === 'remove_btn') {
                state.buttons.pop();
                return i.update(renderDashboard(state)); // Mise à jour immédiate
            }

            // 🚀 PUBLICATION (Logique d'origine conservée)
            if (i.customId === 'publish') {
                const targetChannel = interaction.guild.channels.cache.get(state.channelId);
                if (!targetChannel) return i.reply({ content: '❌ Salon introuvable.', flags: 64 });

                // Construction de l'embed final (sans le placeholder)
                const finalEmbed = new EmbedBuilder().setColor(state.color);
                if (state.title) finalEmbed.setTitle(state.title);
                finalEmbed.setDescription(state.description); // Requis par le dashboard donc safe ici
                if (state.imageURL) finalEmbed.setImage(state.imageURL);
                if (state.thumbnailURL) finalEmbed.setThumbnail(state.thumbnailURL);

                // Construction des composants finaux (Ta logique d'origine pour les boutons fantômes + DB)
                const finalComponents = [];
                for (const btn of state.buttons) {
                    const row = new ActionRowBuilder();
                    if (btn.text) {
                        row.addComponents(new ButtonBuilder().setCustomId(`ghst_${Date.now()}`).setLabel(btn.text).setStyle(ButtonStyle.Secondary).setDisabled(true));
                    }
                    const actualBtn = new ButtonBuilder().setLabel(btn.label);
                    if (btn.type === 'link') {
                        actualBtn.setStyle(ButtonStyle.Link).setURL(btn.data || 'https://discord.com');
                    } else {
                        actualBtn.setStyle(ButtonStyle.Primary).setCustomId(btn.id);
                        const mapType = btn.type === 'eph' ? 'ephemeral' : btn.type;
                        db.prepare('INSERT OR REPLACE INTO custom_buttons (custom_id, action_type, action_data, guild_id) VALUES (?, ?, ?, ?)').run(btn.id, mapType, btn.data, interaction.guild.id);
                    }
                    row.addComponents(actualBtn);
                    finalComponents.push(row);
                }

                await targetChannel.send({ embeds: [finalEmbed], components: finalComponents });
                await i.update({ content: `✅ Embed publié !`, embeds: [], components: [] });
                collector.stop();
            }
        });

        // --- GESTIONNAIRE DE RÉPONSES AUX MODALS ---
        // discord.js ne gère pas nativement interactionCreate dans un collector existant.
        // On écoute l'événement global mais on le filtre pour ce créateur spécifique.

        const modalListener = async (mInteraction) => {
            if (!mInteraction.isModalSubmit()) return;
            if (mInteraction.user.id !== interaction.user.id) return; // Sécurité
            if (!mInteraction.customId.startsWith('m_')) return; // Filtre nos modals de création

            // Traitement selon le modal
            if (mInteraction.customId === 'm_title') state.title = mInteraction.fields.getTextInputValue('title');
            if (mInteraction.customId === 'm_desc') state.description = mInteraction.fields.getTextInputValue('desc');
            if (mInteraction.customId === 'm_color') {
                const val = mInteraction.fields.getTextInputValue('color').trim();
                state.color = val.startsWith('#') ? val : `#${val}`;
            }
            if (mInteraction.customId === 'm_image') state.imageURL = mInteraction.fields.getTextInputValue('img_url').trim();
            if (mInteraction.customId === 'm_thumb') state.thumbnailURL = mInteraction.fields.getTextInputValue('thumb_url').trim();
            if (mInteraction.customId === 'm_channel') state.channelId = mInteraction.fields.getTextInputValue('channel_id').trim();
            
            if (mInteraction.customId === 'm_btn_add') {
                state.buttons.push({
                    id: `btn_${Date.now()}`,
                    label: mInteraction.fields.getTextInputValue('label'),
                    type: mInteraction.fields.getTextInputValue('type').toLowerCase().trim(),
                    data: mInteraction.fields.getTextInputValue('data').trim(),
                    text: mInteraction.fields.getTextInputValue('text').trim()
                });
            }

            // MISE À JOUR DU DASHBOARD AVEC LES NOUVELLES DONNÉES
            await mInteraction.update(renderDashboard(state));
        };

        // On active l'écouteur de modals
        interaction.client.on('interactionCreate', modalListener);

        // Nettoyage de l'écouteur si le collector expire
        collector.on('end', () => {
            interaction.client.removeListener('interactionCreate', modalListener);
        });
    }
};
