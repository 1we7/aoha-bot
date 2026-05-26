const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sondage')
        .setDescription('Créer un sondage')
        .addStringOption(opt => opt.setName('question').setDescription('La question du sondage').setRequired(true)),

    async execute(interaction) {
        const question = interaction.options.getString('question');

        const embed = new EmbedBuilder()
            .setTitle('📊 Sondage')
            .setDescription(question)
            .setColor(0x5865f2)
            .setFooter({ text: `Sondage créé par ${interaction.user.username}` })
            .addFields(
                { name: '✅ Pour', value: '0 vote', inline: true },
                { name: '❌ Contre', value: '0 vote', inline: true }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('poll_yes').setLabel('✅ Pour').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('poll_no').setLabel('❌ Contre').setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const votes = { yes: new Set(), no: new Set() };

        const collector = msg.createMessageComponentCollector({ time: 24 * 3600000 });

        collector.on('collect', async i => {
            const userId = i.user.id;

            if (i.customId === 'poll_yes') {
                votes.no.delete(userId);
                if (votes.yes.has(userId)) {
                    votes.yes.delete(userId);
                } else {
                    votes.yes.add(userId);
                }
            } else {
                votes.yes.delete(userId);
                if (votes.no.has(userId)) {
                    votes.no.delete(userId);
                } else {
                    votes.no.add(userId);
                }
            }

            const updatedEmbed = EmbedBuilder.from(i.message.embeds[0])
                .setFields(
                    { name: '✅ Pour', value: `${votes.yes.size} vote(s)`, inline: true },
                    { name: '❌ Contre', value: `${votes.no.size} vote(s)`, inline: true }
                );

            await i.update({ embeds: [updatedEmbed], components: [row] });
        });
    }
};
