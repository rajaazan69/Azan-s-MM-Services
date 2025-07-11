require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const uploadToPastebin = require('./uploadtoPastebin'); // make sure the filename matches
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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Setup the ticket panel'),
  new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
  new SlashCommandBuilder().setName('transcript').setDescription('Send the ticket transcript'),
  new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket'),
  new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket').addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true)),
  new SlashCommandBuilder().setName('add').setDescription('Add user to ticket').addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true)),
  new SlashCommandBuilder().setName('remove').setDescription('Remove user from ticket').addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
  console.log(`Bot ready as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup') {
      const embed = new EmbedBuilder()
        .setTitle('Request Middleman')
        .setDescription('Click the button below to open a ticket.\nPlease fill out all required information.')
        .setColor('Blue');

      const button = new ButtonBuilder().setCustomId('create_ticket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary);

      await interaction.reply({ content: '✅ Panel created.', ephemeral: true });
      await client.channels.cache.get(PANEL_CHANNEL).send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
    }

    if (commandName === 'close') {
      if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });

      const member = interaction.guild.members.cache.get(interaction.channel.topic);
      await interaction.channel.permissionOverwrites.edit(member, { SendMessages: false, ViewChannel: false });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('delete').setLabel('Delete').setStyle(ButtonStyle.Danger)
      );

      await interaction.followUp({ content: '✅ Ticket closed.', components: [row] });
    }

    if (commandName === 'delete') {
      if (!interaction.channel.name.startsWith('ticket-')) return interaction.reply({ content: '❌ Not a ticket channel.', ephemeral: true });
      await interaction.reply({ content: 'Deleting in 3 seconds...', ephemeral: true });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }

    if (commandName === 'rename') {
      const newName = interaction.options.getString('name');
      await interaction.channel.setName(`ticket-${newName}`);
      await interaction.reply({ content: `Renamed to ticket-${newName}`, ephemeral: true });
    }

    if (commandName === 'add') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
      await interaction.reply({ content: `✅ ${user} added to the ticket.`, ephemeral: true });
    }

    if (commandName === 'remove') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.delete(user.id);
      await interaction.reply({ content: `❌ ${user} removed from the ticket.`, ephemeral: true });
    }

    if (commandName === 'transcript') {
      await generateTranscript(interaction);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'create_ticket') {
      const modal = new ModalBuilder().setCustomId('ticket_modal').setTitle('Ticket Form');

      const questions = [
        { id: 'trade', label: "What's the trade?" },
        { id: 'side', label: "What's your side?" },
        { id: 'otherside', label: "What's their side?" },
        { id: 'userid', label: "What's their user ID?" }
      ];

      const components = questions.map(q =>
        new ActionRowBuilder().addComponents(new TextInputBuilder()
          .setCustomId(q.id)
          .setLabel(q.label)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)));

      modal.addComponents(...components);
      await interaction.showModal(modal);
    }

    if (interaction.customId === 'transcript') {
      await generateTranscript(interaction);
    }

    if (interaction.customId === 'delete') {
      await interaction.channel.delete().catch(() => {});
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
    await interaction.deferReply({ ephemeral: true });

    const answers = {
      trade: interaction.fields.getTextInputValue('trade'),
      side: interaction.fields.getTextInputValue('side'),
      otherside: interaction.fields.getTextInputValue('otherside'),
      userid: interaction.fields.getTextInputValue('userid')
    };

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      topic: interaction.user.id,
      parent: TICKET_CATEGORY,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: OWNER_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: MIDDLEMAN_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle('Ticket Created')
      .setDescription(`**Trade:** ${answers.trade}\n**Your Side:** ${answers.side}\n**Their Side:** ${answers.otherside}\n**User ID:** ${answers.userid}`)
      .setColor('Green')
      .setFooter({ text: `User ID: ${interaction.user.id}` });

    await channel.send({ content: `<@${interaction.user.id}> <@&${MIDDLEMAN_ROLE}>`, embeds: [embed] });
    await interaction.followUp({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }
});

async function generateTranscript(interaction) {
  const channel = interaction.channel;
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();

  let transcriptHTML = `<html><body><h1>Transcript - ${channel.name}</h1><ul>`;
  sorted.forEach(msg => {
    const timestamp = msg.createdAt.toLocaleString();
    transcriptHTML += `<li><strong>${msg.author.tag}</strong> [${timestamp}]: ${msg.content}</li>`;
  });
  transcriptHTML += `</ul></body></html>`;

  const filePath = path.join(__dirname, `${channel.id}.html`);
  fs.writeFileSync(filePath, transcriptHTML);

  const pasteUrl = await uploadToPastebin(transcriptHTML);
  const embed = new EmbedBuilder()
    .setTitle('📄 Ticket Transcript')
    .setDescription(`[View Transcript on Pastebin](${pasteUrl})`)
    .setColor('Orange');

  client.channels.cache.get(TRANSCRIPT_CHANNEL).send({ embeds: [embed] });
  await interaction.reply({ embeds: [embed], ephemeral: true });

  setTimeout(() => fs.remove(filePath).catch(() => {}), 60_000);
}

// Express uptime ping server
app.get('/', (req, res) => res.send('Bot is alive.'));
app.listen(port, () => console.log(`Uptime server running on http://localhost:${port}`));
setInterval(() => require('node-fetch')('http://localhost:3000'), 60_000);

client.login(TOKEN);