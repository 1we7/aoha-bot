const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwarn')
        .setDescription('Retirer un avertissement d\'un membre')
        .setDefaultMemberPermissions(0)
        .addUserOption(opt => opt.setName('membre').setDescription('Membre ciblé').setRequired(true)),

    async execute(interaction) {
        const user = interaction.options.getUser('membre');

        const warns = db.prepare('SELECT * FROM warns WHERE user_id = ? AND guild_id = ? ORDER BY created_at DESC').all(user.id, interaction.guild.id);

        if (warns.length === 0) {
            return interaction.reply({ content: `✅ <@${user.id}> n'a aucun avertissement.`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle(`⚠️ Warns de ${user.username}`)
            .setColor(0xffa500)
            .setDescription(warns.map((w, i) =>
                `**#${w.id}** — ${w.reason} *(par <@${w.moderator_id}>, <t:${Math.floor(w.created_at / 1000)}:R>)*`
            ).join('\n'));

        const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

        const select = new StringSelectMenuBuilder()
            .setCustomId('unwarn_select')
            .setPlaceholder('Choisir le warn à supprimer')
            .addOptions(warns.map(w => ({
                label: `#${w.id} — ${w.reason.slice(0, 80)}`,
                value: String(w.id)
            })));

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id && i.customId === 'unwarn_select',
            time: 30000,
            max: 1
        });

        collector.on('collect', async i => {
            const warnId = parseInt(i.values[0]);
            db.prepare('DELETE FROM warns WHERE id = ?').run(warnId);
            await i.update({ content: `✅ Warn **#${warnId}** supprimé pour <@${user.id}>.`, embeds: [], components: [] });
        });
    }
};
