require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

client.commands = new Collection();
client.voiceJoinTimes = new Map();
client.invitesCache = new Map();

// Handler de commandes récursif pour lire les sous-dossiers
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);
const commandsData = [];

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(folderPath, file));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commandsData.push(command.data.toJSON());
        }
    }
}

// Handler d'événements
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Auto-deploy des commandes au démarrage
async function deployCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        console.log(`Déploiement de ${commandsData.length} commandes...`);
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commandsData }
        );
        console.log('Commandes déployées avec succès.');
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes :', error);
    }
}

client.once('ready', async () => {
    await deployCommands();
});

client.login(process.env.TOKEN);
