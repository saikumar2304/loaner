const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { detectProfileCommand } = require('./src/detectProfile'); // Import detectProfile logic

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Create a Collection to store commands
client.commands = new Collection();

// Load command files from the src folder
const commandFiles = fs.readdirSync(path.join(__dirname, 'src')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./src/${file}`);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
    }
}

// Ready event: Sync the slash commands with Discord
client.once('ready', async () => {
    try {
        await client.application.commands.set(client.commands.map(cmd => cmd.data));
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
    console.log(`Logged in as ${client.user.tag}`);
});

// Handle slash command interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing command ${interaction.commandName}:`, error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

// Call the message listener from detectProfile.js
detectProfileCommand(client);

// Login to Discord
client.login(process.env.BOT_TOKEN);
