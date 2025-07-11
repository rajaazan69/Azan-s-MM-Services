require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const TOKEN = process.env.TOKEN;
const DOMAIN = process.env.DOMAIN;

const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525';
const PANEL_CHANNEL = '1373048211538841702';
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Express server for uptime + transcript hosting
app.use('/transcripts', express.static(path.join(__dirname, 'transcripts')));
app.get('/', (_, res) => res.send('Bot is alive'));
app.listen(3000, () => console.log('Express server running on port 3000'));

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = interaction.commandName;

    if (command === 'setup') {
      const embed = new EmbedBuilder()
        .setTitle('Middleman Ticket Panel')
        .setDescription('Click the button below to request a middleman.\nA form will pop up asking about your trade details.')
        .setColor('Blurple');

      const button = new ButtonBuilder()
        .setCustomId('open_ticket')
        .setLabel('Request Middleman')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      await interaction.reply({ content: 'Panel sent!', ephemeral: true });
      const channel = await client.channels.fetch(PANEL_CHANNEL);
      await channel.send({ embeds: [embed], components: [row] });
    }

    if (command === 'close') {
      const channel = interaction.channel;
      const permissionOverwrites = channel.permissionOverwrites.cache;
      const userOverwrite = permissionOverwrites.find(po => po.type === 1);

      if (userOverwrite) {
        await channel.permissionOverwrites.edit(userOverwrite.id, {
          SendMessages: false,
          ViewChannel: false
        });
      }

      const transcriptURL = await generateTranscript(channel);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('get_transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('delete_ticket').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle('Ticket Closed')
        .setDescription(`[📄 View Transcript](${transcriptURL})`)
        .setColor('Red');

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (command === 'delete') {
      await interaction.channel.delete();
    }

    if (command === 'add') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true
      });
      await interaction.reply({ content: `✅ <@${user.id}> added to the ticket.`, ephemeral: true });
    }

    if (command === 'remove') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: false
      });
      await interaction.reply({ content: `🚫 <@${user.id}> removed from the ticket.`, ephemeral: true });
    }

    if (command === 'rename') {
      const name = interaction.options.getString('name');
      await interaction.channel.setName(name);
      await interaction.reply({ content: `✏️ Renamed channel to \`${name}\`.`, ephemeral: true });
    }

    if (command === 'transcript') {
      const url = await generateTranscript(interaction.channel);
      const embed = new EmbedBuilder()
        .setTitle('📄 Transcript')
        .setDescription(`[Click to view](${url})`)
        .setColor('Green');
      await interaction.reply({ embeds: [embed] });
    }
  }

  if (interaction.isButton()) {
    const { customId } = interaction;

    if (customId === 'open_ticket') {
      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('Request Middleman');

      const fields = [
        ['trade', "What's the trade?"],
        ['side', "What's your side?"],
        ['their_side', "What's their side?"],
        ['user_id', "What's their user ID?"]
      ].map(([id, label]) =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      modal.addComponents(...fields);
      await interaction.showModal(modal);
    }

    if (customId === 'get_transcript') {
      const transcriptURL = await generateTranscript(interaction.channel);
      const embed = new EmbedBuilder()
        .setTitle('📄 Transcript Link')
        .setDescription(`[Click to view](${transcriptURL})`)
        .setColor('Blue');
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'delete_ticket') {
      await interaction.channel.delete();
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'ticket_modal') {
      const trade = interaction.fields.getTextInputValue('trade');
      const side = interaction.fields.getTextInputValue('side');
      const theirSide = interaction.fields.getTextInputValue('their_side');
      const userID = interaction.fields.getTextInputValue('user_id');

      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: 0,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          },
          {
            id: MIDDLEMAN_ROLE,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          },
          {
            id: OWNER_ID,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
          }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle('Middleman Request')
        .addFields(
          { name: "What's the trade?", value: trade },
          { name: "Your side", value: side },
          { name: "Their side", value: theirSide },
          { name: "Their Discord ID", value: userID }
        )
        .setFooter({ text: `Ticket for ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setColor('Blue');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('get_transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('delete_ticket').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
      );

      await channel.send({ content: `<@&${MIDDLEMAN_ROLE}> <@${interaction.user.id}>`, embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
    }
  }
});

async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const userMessages = {};

  let content = `<html><head><style>body{font-family:sans-serif;background:#111;color:#eee;padding:20px}span.user{color:#90f}span.bot{color:#0af}</style></head><body>`;
  content += `<h2>Transcript of ${channel.name}</h2><p><b>Panel:</b> ${channel.name}<br><b>Ticket Owner:</b> ${channel.topic || 'Unknown'}</p><hr>`;

  sorted.forEach(msg => {
    const username = msg.author.tag;
    const id = msg.author.id;
    const timestamp = new Date(msg.createdTimestamp).toLocaleString();
    const userClass = msg.author.bot ? 'bot' : 'user';

    userMessages[username] = (userMessages[username] || 0) + 1;

    content += `<p><span class="${userClass}">[${timestamp}] ${username}:</span> ${msg.content || '[Embed/Attachment]'}</p>`;
  });

  content += `<hr><h3>Stats</h3><ul>`;
  for (const [user, count] of Object.entries(userMessages)) {
    content += `<li>${user}: ${count} messages</li>`;
  }
  content += `</ul></body></html>`;

  if (!fs.existsSync('transcripts')) fs.mkdirSync('transcripts');
  const filename = `${channel.id}.html`;
  fs.writeFileSync(path.join('transcripts', filename), content);

  return `https://${DOMAIN}/transcripts/${filename}`;
}

// Slash command registration
const commands = [
  new SlashCommandBuilder().setName('setup').setDescription('Send the ticket panel'),
  new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
  new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket channel'),
  new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket channel').addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true)),
  new SlashCommandBuilder().setName('add').setDescription('Add a user to the ticket').addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true)),
  new SlashCommandBuilder().setName('remove').setDescription('Remove a user from the ticket').addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)),
  new SlashCommandBuilder().setName('transcript').setDescription('Generate transcript for this ticket')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);
client.on('ready', async () => {
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered');
  } catch (err) {
    console.error('Slash command error:', err);
  }
});

client.login(TOKEN);
