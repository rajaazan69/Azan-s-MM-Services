const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const CLIENT_ID = '1392944799983730849'; // your bot ID
const GUILD_ID = 'your-server-id'; // optional: for dev testing, otherwise remove

const commands = [

  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Send the ticket panel in a channel.')
    .addChannelOption(option => option.setName('channel').setDescription('Channel to send the panel in').setRequired(true)),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the ticket and restrict access.'),

  new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete the current ticket.'),

  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Rename the ticket channel.')
    .addStringOption(option => option.setName('name').setDescription('New name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a user to the ticket.')
    .addUserOption(option => option.setName('user').setDescription('User to add').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a user from the ticket.')
    .addUserOption(option => option.setName('user').setDescription('User to remove').setRequired(true)),

  new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Generate and send a transcript.'),

  new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Send a saved tag message.')
    .addStringOption(option => option.setName('name').setDescription('Tag name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('tagcreate')
    .setDescription('Create a new tag.')
    .addStringOption(option => option.setName('name').setDescription('Tag name').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('Tag message').setRequired(true)),

  new SlashCommandBuilder()
    .setName('tagdelete')
    .setDescription('Delete an existing tag.')
    .addStringOption(option => option.setName('name').setDescription('Tag name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('taglist')
    .setDescription('List all saved tags.')
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔁 Refreshing slash commands...');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands.map(cmd => cmd.toJSON()) }
    );

    console.log('✅ Successfully registered application commands.');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();