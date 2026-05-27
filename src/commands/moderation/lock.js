const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Verrouille le salon (plus personne ne peut écrire)')
        .setDefaultMemberPermissions(0),

    async execute(interaction) {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        interaction.reply({ content: '🔒 Salon verrouillé.', ephemeral: true });
    }
};
