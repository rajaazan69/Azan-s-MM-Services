const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// Create the client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// On ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// Basic ping command
client.on('messageCreate', message => {
    if (message.content.toLowerCase() === '!ping') {
        message.reply('Pong!');
    }
});

// Login
client.login(process.env.TOKEN);