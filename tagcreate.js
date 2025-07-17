// commands/tagcreate.js
const { SlashCommandBuilder } = require('discord.js');
const Tag = require('../models/Tag');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tagcreate')
    .setDescription('Creates a new tag.')
    .addStringOption(option =>
      option.setName('name').setDescription('Name of the tag').setRequired(true))
    .addStringOption(option =>
      option.setName('content').setDescription('Content of the tag').setRequired(true)),

  async execute(interaction) {
    const name = interaction.options.getString('name').toLowerCase();
    const content = interaction.options.getString('content');

    try {
      const existing = await Tag.findOne({ name });
      if (existing) {
        return interaction.reply({ content: '❌ That tag already exists.', ephemeral: true });
      }

      await Tag.create({
        name,
        content,
        createdBy: interaction.user.tag
      });

      return interaction.reply({ content: `✅ Tag \`${name}\` created successfully.`, ephemeral: true });
    } catch (err) {
      console.error('Error creating tag:', err);
      return interaction.reply({ content: '❌ Failed to create tag due to an error.', ephemeral: true });
    }
  }
};