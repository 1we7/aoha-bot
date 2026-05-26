const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Mettre un membre en timeout')
        .addUserOption(opt => opt.setName('membre').setDescription('Membre ciblé').setRequired(true))
        .addStringOption(opt => opt.setName('durée').setDescription('Ex: 10m, 2h, 1j (max 28j)').setRequired(true))
        .addStringOption(opt => opt.setName('raison').setDescription('Motif')),

    async execute(interaction) {
        const user = interaction.options.getUser('membre');
        const input = interaction.options.getString('durée');
        const reason = interaction.options.getString('raison') || 'Aucun motif renseigné.';
        const match = input.match(/^(\d+)([mhj])$/);

        if (!match) return interaction.reply({ content: '❌ Format invalide. Exemples : `10m`, `2h`, `1j`', ephemeral: true });

        const val = parseInt(match[1]);
        const unit = match[2];
        const ms = unit === 'm' ? val * 60000 : unit === 'h' ? val * 3600000 : val * 86400000;

        if (ms > 28 * 24 * 3600000) return interaction.reply({ content: '❌ Maximum 28 jours.', ephemeral: true });

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });

        await member.timeout(ms, reason);
        interaction.reply({ content: `🔇 <@${user.id}> mis en timeout pour **${input}**.\n**Raison :** ${reason}`, ephemeral: true });
    }
};
