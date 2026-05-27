const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Avertir un membre')
        .addUserOption(opt =>
            opt.setName('membre').setDescription('Membre à avertir').setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('raison').setDescription('Raison de l\'avertissement').setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('membre');
        const reason = interaction.options.getString('raison');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({ content: '❌ Tu ne peux pas te warn toi-même.', ephemeral: true });
        }

        // Enregistrement en BDD
        db.prepare(`
            INSERT INTO warns (user_id, guild_id, reason, moderator_id, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(user.id, interaction.guild.id, reason, interaction.user.id, Date.now());

        // Compte le total de warns du membre
        const warnCount = db.prepare(
            'SELECT COUNT(*) as count FROM warns WHERE user_id = ? AND guild_id = ?'
        ).get(user.id, interaction.guild.id).count;

        // Notif en MP au membre
        const dmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Avertissement reçu')
            .setColor(0xffa500)
            .addFields(
                { name: 'Serveur', value: interaction.guild.name, inline: true },
                { name: 'Modérateur', value: interaction.user.tag, inline: true },
                { name: 'Raison', value: reason }
            )
            .setTimestamp();

        await member.send({ embeds: [dmEmbed] }).catch(() => null);

        // Confirmation au modérateur
        const replyEmbed = new EmbedBuilder()
            .setTitle('⚠️ Avertissement enregistré')
            .setColor(0xffa500)
            .addFields(
                { name: 'Membre', value: `<@${user.id}>`, inline: true },
                { name: 'Total warns', value: `${warnCount}`, inline: true },
                { name: 'Raison', value: reason }
            )
            .setFooter({ text: `Par ${interaction.user.tag}` })
            .setTimestamp();

        interaction.reply({ embeds: [replyEmbed], ephemeral: true });
    }
};
