require('dotenv').config();
const { Client, GatewayIntentBits } = require("discord.js");
const express = require('express');

// Log startup info
console.log("Bot starting...");
console.log("Token present:", !!process.env.TOKEN);
console.log("Token value (first 10 chars):", process.env.TOKEN?.substring(0, 10));

// Create Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// Attempt login
console.log("Calling client.login...");
client.login(process.env.TOKEN)
    .then(() => console.log("Login promise resolved"))
    .catch(err => {
        console.error("❌ Login failed:", err);
        process.exit(1);
    });

// Keep alive server (needed for Render)
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000, () => {
    console.log(`Listening on port ${process.env.PORT || 3000}`);
});