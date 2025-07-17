const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const ms = require('ms');
const { addModLogEntry } = require('../../utils/db');
const { sendServerModLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily timeout a member')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to timeout')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Duration of timeout (e.g. 10m, 1h, 3d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for timeout')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const executor = interaction.member;
    const targetUser = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided.';

    if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: '🚫 You do not have permission to timeout members.', ephemeral: true });
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ content: '❌ Could not find that user in the server.', ephemeral: true });
    }

    if (!targetMember.moderatable) {
      return interaction.reply({ content: '❌ I cannot timeout this user (possibly due to role hierarchy).', ephemeral: true });
    }

    const durationMs = ms(durationStr);
    if (!durationMs || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ content: '❌ Invalid duration. Must be less than 28 days.', ephemeral: true });
    }

    try {
      await targetMember.timeout(durationMs, reason);

      const caseId = await addModLogEntry(client.db, targetUser.id, 'timeout', interaction.user.id, interaction.user.tag, reason, durationStr);

      const embed = new EmbedBuilder()
        .setColor('#ff9900')
        .setTitle('User Timed Out')
        .addFields(
          { name: 'User', value: targetUser.tag, inline: true },
          { name: 'Duration', value: durationStr, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Case ID', value: `\`${caseId}\`` }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await sendServerModLog(
        client,
        'User Timed Out',
        `${targetUser.tag} has been timed out.`,
        '#ff9900',
        interaction.user,
        targetUser,
        null,
        reason,
        [
          { name: 'Duration', value: durationStr, inline: true },
          { name: 'Case ID', value: `\`${caseId}\``, inline: true }
        ]
      );

    } catch (error) {
      console.error('❌ Timeout failed:', error);
      return interaction.reply({ content: '❌ Failed to timeout the user.', ephemeral: true });
    }
  }
};