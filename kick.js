const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { addModLogEntry } = require('../../utils/db');
const { sendServerModLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kicks a user from the server.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to kick')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the kick')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const executor = interaction.member;
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided.';

    if (!executor.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: '🚫 You do not have permission to kick members.', ephemeral: true });
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ content: '❌ Could not find that user in the server.', ephemeral: true });
    }

    if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: '❌ I do not have permission to kick members.', ephemeral: true });
    }

    if (targetMember.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot kick yourself.", ephemeral: true });
    }

    if (targetMember.roles.highest.position >= executor.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot kick a member with an equal or higher role.', ephemeral: true });
    }

    if (!targetMember.kickable) {
      return interaction.reply({ content: '❌ I cannot kick this user. They may have a higher role than me or I lack permissions.', ephemeral: true });
    }

    try {
      await targetUser.send(`👢 You have been kicked from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
      await targetMember.kick(`${interaction.user.tag}: ${reason}`);

      const caseId = await addModLogEntry(client.db, targetUser.id, 'kick', interaction.user.id, interaction.user.tag, reason);

      const kickEmbed = new EmbedBuilder()
        .setColor('#ffaa00')
        .setTitle('User Kicked')
        .addFields(
          { name: 'User', value: targetUser.tag, inline: true },
          { name: 'Kicked by', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Case ID', value: `\`${caseId}\`` }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [kickEmbed] });

      await sendServerModLog(
        client,
        'User Kicked',
        `${targetUser.tag} was kicked from the server.`,
        '#ffaa00',
        interaction.user,
        targetUser,
        null,
        reason,
        [{ name: 'Case ID', value: `\`${caseId}\``, inline: true }]
      );

    } catch (error) {
      console.error('❌ Kick command failed:', error);
      return interaction.reply({ content: '❌ An unexpected error occurred.', ephemeral: true });
    }
  }
};