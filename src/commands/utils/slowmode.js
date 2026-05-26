const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Définir le slowmode du salon')
        .addIntegerOption(opt => opt.setName('secondes').setDescription('Délai en secondes (0 pour désactiver)').setRequired(true).setMinValue(0).setMaxValue(21600)),

    async execute(interaction) {
        const seconds = interaction.options.getInteger('secondes');
        await interaction.channel.setRateLimitPerUser(seconds);
        interaction.reply({
            content: seconds === 0 ? '✅ Slowmode désactivé.' : `✅ Slowmode défini à **${seconds} secondes**.`,
            ephemeral: true
        });
    }
};
