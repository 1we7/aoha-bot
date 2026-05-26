const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('Recrée le salon à l\'identique et supprime l\'ancien (purge totale)'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const guild = interaction.guild;

        try {
            // Sauvegarde des infos du salon
            const name = channel.name;
            const topic = channel.topic || null;
            const nsfw = channel.nsfw;
            const rateLimitPerUser = channel.rateLimitPerUser;
            const parent = channel.parent || null;
            const position = channel.position;
            const permissionOverwrites = channel.permissionOverwrites.cache.map(overwrite => ({
                id: overwrite.id,
                type: overwrite.type,
                allow: overwrite.allow.toArray(),
                deny: overwrite.deny.toArray()
            }));

            // Crée le nouveau salon
            const newChannel = await guild.channels.create({
                name,
                type: channel.type,
                topic,
                nsfw,
                rateLimitPerUser,
                parent,
                permissionOverwrites,
                position
            });

            // Supprime l'ancien salon
            await channel.delete();

            // Confirmation dans le nouveau salon
            await newChannel.send({ content: '💥 Salon nucléarisé avec succès.' });

        } catch (err) {
            console.error('[nuke.js] Erreur :', err);
            return interaction.editReply({
                content: `❌ Erreur lors du nuke : \`${err.message}\``
            });
        }
    }
};
