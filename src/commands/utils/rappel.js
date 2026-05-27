const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rappel')
        .setDescription('Se faire rappeler quelque chose après un délai')
        .addStringOption(opt => opt.setName('durée').setDescription('Ex: 10m, 2h, 1j').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Ce dont tu veux être rappelé').setRequired(true)),

    async execute(interaction) {
        const input = interaction.options.getString('durée');
        const msg = interaction.options.getString('message');
        const match = input.match(/^(\d+)([mhj])$/);

        if (!match) return interaction.reply({ content: '❌ Format invalide. Exemples : `10m`, `2h`, `1j`', ephemeral: true });

        const val = parseInt(match[1]);
        const unit = match[2];
        const ms = unit === 'm' ? val * 60000 : unit === 'h' ? val * 3600000 : val * 86400000;

        if (ms > 7 * 24 * 3600000) return interaction.reply({ content: '❌ Maximum 7 jours.', ephemeral: true });

        await interaction.reply({ content: `⏰ Rappel enregistré ! Je te ping dans **${input}**.`, ephemeral: true });

        setTimeout(async () => {
            try {
                await interaction.user.send(`⏰ **Rappel :** ${msg}`);
            } catch {
                await interaction.channel.send(`⏰ <@${interaction.user.id}> **Rappel :** ${msg}`);
            }
        }, ms);
    }
};
