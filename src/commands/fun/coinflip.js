const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Lancer une pièce'),

    async execute(interaction) {
        const result = Math.random() < 0.5 ? '🪙 Pile' : '🪙 Face';
        interaction.reply({ content: `**${result}**` });
    }
};
