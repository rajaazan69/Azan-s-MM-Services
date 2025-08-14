const { Client, GatewayIntentBits } = require("discord.js");

console.log("Bot starting...");
console.log("Token present:", !!process.env.TOKEN);
console.log("Token value (first 10 chars):", process.env.TOKEN?.substring(0, 10));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

console.log("Calling client.login...");
client.login(process.env.TOKEN)
    .then(() => console.log("Login promise resolved"))
    .catch(err => {
        console.error("❌ Login failed:", err);
        process.exit(1);
    });