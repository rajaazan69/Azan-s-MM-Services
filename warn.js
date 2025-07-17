const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { addModLogEntry } = require('../../utils/db');
const { sendServerModLog } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a user and logs it.')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to warn')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for the warning')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const executor = interaction.member;
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided.';

    if (!executor.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: '🚫 You do not have permission to warn members.', ephemeral: true });
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ content: '❌ Could not find that user in the server.', ephemeral: true });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: "❌ You cannot warn yourself.", ephemeral: true });
    }

    try {
      await targetUser.send(`⚠️ You have been warned in **${interaction.guild.name}**.\n**Reason:** ${reason}`).catch(() => {});

      const caseId = await addModLogEntry(client.db, targetUser.id, 'warn', interaction.user.id, interaction.user.tag, reason);

      const embed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setTitle('User Warned')
        .addFields(
          { name: 'User', value: targetUser.tag, inline: true },
          { name: 'Warned by', value: interaction.user.tag, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Case ID', value: `\`${caseId}\`` }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await sendServerModLog(
        client,
        'User Warned',
        `${targetUser.tag} was warned.`,
        '#ffcc00',
        interaction.user,
        targetUser,
        null,
        reason,
        [{ name: 'Case ID', value: `\`${caseId}\``, inline: true }]
      );

    } catch (error) {
      console.error('❌ Warn command failed:', error);
      return interaction.reply({ content: '❌ An unexpected error occurred.', ephemeral: true });
    }
  }
};