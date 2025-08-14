require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

console.log(`Token from ENV: "${process.env.TOKEN}"`); // To verify it’s loaded

if (!process.env.TOKEN) {
    console.error("❌ No token found in .env");
    process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN).catch(err => {
    console.error("❌ Login failed:", err);
});