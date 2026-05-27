const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Déverrouille le salon')
        .setDefaultMemberPermissions(0),

    async execute(interaction) {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
        interaction.reply({ content: '🔓 Salon déverrouillé.', ephemeral: true });
    }
};
