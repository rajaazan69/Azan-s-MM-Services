require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot is ready: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
  .then(() => console.log("✅ Login successful"))
  .catch((err) => console.error("❌ Login failed:", err));