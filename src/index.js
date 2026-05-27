const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
require('dotenv').config();

// ==========================================
// 1. SERVEUR EXPRESS POUR PORT RAILWAY
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Aoha Bot est en ligne et opérationnel ! 🚀'));
app.listen(PORT, () => console.log(`[Express] Serveur web actif sur le port ${PORT}`));

// ==========================================
// 2. INITIALISATION DU BOT DISCORD
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

// ==========================================
// 3. BASE DE DONNÉES SQLITE PERSISTANTE
// ==========================================
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'database.sqlite');
let db;

(async () => {
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    console.log(`[SQLite] Connecté à la base de données : ${dbPath}`);
    
    // Exemple de table de configuration (ajoute les tiennes ici)
    await db.exec(`CREATE TABLE IF NOT EXISTS server_config (guildId TEXT PRIMARY KEY, prefix TEXT)`);
})();

// ==========================================
// 4. CHARGEMENT DYNAMIQUE DES COMMANDES
// ==========================================
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath);
}

const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commandsJSON = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsJSON.push(command.data.toJSON());
    } else {
        console.log(`[Attention] La commande ${file} n'a pas les propriétés "data" ou "execute".`);
    }
}

// ==========================================
// 5. ENREGISTREMENT ET CONNEXION
// ==========================================
client.once('ready', async () => {
    console.log(`[Discord] Connecté en tant que ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log(`[Discord] Enregistrement des commandes slash en cours...`);
        
        // Enregistrement global de toutes les commandes chargées
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsJSON },
        );
        
        console.log(`[Discord] Toutes les commandes slash ont été synchronisées !`);
    } catch (error) {
        console.error(`[Erreur] Échec de l'enregistrement des commandes :`, error);
    }
});

// ==========================================
// 6. GESTION DES COMMANDES SLASH IN-GAME
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        // On passe l'interaction et la DB à la commande
        await command.execute(interaction, db);
    } catch (error) {
        console.error(error);
        const errorMessage = { content: 'Une erreur est survenue lors de l\'exécution de cette commande !', ephemeral: true };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

client.login(process.env.TOKEN);
