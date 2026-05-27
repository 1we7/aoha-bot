const { Events, REST, Routes } = require('discord.js');
const db = require('../database');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Statut opérationnel : Connecté sur le compte ${client.user.tag}`);

        // ── Deploy des slash commands ──────────────────────────────────────
        try {
            const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
            console.log(`Déploiement de ${client.commandsData.length} commandes...`);

            // On vide d'abord les commandes globales (résidu éventuel)
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: [] }
            );

            // On déploie toutes les commandes sur le serveur
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: client.commandsData }
            );

            console.log(`✅ ${client.commandsData.length} commandes déployées avec succès.`);
        } catch (error) {
            console.error('Erreur lors du déploiement des commandes :', error);
        }

        // ── Cache des invitations ──────────────────────────────────────────
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
            try {
                const invites = await guild.invites.fetch();
                client.invitesCache.set(guild.id, new Map(invites.map(inv => [inv.code, inv.uses])));
            } catch (err) {
                console.error('Échec lors de la mise en cache des invitations.');
            }
        }

        // ── Débannissements automatiques ───────────────────────────────────
        setInterval(async () => {
            const now = Date.now();
            const expiredBans = db.prepare('SELECT * FROM temp_bans WHERE expires_at <= ?').all(now);

            for (const ban of expiredBans) {
                const guildBan = client.guilds.cache.get(ban.guild_id);
                if (guildBan) {
                    try {
                        await guildBan.members.unban(ban.user_id, 'Fin de la période de bannissement temporaire.');
                    } catch (e) {
                        console.error(`Erreur unban auto [${ban.user_id}]: ${e.message}`);
                    }
                }
                db.prepare('DELETE FROM temp_bans WHERE user_id = ? AND guild_id = ?').run(ban.user_id, ban.guild_id);
            }
        }, 60000);
    },
};
