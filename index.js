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
const PORT = process.env.PORT || 8080; // Mis sur 8080 comme dans tes logs
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
    
    // Création des tables de base si elles n'existent pas
    await db.exec(`CREATE TABLE IF NOT EXISTS server_config (guildId TEXT PRIMARY KEY, prefix TEXT)`);
})();

// ==========================================
// 4. CHARGEMENT DYNAMIQUE DES COMMANDES (MODE DEBUG)
// ==========================================
const commandsJSON = [];
// On retire la sécurité qui crée un dossier vide pour forcer l'affichage de l'erreur
const commandsPath = path.join(__dirname, 'src', 'commands');

if (!fs.existsSync(commandsPath)) {
    console.log(`[ERREUR FATALE] Le bot ne trouve pas le dossier : ${commandsPath}`);
    console.log(`[DEBUG] Voici les dossiers qu'il voit à la racine :`, fs.readdirSync(__dirname).filter(f => !f.startsWith('.')));
    
    const srcPath = path.join(__dirname, 'src');
    if (fs.existsSync(srcPath)) {
        console.log(`[DEBUG] Et voici ce qu'il voit dans le dossier src/ :`, fs.readdirSync(srcPath));
    }
} else {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    console.log(`[INFO] Trouvé ${commandFiles.length} fichiers dans le dossier src/commands !`);
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commandsJSON.push(command.data.toJSON());
            console.log(`[Succès] Commande chargée : /${command.data.name}`);
        } else {
            console.log(`[Attention] Le fichier ${file} n'a pas la bonne structure de commande.`);
        }
    }
}

// ==========================================
// 5. ENREGISTREMENT ET CONNEXION
// ==========================================
client.once('clientReady', async () => { // clientReady remplace ready pour éviter le warning
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
        // On passe l'interaction et la base de données à la commande
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

// Connexion du bot avec le token de Railway
client.login(process.env.TOKEN);
