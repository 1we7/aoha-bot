const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Affiche l\'avatar d\'un membre')
        .addUserOption(opt => opt.setName('membre').setDescription('Membre ciblé')),

    async execute(interaction) {
        const user = interaction.options.getUser('membre') || interaction.user;
        const embed = new EmbedBuilder()
            .setTitle(`Avatar de ${user.username}`)
            .setImage(user.displayAvatarURL({ size: 512 }))
            .setColor(0x5865f2);
        interaction.reply({ embeds: [embed] });
    }
};
