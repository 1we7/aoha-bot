const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleinfo')
        .setDescription('Infos sur un rôle')
        .addRoleOption(opt => opt.setName('role').setDescription('Rôle ciblé').setRequired(true)),

    async execute(interaction) {
        const role = interaction.options.getRole('role');
        const embed = new EmbedBuilder()
            .setTitle(`Rôle : ${role.name}`)
            .setColor(role.color || 0x5865f2)
            .addFields(
                { name: '🆔 ID', value: role.id, inline: true },
                { name: '👥 Membres', value: `${role.members.size}`, inline: true },
                { name: '🎨 Couleur', value: role.hexColor, inline: true },
                { name: '📅 Créé le', value: `<t:${Math.floor(role.createdTimestamp / 1000)}:D>`, inline: true },
                { name: '📌 Mentionnable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
                { name: '🔼 Hissé', value: role.hoist ? 'Oui' : 'Non', inline: true }
            );
        interaction.reply({ embeds: [embed] });
    }
};
