const { SlashCommandBuilder } = require('discord.js');
const Tag = require('../../models/Tag');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tagedit')
    .setDescription('Edit the content of an existing tag.')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Name of the tag to edit')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('content')
        .setDescription('New content for the tag')
        .setRequired(true)),

  async execute(interaction) {
    const name = interaction.options.getString('name').toLowerCase();
    const newContent = interaction.options.getString('content');

    try {
      const tag = await Tag.findOne({ guildId: interaction.guild.id, name });

      if (!tag) {
        return await interaction.reply({
          content: `❌ No tag found with the name \`${name}\`.`,
          ephemeral: true
        });
      }

      tag.content = newContent;
      await tag.save();

      await interaction.reply({
        content: `✅ Tag \`${name}\` has been updated.`,
        ephemeral: true
      });

    } catch (err) {
      console.error('Error editing tag:', err);
      await interaction.reply({
        content: '❌ An error occurred while editing the tag.',
        ephemeral: true
      });
    }
  }
};