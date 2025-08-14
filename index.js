const { Client, GatewayIntentBits } = require("discord.js");

const TOKEN = process.env.TOKEN || ""; // For Render, make sure this is set in Environment Variables

console.log("🚀 Starting bot...");

if (!TOKEN) {
    console.error("❌ No token found! Set the TOKEN in environment variables.");
    process.exit(1);
}

console.log(`✅ Token found. Length: ${TOKEN.length}`);
console.log(`🔍 First 10 chars of token: ${TOKEN.slice(0, 10)}...`);

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    ws: { properties: { browser: "Discord Android" } } // Spoof client properties to bypass possible Render detection
});

client.on("debug", m => console.log("🪲 DEBUG:", m));
client.on("warn", m => console.warn("⚠️ WARN:", m));
client.on("error", e => console.error("💥 ERROR:", e));
client.on("shardError", e => console.error("💥 SHARD ERROR:", e));

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🌐 Connected to ${client.guilds.cache.size} guild(s)`);
});

(async () => {
    try {
        console.log("📡 Sending login request to Discord...");
        await client.login(TOKEN);
        console.log("📨 Login attempt completed.");
    } catch (err) {
        console.error("❌ Login failed:", err);
    }
})();