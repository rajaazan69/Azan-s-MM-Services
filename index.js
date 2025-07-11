const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField, SlashCommandBuilder, Routes, REST, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
dotenv.config();

const TOKEN = process.env.TOKEN;
const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525';
const PANEL_CHANNEL = '1373048211538841702';
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';

const panelPath = './panel.json';
let panelMessageId = null;
if (fs.existsSync(panelPath)) {
  const data = JSON.parse(fs.readFileSync(panelPath));
  panelMessageId = data.messageId;
}

const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(3000);
setInterval(() => require('node-fetch')('http://localhost:3000'), 240000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  if (panelMessageId) {
    const channel = await client.channels.fetch(PANEL_CHANNEL);
    const msg = await channel.messages.fetch(panelMessageId).catch(() => null);
    if (!msg) {
      const embed = new EmbedBuilder()
        .setTitle('**Request Middleman**')
        .setDescription('**Click Below To Request Azan’s Services**\nPlease answer all the questions correctly for the best support.')
        .setColor('Blue');
      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_ticket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
      );
      const newMsg = await channel.send({ embeds: [embed], components: [btn] });
      fs.writeFileSync(panelPath, JSON.stringify({ messageId: newMsg.id }, null, 2));
      console.log('🔁 Panel restored.');
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName, options } = interaction;

    if (commandName === 'setup') {
      const embed = new EmbedBuilder()
        .setTitle('**Request Middleman**')
        .setDescription('**Click Below To Request Azan’s Services**\nPlease answer all the questions correctly for the best support.')
        .setColor('Blue');

      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_ticket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
      );

      const panelChannel = await client.channels.fetch(PANEL_CHANNEL);
      const msg = await panelChannel.send({ embeds: [embed], components: [btn] });

      fs.writeFileSync(panelPath, JSON.stringify({ messageId: msg.id }, null, 2));
      panelMessageId = msg.id;

      await interaction.reply({ content: '✅ Panel sent.', ephemeral: true });
    }

    if (commandName === 'close') {
      const channel = interaction.channel;
      await channel.permissionOverwrites.edit(channel.topic, {
        SendMessages: false,
        ViewChannel: false
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('delete').setLabel('Delete').setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription('You can now choose an option below.')
        .setColor('Red');

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'transcript') {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      const participants = {};

      let html = `<html><head><style>body{font-family:sans-serif;background:#111;color:#eee;padding:20px;} .msg{margin-bottom:15px;} .user{color:#0af;font-weight:bold;} .time{color:#888;font-size:0.9em;} </style></head><body>`;
      html += `<h1>Ticket Transcript</h1>`;
      html += `<p><strong>Ticket:</strong> ${interaction.channel.name}</p>`;
      html += `<p><strong>Panel:</strong> Request Middleman</p>`;
      html += `<p><strong>Owner:</strong> <@${interaction.channel.topic}></p><hr>`;

      sorted.forEach(msg => {
        if (!participants[msg.author.id]) participants[msg.author.id] = { count: 0, tag: msg.author.tag };
        participants[msg.author.id].count++;

        html += `<div class="msg"><span class="user">${msg.author.tag}</span> <span class="time">${new Date(msg.createdTimestamp).toLocaleString()}</span><br>${msg.content}</div>`;
      });

      html += `<hr><h3>User Stats</h3><ul>`;
      for (const id in participants) {
        html += `<li>${participants[id].tag} — ${participants[id].count} messages</li>`;
      }
      html += `</ul></body></html>`;

      const fileName = `transcript-${interaction.channel.id}.html`;
      const filePath = path.join(__dirname, fileName);
      fs.writeFileSync(filePath, html);

      const transcriptChannel = await client.channels.fetch(TRANSCRIPT_CHANNEL);
      const embed = new EmbedBuilder()
        .setTitle('📄 Ticket Transcript')
        .setDescription(`[Click here to view transcript](http://localhost:3000/${fileName})`)
        .setColor('Green');

      await transcriptChannel.send({
        content: `Transcript for ${interaction.channel.name}`,
        embeds: [embed]
      });

      app.get(`/${fileName}`, (req, res) => res.sendFile(filePath));

      await interaction.reply({ content: `📄 Transcript: http://localhost:3000/${fileName}`, ephemeral: true });
    }

    if (commandName === 'delete') {
      await interaction.channel.delete();
    }

    if (commandName === 'rename') {
      const name = options.getString('name');
      await interaction.channel.setName(name);
      await interaction.reply({ content: `Renamed to ${name}`, ephemeral: true });
    }

    if (commandName === 'add') {
      const user = options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true
      });
      await interaction.reply({ content: `Added ${user}`, ephemeral: true });
    }

    if (commandName === 'remove') {
      const user = options.getUser('user');
      await interaction.channel.permissionOverwrites.delete(user.id);
      await interaction.reply({ content: `Removed ${user}`, ephemeral: true });
    }
  }

  if (interaction.isButton() && interaction.customId === 'open_ticket') {
    const modal = new ModalBuilder()
      .setCustomId('ticket_modal')
      .setTitle('Request Azan’s Services')
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel('What’s the trade?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel('What’s your side?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel('What’s their side?').setStyle(TextInputStyle.Paragraph).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel('What’s their user ID?').setStyle(TextInputStyle.Short).setRequired(true))
      );
    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    const answers = [
      `**Q1:** ${interaction.fields.getTextInputValue('q1')}`,
      `**Q2:** ${interaction.fields.getTextInputValue('q2')}`,
      `**Q3:** ${interaction.fields.getTextInputValue('q3')}`,
      `**Q4:** ${interaction.fields.getTextInputValue('q4')}`
    ].join('\n\n');

    const ticketName = `ticket-${interaction.user.username.toLowerCase()}`;
    const channel = await interaction.guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY,
      topic: interaction.user.id,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: OWNER_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: MIDDLEMAN_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle(`📝 Ticket Information`)
      .setDescription(answers)
      .setColor('Green');

    await channel.send({
      content: `<@${interaction.user.id}> Welcome to Azan’s middleman services. You will be assisted shortly.`,
      embeds: [embed]
    });

    await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'transcript') {
      interaction.client.emit('interactionCreate', interaction);
    }
    if (interaction.customId === 'delete') {
      await interaction.channel.delete();
    }
  }
});

client.login(TOKEN);
