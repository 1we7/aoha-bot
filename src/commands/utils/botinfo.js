const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ──────────────────────────────────────────────
//  Définition des pages du /botinfo
// ──────────────────────────────────────────────
function buildPages(client) {
    const tag = client.user.tag;
    const avatar = client.user.displayAvatarURL({ size: 256 });
    const color = 0x5865f2;
    const uptime = formatUptime(client.uptime);

    const pages = [
        // PAGE 1 — Accueil
        new EmbedBuilder()
            .setColor(color)
            .setThumbnail(avatar)
            .setTitle(`🤖 ${tag} — Présentation`)
            .setDescription(
                `Bienvenue sur le panneau d'aide du bot !\n\n` +
                `Navigue avec les boutons **◀ ▶** pour voir toutes les commandes.\n\n` +
                `> 📌 **Page 2** — Commandes utilitaires (tout le monde)\n` +
                `> 🎲 **Page 3** — Commandes fun (tout le monde)\n` +
                `> 🔨 **Page 4** — Modération (Staff uniquement)\n` +
                `> ⚙️ **Page 5** — Administration (Staff uniquement)`
            )
            .addFields(
                { name: '⏱️ Uptime', value: uptime, inline: true },
                { name: '📡 Latence', value: `${client.ws.ping}ms`, inline: true },
                { name: '🏠 Serveur', value: client.guilds.cache.first()?.name ?? 'N/A', inline: true }
            )
            .setFooter({ text: 'Page 1 / 5' }),

        // PAGE 2 — Utilitaires
        new EmbedBuilder()
            .setColor(color)
            .setTitle('📌 Commandes utilitaires')
            .setDescription('Accessibles par **tout le monde**.')
            .addFields(
                { name: '`/ping`', value: 'Affiche la latence du bot.', inline: true },
                { name: '`/avatar [membre]`', value: 'Affiche l\'avatar d\'un membre.', inline: true },
                { name: '`/userinfo [membre]`', value: 'Infos détaillées sur un membre.', inline: true },
                { name: '`/serverinfo`', value: 'Infos sur le serveur.', inline: true },
                { name: '`/roleinfo <rôle>`', value: 'Infos sur un rôle.', inline: true },
                { name: '`/rappel <durée> <message>`', value: 'Se faire rappeler quelque chose. (`10m`, `2h`, `1j`)', inline: true },
                { name: '`/mp <membre> <message>`', value: 'Envoyer un MP via le bot.', inline: true },
            )
            .setFooter({ text: 'Page 2 / 5' }),

        // PAGE 3 — Fun
        new EmbedBuilder()
            .setColor(color)
            .setTitle('🎲 Commandes fun')
            .setDescription('Accessibles par **tout le monde**.')
            .addFields(
                { name: '`/8ball <question>`', value: 'Pose une question à la boule magique.', inline: true },
                { name: '`/coinflip`', value: 'Lance une pièce (pile ou face).', inline: true },
                { name: '`/de <format>`', value: 'Lance des dés. Ex: `1d6`, `2d20`.', inline: true },
                { name: '`/rps <choix>`', value: 'Pierre Feuille Ciseaux contre le bot.', inline: true },
                { name: '`/choisir <options>`', value: 'Choisit aléatoirement parmi une liste (séparée par des virgules).', inline: true },
            )
            .setFooter({ text: 'Page 3 / 5' }),

        // PAGE 4 — Modération
        new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🔨 Commandes de modération')
            .setDescription('⚠️ Réservées aux **Administrateurs** et rôles **Staff**.')
            .addFields(
                { name: '`/warn <membre> <raison>`', value: 'Avertir un membre (enregistré en BDD).', inline: true },
                { name: '`/unwarn <membre>`', value: 'Retirer un avertissement.', inline: true },
                { name: '`/timeout <membre> <durée>`', value: 'Mettre en timeout. (`10m`, `2h`, `1j` — max 28j)', inline: true },
                { name: '`/mute <membre>`', value: 'Rendre muet un membre.', inline: true },
                { name: '`/unmute <membre>`', value: 'Retirer le mute d\'un membre.', inline: true },
                { name: '`/ban <membre>`', value: 'Bannir un membre (temporaire possible).', inline: true },
                { name: '`/unban <userid>`', value: 'Débannir un utilisateur par son ID.', inline: true },
                { name: '`/kicks <user1> ...`', value: 'Expulser jusqu\'à 5 membres simultanément.', inline: true },
                { name: '`/clear <nombre>`', value: 'Supprimer des messages en masse.', inline: true },
                { name: '`/lock`', value: 'Verrouiller le salon (lecture seule).', inline: true },
                { name: '`/unlock`', value: 'Déverrouiller le salon.', inline: true },
                { name: '`/slowmode <secondes>`', value: 'Définir le slowmode (0 pour désactiver).', inline: true },
                { name: '`/nuke`', value: '💥 Recrée le salon à l\'identique (purge totale).', inline: true },
                { name: '`/sondage <question>`', value: 'Créer un sondage Pour / Contre.', inline: true },
            )
            .setFooter({ text: 'Page 4 / 5' }),

        // PAGE 5 — Admin
        new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle('⚙️ Commandes d\'administration')
            .setDescription('⚠️ Réservées aux **Administrateurs** et rôles **Staff**.')
            .addFields(
                { name: '`/role <add|remove> <@rôle>`', value: 'Ajouter ou retirer un rôle Staff enregistré.', inline: true },
                { name: '`/embed`', value: 'Créer et envoyer un embed personnalisé dans un salon.', inline: true },
                { name: '`/botinfo`', value: 'Afficher ce panneau d\'aide.', inline: true },
            )
            .setFooter({ text: 'Page 5 / 5' }),
    ];

    return pages;
}

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}j ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}min`;
    if (m > 0) return `${m}min`;
    return `${s}s`;
}

function buildRow(page, total, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('botinfo_prev')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || page === 0),
        new ButtonBuilder()
            .setCustomId('botinfo_next')
            .setEmoji('▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || page === total - 1),
        new ButtonBuilder()
            .setCustomId('botinfo_close')
            .setLabel('Fermer')
            .setEmoji('✖️')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
}

// ──────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Affiche toutes les commandes du bot avec leurs explications'),

    async execute(interaction) {
        const pages = buildPages(interaction.client);
        let currentPage = 0;

        const msg = await interaction.reply({
            embeds: [pages[currentPage]],
            components: [buildRow(currentPage, pages.length)],
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 3 * 60 * 1000 // 3 minutes
        });

        collector.on('collect', async i => {
            if (i.customId === 'botinfo_prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'botinfo_next') {
                currentPage = Math.min(pages.length - 1, currentPage + 1);
            } else if (i.customId === 'botinfo_close') {
                collector.stop('closed');
                return i.update({
                    embeds: [pages[currentPage]],
                    components: [buildRow(currentPage, pages.length, true)]
                });
            }

            await i.update({
                embeds: [pages[currentPage]],
                components: [buildRow(currentPage, pages.length)]
            });
        });

        collector.on('end', async (_, reason) => {
            if (reason !== 'closed') {
                await msg.edit({
                    components: [buildRow(currentPage, pages.length, true)]
                }).catch(() => null);
            }
        });
    }
};
