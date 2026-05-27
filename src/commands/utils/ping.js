const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Latence du bot'),

    async execute(interaction) {
        const sent = await interaction.reply({ content: '🏓 Calcul...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        interaction.editReply(`🏓 Pong ! Latence : **${latency}ms** | API : **${interaction.client.ws.ping}ms**`);
    }
};
