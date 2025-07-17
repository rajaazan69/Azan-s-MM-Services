// commands/tagcreate.js
const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const tagsPath = path.join(__dirname, '../data/tags.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tagcreate')
    .setDescription('Creates a new tag.')
    .addStringOption(option =>
      option.setName('name').setDescription('Name of the tag').setRequired(true))
    .addStringOption(option =>
      option.setName('content').setDescription('Content of the tag').setRequired(true)),

  async execute(interaction) {
    const name = interaction.options.getString('name');
    const content = interaction.options.getString('content');

    let tags = {};
    if (fs.existsSync(tagsPath)) {
      tags = JSON.parse(fs.readFileSync(tagsPath));
    }

    if (tags[name]) {
      return interaction.reply({ content: '❌ That tag already exists.', ephemeral: true });
    }

    tags[name] = { content, createdBy: interaction.user.tag };
    fs.writeFileSync(tagsPath, JSON.stringify(tags, null, 2));

    await interaction.reply({ content: `✅ Tag \`${name}\` has been created.`, ephemeral: true });
  }
};