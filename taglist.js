const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Tag = require('../../models/Tag');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('taglist')
    .setDescription('Lists all saved tags in this server.'),

  async execute(interaction) {
    try {
      const tags = await Tag.find({ guildId: interaction.guild.id });

      if (!tags.length) {
        return await interaction.reply({
          content: '❌ There are no tags saved in this server.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📑 Tags in ${interaction.guild.name}`)
        .setColor('#2ecc71')
        .setDescription(tags.map(tag => `• \`${tag.name}\``).join('\n'))
        .setFooter({ text: `Total: ${tags.length} tags` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error fetching tags:', error);
      await interaction.reply({
        content: '❌ An error occurred while fetching the tag list.',
        ephemeral: true
      });
    }
  }
};