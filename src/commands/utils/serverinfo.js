const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Informations sur le serveur'),

    async execute(interaction) {
        const g = interaction.guild;
        await g.fetch();
        const embed = new EmbedBuilder()
            .setTitle(g.name)
            .setThumbnail(g.iconURL({ size: 256 }))
            .setColor(0x5865f2)
            .addFields(
                { name: '👑 Propriétaire', value: `<@${g.ownerId}>`, inline: true },
                { name: '👥 Membres', value: `${g.memberCount}`, inline: true },
                { name: '🚀 Boosts', value: `${g.premiumSubscriptionCount}`, inline: true },
                { name: '📅 Créé le', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '🆔 ID', value: g.id, inline: true }
            );
        interaction.reply({ embeds: [embed] });
    }
};
