const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

// --- Keep-alive server for Render ---
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// --- Discord Bot Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

console.log("Bot starting...");

// Check token presence
if (!process.env.TOKEN) {
  console.error("❌ ERROR: No TOKEN found in environment variables.");
  process.exit(1);
} else {
  console.log("Token present: true");
  console.log("Token value (first 10 chars):", process.env.TOKEN.substring(0, 10));
}

// Bot ready event
client.once("ready", () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

// Login to Discord
console.log("Calling client.login...");
client.login(process.env.TOKEN).catch(err => {
  console.error("❌ Failed to login:", err);
});