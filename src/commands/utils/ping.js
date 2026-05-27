const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Répond avec la latence du bot !'),
    async execute(interaction, db) {
        const sent = await interaction.reply({ content: 'Calcul du ping...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        
        await interaction.editReply(`🏓 Pong ! Latence API : **${latency}ms**`);
    },
};
