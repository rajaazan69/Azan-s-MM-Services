const { Client, GatewayIntentBits } = require("discord.js");

console.log("Bot starting...");
console.log("Token present:", !!process.env.TOKEN);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN)
    .catch(err => {
        console.error("❌ Login failed:", err);
        process.exit(1);
    });