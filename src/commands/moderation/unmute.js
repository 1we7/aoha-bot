const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Retirer le timeout d\'un membre')
        .addUserOption(opt => opt.setName('membre').setDescription('Membre ciblé').setRequired(true))
        .addStringOption(opt => opt.setName('raison').setDescription('Motif')),

    async execute(interaction) {
        const user = interaction.options.getUser('membre');
        const reason = interaction.options.getString('raison') || 'Aucun motif renseigné.';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });

        if (!member.isCommunicationDisabled()) {
            return interaction.reply({ content: '❌ Ce membre n\'est pas en timeout.', ephemeral: true });
        }

        await member.timeout(null, reason);
        interaction.reply({ content: `✅ Timeout retiré pour <@${user.id}>.\n**Raison :** ${reason}` });
    }
};
