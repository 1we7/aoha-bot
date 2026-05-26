const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dé')
        .setDescription('Lancer un ou plusieurs dés')
        .addStringOption(opt => opt.setName('format').setDescription('Ex: 1d6, 2d20, 3d8').setRequired(true)),

    async execute(interaction) {
        const input = interaction.options.getString('format');
        const match = input.match(/^(\d+)d(\d+)$/i);

        if (!match) return interaction.reply({ content: '❌ Format invalide. Exemples : `1d6`, `2d20`', ephemeral: true });

        const count = parseInt(match[1]);
        const faces = parseInt(match[2]);

        if (count < 1 || count > 20) return interaction.reply({ content: '❌ Entre 1 et 20 dés maximum.', ephemeral: true });
        if (faces < 2 || faces > 1000) return interaction.reply({ content: '❌ Entre 2 et 1000 faces.', ephemeral: true });

        const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
        const total = rolls.reduce((a, b) => a + b, 0);

        const embed = new EmbedBuilder()
            .setTitle(`🎲 ${input}`)
            .setColor(0x5865f2)
            .addFields(
                { name: 'Résultats', value: rolls.join(', '), inline: true },
                { name: 'Total', value: `**${total}**`, inline: true }
            );
        interaction.reply({ embeds: [embed] });
    }
};
