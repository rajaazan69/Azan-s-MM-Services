const { Client, GatewayIntentBits } = require("discord.js");

console.log("✅ Token found. Length:", process.env.TOKEN.length);
console.log("📡 Sending login request to Discord...");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once("ready", () => {
    console.log(`🚀 Logged in as ${client.user.tag}`);
});

client.on("error", console.error);
client.on("shardError", console.error);

client.login(process.env.TOKEN).catch(err => {
    console.error("❌ Failed to login:", err);
});