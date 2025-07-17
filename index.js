// ----- add.js -----
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Adds a user to the ticket'),

  async execute(interaction, client) {
    // your existing add logic here
  }
};

// ----- close.js -----
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Closes the ticket'),

  async execute(interaction, client) {
    // your existing close logic here
  }
};

// ----- delete.js -----
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Deletes the ticket channel'),

  async execute(interaction, client) {
    // your existing delete logic here
  }
};

// ----- kick.js -----
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a member from the server'),

  async execute(interaction, client) {
    // your existing kick logic here, converted from message-based
  }
};

// ----- open.js -----
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('open')
    .setDescription('Re-opens a closed ticket'),

  async execute(interaction, client) {
    // your existing open logic here
  }
};

// ----- remove.js -----
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Removes a user from the ticket'),

  async execute(interaction, client) {
    // your existing remove logic here
  }
};

// ----- rename.js -----
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Renames the ticket channel'),

  async execute(interaction, client) {
    // your existing rename logic here
  }
};

// ----- setup.js -----
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Sets up the ticket panel'),

  async execute(interaction, client) {
    // your existing setup logic here
  }
};

// ----- transcript.js -----
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transcript')
    .setDescription('Generates a transcript of the ticket'),

  async execute(interaction, client) {
    // your existing transcript logic here
  }
};
