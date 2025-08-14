const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing in environment variables");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN).catch(err => {
  console.error("❌ Failed to login:", err);
});