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
const PORT = process.env.PORT || 8080;
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
    await db.exec(`CREATE TABLE IF NOT EXISTS server_config (guildId TEXT PRIMARY KEY, prefix TEXT)`);
})();

// ==========================================
// 4. CHARGEMENT DYNAMIQUE DES COMMANDES (AVEC SOUS-DOSSIERS)
// ==========================================
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandsJSON = [];

if (fs.existsSync(commandsPath)) {
    // On lit les sous-dossiers (admin, utils, moderation, etc.)
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        
        // On vérifie que c'est bien un dossier et pas un fichier perdu
        if (fs.lstatSync(folderPath).isDirectory()) {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commandsJSON.push(command.data.toJSON());
                    console.log(`[Succès] [${folder.toUpperCase()}] /${command.data.name} chargé.`);
                } else {
                    console.log(`[Attention] La commande ${file} dans ${folder} n'a pas les propriétés "data" ou "execute".`);
                }
            }
        }
    }
} else {
    console.log(`[Erreur] Le dossier des commandes est introuvable à l'adresse : ${commandsPath}`);
}

// ==========================================
// 5. ENREGISTREMENT ET CONNEXION
// ==========================================
client.once('clientReady', async () => {
    console.log(`[Discord] Connecté en tant que ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log(`[Discord] Enregistrement des commandes slash en cours...`);
        
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsJSON },
        );
        
        console.log(`[Discord] Toutes les commandes slash ont été synchronisées ! Total : ${commandsJSON.length}`);
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
