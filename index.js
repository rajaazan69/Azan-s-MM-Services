// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

const mongoClient = new MongoClient(process.env.MONGO_URI);
mongoClient.connect().then(() => {
  client.db = mongoClient.db('ticketbot');
  console.log('✅ Connected to MongoDB Atlas');
}).catch(console.error);

// Express server
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('Bot is online.'));
app.use('/transcripts', express.static(path.join(__dirname, 'transcripts')));
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

// Command interaction handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`❌ Error in command "${interaction.commandName}":`, err);
    if (!interaction.replied) {
      await interaction.reply({ content: '❌ There was an error executing this command.', ephemeral: true });
    }
  }
});

// Login
client.on('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(process.env.TOKEN);

// Keep alive ping
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
setInterval(() => fetch(process.env.BASE_URL).catch(() => {}), 5 * 60 * 1000);