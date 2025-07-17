const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createTranscript } = require('../utils/transcript');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.channel;
    const ticketOwnerMatch = channel.name.match(/ticket-(\d{17,})/);
    const ticketOwnerId = ticketOwnerMatch ? ticketOwnerMatch[1] : null;

    if (!ticketOwnerId) {
      return interaction.reply({ content: 'This is not a valid ticket channel.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(ticketOwnerId).catch(() => null);

    if (member) {
      await channel.permissionOverwrites.edit(member.user, {
        SendMessages: false,
        ViewChannel: false
      });
    }

    const messages = await channel.messages.fetch({ limit: 100 });
    const transcriptHtml = await createTranscript(channel, messages);

    const fileName = `transcript-${channel.id}.html`;
    const filePath = path.join(__dirname, '..', 'transcripts', fileName);
    fs.writeFileSync(filePath, transcriptHtml);

    const publicUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/transcripts/${fileName}`;

    const closeEmbed = new EmbedBuilder()
      .setTitle('Ticket Closed')
      .setDescription(`This ticket has been closed.\n[View Transcript](${publicUrl})`)
      .addFields(
        { name: 'Ticket Owner', value: `<@${ticketOwnerId}>`, inline: true },
        { name: 'Panel Name', value: channel.topic || 'Unknown', inline: true },
        { name: 'Ticket Name', value: channel.name, inline: true }
      )
      .setColor('#2f3136')
      .setTimestamp();

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('transcript')
        .setLabel('Transcript')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('delete')
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [closeEmbed], components: [buttonRow] });
  }
};