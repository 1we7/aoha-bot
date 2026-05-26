const { SlashCommandBuilder } = require('discord.js');

const choix = ['🪨 Pierre', '📄 Feuille', '✂️ Ciseaux'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Pierre Feuille Ciseaux contre le bot')
        .addStringOption(opt =>
            opt.setName('choix').setDescription('Ton choix').setRequired(true)
                .addChoices(
                    { name: '🪨 Pierre', value: 'pierre' },
                    { name: '📄 Feuille', value: 'feuille' },
                    { name: '✂️ Ciseaux', value: 'ciseaux' }
                )
        ),

    async execute(interaction) {
        const joueur = interaction.options.getString('choix');
        const botIdx = Math.floor(Math.random() * 3);
        const bot = ['pierre', 'feuille', 'ciseaux'][botIdx];

        let result;
        if (joueur === bot) result = '🤝 Égalité !';
        else if (
            (joueur === 'pierre' && bot === 'ciseaux') ||
            (joueur === 'feuille' && bot === 'pierre') ||
            (joueur === 'ciseaux' && bot === 'feuille')
        ) result = '🎉 Tu gagnes !';
        else result = '😈 Le bot gagne !';

        interaction.reply({
            content: `Tu as choisi **${choix[['pierre','feuille','ciseaux'].indexOf(joueur)]}**\nLe bot choisit **${choix[botIdx]}**\n\n${result}`
        });
    }
};
