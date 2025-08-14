const { Client, GatewayIntentBits } = require("discord.js");

console.log("🚀 Starting minimal login test...");

// Create client
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Ready event
client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    process.exit(0); // Close after success
});

// Login
const TOKEN = process.env.TOKEN || "PASTE_YOUR_TOKEN_HERE";
console.log(`📡 Logging in with token length: ${TOKEN.length}`);
client.login(TOKEN).catch(err => {
    console.error("❌ Login error:", err);
    process.exit(1);
});