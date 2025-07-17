const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { addModLogEntry } = require('../../utils/db');
const { sendServerModLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a user from the server.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to ban')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the ban')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const executor = interaction.member;
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided.';

    if (!executor.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: '🚫 You do not have permission to ban members.', ephemeral: true });
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ content: '❌ Could not find that user in the server.', ephemeral: true });
    }

    if (!interaction.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: '❌ I do not have permission to ban members.', ephemeral: true });
    }

    if (targetMember.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot ban yourself.", ephemeral: true });
    }

    if (targetMember.roles.highest.position >= executor.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot ban a member with an equal or higher role.', ephemeral: true });
    }

    if (!targetMember.bannable) {
      return interaction.reply({ content: '❌ I cannot ban this user. They may have a higher role than me or I lack permissions.', ephemeral: true });
    }

    try {
      await targetUser.send(`🔨 You have been banned from **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});
      await targetMember.ban({ reason: `${interaction.user.tag}: ${reason}` });

      const caseId = await addModLogEntry(client.db, targetUser.id, 'ban', interaction.user.id, interaction.user.tag, reason);

      const banEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('User Banned')
        .addFields(
          { name: 'User', value: targetUser.tag, inline: true },
          { name: 'Banned by', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Case ID', value: `\`${caseId}\`` }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [banEmbed] });

      await sendServerModLog(
        client,
        'User Banned',
        `${targetUser.tag} was banned from the server.`,
        '#ff0000',
        interaction.user,
        targetUser,
        null,
        reason,
        [{ name: 'Case ID', value: `\`${caseId}\``, inline: true }]
      );

    } catch (error) {
      console.error('❌ Ban command failed:', error);
      return interaction.reply({ content: '❌ An unexpected error occurred.', ephemeral: true });
    }
  }
};