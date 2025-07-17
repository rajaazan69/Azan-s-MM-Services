const { SlashCommandBuilder } = require('discord.js');
const Tag = require('../../models/Tag');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tagdelete')
    .setDescription('Deletes a saved tag by name.')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The name of the tag to delete')
        .setRequired(true)
    ),

  async execute(interaction) {
    const tagName = interaction.options.getString('name');

    try {
      const tag = await Tag.findOne({ name: tagName, guildId: interaction.guild.id });

      if (!tag) {
        return await interaction.reply({
          content: `❌ Tag \`${tagName}\` not found.`,
          ephemeral: true
        });
      }

      if (tag.creatorId !== interaction.user.id && !interaction.member.permissions.has('ManageMessages')) {
        return await interaction.reply({
          content: '❌ You do not have permission to delete this tag.',
          ephemeral: true
        });
      }

      await Tag.deleteOne({ name: tagName, guildId: interaction.guild.id });

      await interaction.reply({
        content: `✅ Tag \`${tagName}\` deleted successfully.`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error deleting tag:', error);
      await interaction.reply({
        content: '❌ An error occurred while deleting the tag.',
        ephemeral: true
      });
    }
  }
};