const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Tag = require('../../models/Tag');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Fetch a tag by name.')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('The name of the tag to retrieve')
        .setRequired(true)),

  async execute(interaction) {
    const name = interaction.options.getString('name').toLowerCase();

    try {
      const tag = await Tag.findOne({ guildId: interaction.guild.id, name });

      if (!tag) {
        return await interaction.reply({
          content: `❌ No tag found with the name \`${name}\`.`,
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📌 Tag: ${tag.name}`)
        .setDescription(tag.content)
        .setFooter({ text: `Created by ${tag.creatorTag}` })
        .setTimestamp(new Date(tag.createdAt))
        .setColor('#2F3136');

      await interaction.reply({ embeds: [embed] });

    } catch (err) {
      console.error('Error fetching tag:', err);
      await interaction.reply({
        content: '❌ An error occurred while fetching the tag.',
        ephemeral: true
      });
    }
  }
};