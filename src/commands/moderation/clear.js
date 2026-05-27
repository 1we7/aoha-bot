const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Suppression de messages en masse (Salons textuels)')
        .setDefaultMemberPermissions(0)
        .addStringOption(opt =>
            opt.setName('nombre')
               .setDescription('Quantité de messages à supprimer (1-100), ou "all" pour tout supprimer')
               .setRequired(true)
        ),

    async execute(interaction) {
        const input = interaction.options.getString('nombre');

        await interaction.deferReply({ ephemeral: true });

        try {
            if (input.toLowerCase() === 'all') {
                let totalDeleted = 0;
                let batch;

                do {
                    batch = await interaction.channel.bulkDelete(100, true);
                    totalDeleted += batch.size;
                } while (batch.size >= 2);

                return interaction.editReply({
                    content: `🧹 Salon vidé avec succès : **${totalDeleted}** messages purgés.`
                });
            }

            const amount = parseInt(input);
            if (isNaN(amount) || amount < 1 || amount > 100) {
                return interaction.editReply({
                    content: '❌ Entrez un nombre entre 1 et 100, ou "all" pour tout supprimer.'
                });
            }

            const messages = await interaction.channel.bulkDelete(amount, true);
            return interaction.editReply({
                content: `🧹 Opération réussie : **${messages.size}** messages purgés.${messages.size < amount ? `\n⚠️ ${amount - messages.size} message(s) ignoré(s) car datant de plus de 14 jours.` : ''}`
            });

        } catch (err) {
            console.error('[clear.js] Erreur :', err);
            return interaction.editReply({
                content: '❌ Erreur lors de la suppression. Les messages de plus de 14 jours ne peuvent pas être supprimés en masse.'
            });
        }
    }
};
