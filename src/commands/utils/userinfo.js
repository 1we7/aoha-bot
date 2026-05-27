const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Informations sur un membre')
        .addUserOption(opt => opt.setName('membre').setDescription('Membre ciblé')),

    async execute(interaction) {
        const user = interaction.options.getUser('membre') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        const embed = new EmbedBuilder()
            .setTitle(user.username)
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .setColor(0x5865f2)
            .addFields(
                { name: '🆔 ID', value: user.id, inline: true },
                { name: '📅 Compte créé', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '📥 A rejoint le', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'Inconnu', inline: true },
                { name: '🎭 Rôles', value: member ? member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Aucun' : 'Inconnu' }
            );
        interaction.reply({ embeds: [embed] });
    }
};
