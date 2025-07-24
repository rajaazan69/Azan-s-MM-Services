const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('error', console.error);

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection:', reason);
});

client.login(process.env.TOKEN);