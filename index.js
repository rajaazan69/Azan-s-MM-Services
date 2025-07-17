const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// CONFIG
const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525';
const PANEL_CHANNEL = '1373048211538841702';
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';

// EXPRESS FOR UPTIME + TRANSCRIPTS
const app = express();
const PORT = 3000;

app.get('/', (req, res) => res.send('Bot is alive.'));
app.use('/transcripts', express.static(path.join(__dirname, 'transcripts')));
app.listen(PORT, () => console.log(`Express server listening on port ${PORT}`));

// SELF-PING FOR UPTIME
setInterval(() => {
  require('node-fetch')('http://localhost:' + PORT).catch(() => {});
}, 5 * 60 * 1000);

// ✅ MESSAGE-BASED COMMANDS
client.on('messageCreate', async (message) => {
  if (!message.content.startsWith('$') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'setup') {
    const embed = new EmbedBuilder()
      .setTitle('🎟️ Request a Middleman')
      .setDescription('Click the button below to request a middleman.\n\nYou will be prompted to fill out a short form.')
      .setColor('Blue');

    const button = new ButtonBuilder()
      .setCustomId('createTicket')
      .setLabel('Request Middleman')
      .setStyle(ButtonStyle.Primary);

    return message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
  }

  if (command === 'close') {
    const channel = message.channel;
    const permissions = channel.permissionOverwrites.cache;
    const user = permissions.find(p => p.type === 1)?.id;

    if (!user) return message.reply('❌ Could not identify the ticket user.');

    await channel.permissionOverwrites.edit(user, { SendMessages: false, ViewChannel: false });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('deleteTicket').setLabel('❌ Delete').setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder().setDescription('Ticket closed. Choose an option below:').setColor('Red');
    return message.channel.send({ embeds: [embed], components: [row] });
  }

  if (command === 'transcript') {
    const messages = await message.channel.messages.fetch({ limit: 100 });
    const content = [...messages.values()].reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');

    const fileName = `${message.channel.id}.html`;
    const filePath = path.join(__dirname, 'transcripts', fileName);

    const html = `
      <html>
      <head><title>Transcript</title></head>
      <body><pre>${content}</pre></body>
      </html>
    `;

    fs.writeFileSync(filePath, html);
    const url = `http://localhost:${PORT}/transcripts/${fileName}`;
    return message.reply({ content: `📄 Transcript: ${url}` });
  }

  if (command === 'delete') {
    return message.channel.delete().catch(() => message.reply('❌ Failed to delete the channel.'));
  }

  if (command === 'add') {
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention a user to add.');
    await message.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
    return message.reply(`✅ Added ${user}`);
  }

  if (command === 'remove') {
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention a user to remove.');
    await message.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
    return message.reply(`✅ Removed ${user}`);
  }

  if (command === 'rename') {
    const name = args.join('-');
    if (!name) return message.reply('❌ Provide a new channel name.');
    await message.channel.setName(name);
    return message.reply(`✅ Renamed channel to ${name}`);
  }

  if (command === 'open') {
    const channel = message.channel;
    const permissions = channel.permissionOverwrites.cache;
    const user = permissions.find(p => p.type === 1)?.id;
    if (!user) return message.reply('❌ Could not identify the ticket user.');

    await channel.permissionOverwrites.edit(user, { SendMessages: true, ViewChannel: true });
    return message.reply('✅ Ticket reopened.');
  }

  if (command === 'ticket') {
    const modal = new ModalBuilder()
      .setCustomId('ticketModal')
      .setTitle('Middleman Ticket');

    const q1 = new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true);
    const q2 = new TextInputBuilder().setCustomId('q2').setLabel("What's your side?").setStyle(TextInputStyle.Short).setRequired(true);
    const q3 = new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Short).setRequired(true);
    const q4 = new TextInputBuilder().setCustomId('q4').setLabel("Their Roblox User ID?").setStyle(TextInputStyle.Short).setRequired(false);

    const row1 = new ActionRowBuilder().addComponents(q1);
    const row2 = new ActionRowBuilder().addComponents(q2);
    const row3 = new ActionRowBuilder().addComponents(q3);
    const row4 = new ActionRowBuilder().addComponents(q4);

    modal.addComponents(row1, row2, row3, row4);
    await message.channel.send('Check your DM to fill the ticket form!');
    await message.author.send({ content: 'Fill out this form:', components: [], embeds: [], files: [] }).catch(() => {});
  }
});

// ✅ MODALS / BUTTONS HANDLER
client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'createTicket') {
      const modal = new ModalBuilder()
        .setCustomId('ticketModal')
        .setTitle('Middleman Ticket');

      const inputs = [
        new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short),
        new TextInputBuilder().setCustomId('q2').setLabel("What's your side?").setStyle(TextInputStyle.Short),
        new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Short),
        new TextInputBuilder().setCustomId('q4').setLabel("Their Roblox User ID?").setStyle(TextInputStyle.Short).setRequired(false)
      ];

      modal.addComponents(...inputs.map(i => new ActionRowBuilder().addComponents(i)));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'deleteTicket') {
      await interaction.channel.delete().catch(() => {});
    }

    if (interaction.customId === 'transcript') {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const content = [...messages.values()].reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');

      const fileName = `${interaction.channel.id}.html`;
      const filePath = path.join(__dirname, 'transcripts', fileName);

      const html = `<html><body><pre>${content}</pre></body></html>`;
      fs.writeFileSync(filePath, html);
      const url = `http://localhost:${PORT}/transcripts/${fileName}`;

      const embed = new EmbedBuilder().setTitle('📄 Transcript').setDescription(`[Click to view transcript](${url})`).setColor('Green');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
    const q1 = interaction.fields.getTextInputValue('q1');
    const q2 = interaction.fields.getTextInputValue('q2');
    const q3 = interaction.fields.getTextInputValue('q3');
    const q4 = interaction.fields.getTextInputValue('q4') || 'Unknown';

    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: 0,
      parent: TICKET_CATEGORY,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: OWNER_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: MIDDLEMAN_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle('🎟️ New Ticket')
      .setDescription(`**Trade:** ${q1}\n**Their Side:** ${q3}\n**Your Side:** ${q2}\n**User ID:** ${q4}`)
      .setColor('Blue')
      .setFooter({ text: `User: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    ticketChannel.send({ content: `<@${interaction.user.id}> <@&${MIDDLEMAN_ROLE}>`, embeds: [embed] });
    interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
  }
});

client.login(process.env.TOKEN);