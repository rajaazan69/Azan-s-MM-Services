const { Client, GatewayIntentBits } = require("discord.js");

console.log("🚀 Starting bot...");

// Debug: Check token before doing anything
if (!process.env.TOKEN) {
    console.error("❌ ERROR: TOKEN environment variable is missing!");
    process.exit(1); // Stop bot
} else {
    console.log("✅ Token found. Length:", process.env.TOKEN.length);
}

// Create bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// Log in to Discord
client.login(process.env.TOKEN).catch(err => {
    console.error("❌ Login failed:", err);
});