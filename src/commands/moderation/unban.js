const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Débannir un utilisateur')
        .setDefaultMemberPermissions(0)
        .addStringOption(opt => opt.setName('userid').setDescription('ID de l\'utilisateur à débannir').setRequired(true))
        .addStringOption(opt => opt.setName('raison').setDescription('Motif')),

    async execute(interaction) {
        const userId = interaction.options.getString('userid');
        const reason = interaction.options.getString('raison') || 'Aucun motif renseigné.';

        try {
            await interaction.guild.members.unban(userId, reason);
            db.prepare('DELETE FROM temp_bans WHERE user_id = ? AND guild_id = ?').run(userId, interaction.guild.id);
            interaction.reply({ content: `✅ L'utilisateur <@${userId}> a été débanni.\n**Raison :** ${reason}` });
        } catch {
            interaction.reply({ content: '❌ Impossible de débannir cet utilisateur. Vérifie que l\'ID est correct et qu\'il est bien banni.', ephemeral: true });
        }
    }
};
