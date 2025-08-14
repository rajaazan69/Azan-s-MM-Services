const { Client, GatewayIntentBits } = require("discord.js");

const TOKEN = process.env.TOKEN; // or paste token directly for test

console.log("🚀 Starting bot...");
console.log(`✅ Token found. Length: ${TOKEN.length}`);

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.on("debug", console.log); // Log debug info
client.on("error", console.error);
client.on("shardError", console.error);

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN)
    .then(() => console.log("📡 Login request sent to Discord..."))
    .catch(err => console.error("❌ Login failed immediately:", err));