const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('choisir')
        .setDescription('Choisir aléatoirement parmi une liste')
        .addStringOption(opt => opt.setName('options').setDescription('Options séparées par des virgules. Ex: pizza,sushi,burger').setRequired(true)),

    async execute(interaction) {
        const input = interaction.options.getString('options');
        const options = input.split(',').map(o => o.trim()).filter(o => o.length > 0);

        if (options.length < 2) return interaction.reply({ content: '❌ Donne au moins 2 options séparées par des virgules.', ephemeral: true });

        const choix = options[Math.floor(Math.random() * options.length)];
        interaction.reply({ content: `🎯 Mon choix : **${choix}**` });
    }
};
