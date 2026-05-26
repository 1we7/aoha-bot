const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const reponses = [
    '✅ Oui, absolument.', '✅ C\'est certain.', '✅ Sans aucun doute.',
    '🤔 Peut-être.', '🤔 Difficile à dire.', '🤔 Repose la question.',
    '❌ Non.', '❌ Très peu probable.', '❌ Certainement pas.'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Pose une question à la boule magique')
        .addStringOption(opt => opt.setName('question').setDescription('Ta question').setRequired(true)),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const reponse = reponses[Math.floor(Math.random() * reponses.length)];
        const embed = new EmbedBuilder()
            .setTitle('🎱 Boule Magique')
            .addFields(
                { name: '❓ Question', value: question },
                { name: '💬 Réponse', value: reponse }
            )
            .setColor(0x5865f2);
        interaction.reply({ embeds: [embed] });
    }
};
