const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('tagcreate')
    .setDescription('Create a custom tag')
    .addStringOption(option =>
      option.setName('name').setDescription('Tag name').setRequired(true))
    .addStringOption(option =>
      option.setName('message').setDescription('Message content').setRequired(true)),
  new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Use a saved tag')
    .addStringOption(option =>
      option.setName('name').setDescription('Tag name to display').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands('YOUR_CLIENT_ID'),
      { body: commands }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
})();