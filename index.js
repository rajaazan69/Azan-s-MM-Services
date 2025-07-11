require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const express = require('express');
const path = require('path');
const uploadToPastebin = require('./uploadToPastebin');
const app = express();
const port = 3000;

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1392944799983730849';
const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525';
const PANEL_CHANNEL = '1373048211538841702';
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

let ticketCount = 0;
const commandData = [
  new SlashCommandBuilder().setName('setup').setDescription('Send ticket panel'),
  new SlashCommandBuilder().setName('close').setDescription('Close ticket'),
  new SlashCommandBuilder().setName('delete').setDescription('Delete ticket'),
  new SlashCommandBuilder().setName('rename').setDescription('Rename ticket').addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true)),
  new SlashCommandBuilder().setName('transcript').setDescription('Generate transcript'),
  new SlashCommandBuilder().setName('add').setDescription('Add user').addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true)),
  new SlashCommandBuilder().setName('remove').setDescription('Remove user').addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)),
  new SlashCommandBuilder().setName('open').setDescription('Reopen ticket')
];

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandData });
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup') {
      const embed = new EmbedBuilder()
        .setTitle('🎫 Request Middleman')
        .setDescription('Click the button below to request a middleman.\nYou will be asked for:\n1. What\'s the trade?\n2. What\'s the side?\n3. What\'s their side?\n4. What\'s their user ID?')
        .setColor(0x2f3136);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('🎫 Request Middleman')
          .setStyle(ButtonStyle.Primary)
      );

      await interaction.reply({ content: '✅ Panel sent!', ephemeral: true });
      await client.channels.cache.get(PANEL_CHANNEL)?.send({ embeds: [embed], components: [row] });
    }

    if (commandName === 'rename') {
      const name = interaction.options.getString('name');
      await interaction.channel.setName(name);
      await interaction.reply({ content: `Renamed to ${name}`, ephemeral: true });
    }

    if (commandName === 'delete') {
      await interaction.reply({ content: 'Deleting ticket...', ephemeral: true });
      await interaction.channel.delete();
    }

    if (commandName === 'add') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true
      });
      await interaction.reply({ content: `Added ${user}`, ephemeral: true });
    }

    if (commandName === 'remove') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.delete(user.id);
      await interaction.reply({ content: `Removed ${user}`, ephemeral: true });
    }

    if (commandName === 'open') {
      const user = interaction.channel.topic;
      if (user) {
        await interaction.channel.permissionOverwrites.edit(user, {
          ViewChannel: true,
          SendMessages: true
        });
        await interaction.reply({ content: `Reopened for <@${user}>`, ephemeral: true });
      } else {
        await interaction.reply({ content: `No user info in topic`, ephemeral: true });
      }
    }

    if (commandName === 'transcript') {
      await generateTranscript(interaction.channel, interaction);
    }

    if (commandName === 'close') {
      await interaction.deferReply({ ephemeral: true });
      const userId = interaction.channel.topic;
      if (userId) {
        await interaction.channel.permissionOverwrites.edit(userId, {
          ViewChannel: false,
          SendMessages: false
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('delete').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription('Choose an option below:')
        .setColor(0x2f3136);

      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'create_ticket') {
      const modal = new ModalBuilder()
        .setTitle('Middleman Request')
        .setCustomId('ticket_modal')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('q2').setLabel("What's the side?").setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('q4').setLabel("What's their user ID?").setStyle(TextInputStyle.Short).setRequired(true)
          )
        );
      await interaction.showModal(modal);
    }

    if (interaction.customId === 'transcript') {
      await interaction.deferReply({ ephemeral: true });
      await generateTranscript(interaction.channel, interaction);
    }

    if (interaction.customId === 'delete') {
      await interaction.reply({ content: 'Deleting ticket...', ephemeral: true });
      await interaction.channel.delete();
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    const answers = [
      interaction.fields.getTextInputValue('q1'),
      interaction.fields.getTextInputValue('q2'),
      interaction.fields.getTextInputValue('q3'),
      interaction.fields.getTextInputValue('q4')
    ];
    const ticketName = `ticket-${++ticketCount}`;
    const channel = await interaction.guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY,
      topic: answers[3],
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: MIDDLEMAN_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle('🎫 Middleman Request')
      .setDescription(`**1. Trade:** ${answers[0]}\n**2. Your Side:** ${answers[1]}\n**3. Their Side:** ${answers[2]}\n**4. Their ID:** ${answers[3]}`)
      .setColor(0x2f3136);

    await channel.send({ content: `<@${interaction.user.id}> <@&${MIDDLEMAN_ROLE}>`, embeds: [embed] });
    await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }
});

async function generateTranscript(channel, interaction) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = Array.from(messages.values()).reverse();

  const userCounts = {};
  let html = `<html><head><title>${channel.name} Transcript</title></head><body><h1>Transcript: ${channel.name}</h1><hr>`;
  for (const msg of sorted) {
    html += `<p><strong>${msg.author.tag}:</strong> ${msg.content}</p>`;
    userCounts[msg.author.tag] = (userCounts[msg.author.tag] || 0) + 1;
  }
  html += '</body></html>';

  const filePath = path.join(__dirname, `transcript-${channel.id}.html`);
  fs.writeFileSync(filePath, html);
  const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:3000'}/transcripts/${path.basename(filePath)}`;

  const pasteUrl = await uploadToPastebin(channel.name, html);

  const embed = new EmbedBuilder()
    .setTitle('📄 Ticket Transcript')
    .setDescription(`**Ticket:** ${channel.name}\n**Owner:** <@${channel.topic || OWNER_ID}>\n**Messages:**\n${Object.entries(userCounts).map(([u, c]) => `- ${u}: ${c}`).join('\n')}`)
    .addFields(
      { name: 'Public Link', value: `[View HTML Transcript](${url})`, inline: true },
      { name: 'Backup Link', value: `[View on Pastebin](${pasteUrl})`, inline: true }
    )
    .setColor(0x2f3136)
    .setFooter({ text: 'Transcript generated successfully' });

  await interaction.followUp({ embeds: [embed], ephemeral: true });
  await client.channels.cache.get(TRANSCRIPT_CHANNEL)?.send({ embeds: [embed] });
}

app.use('/transcripts', express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

client.login(TOKEN);