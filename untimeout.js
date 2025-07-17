// commands/unmute.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Removes timeout from a member (unmutes).')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to unmute')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const member = interaction.options.getMember('user');

    if (!member) {
      return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: '❌ I cannot unmute this member.', ephemeral: true });
    }

    try {
      await member.timeout(null);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('Member Unmuted')
        .setDescription(`${member.user.tag} has been unmuted.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '⚠️ Failed to unmute the user.', ephemeral: true });
    }
  }
};