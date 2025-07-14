// index.js
const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField,
  ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
  SlashCommandBuilder, REST, Routes
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./tags.db');

db.run(`CREATE TABLE IF NOT EXISTS tags (name TEXT PRIMARY KEY, message TEXT NOT NULL)`);

const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const PORT = process.env.PORT || 3000;
const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525';
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';
const BASE_URL = process.env.BASE_URL;

app.get('/', (_, res) => res.send('Bot is online.'));
app.get('/transcripts/:filename', (req, res) => {
  const file = path.join(__dirname, 'transcripts', req.params.filename);
  if (fs.existsSync(file)) res.sendFile(file);
  else res.status(404).send('Transcript not found.');
});
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

client.once('ready', async () => {
  console.log(`Bot online as ${client.user.tag}`);
  if (process.env.REGISTER_COMMANDS === 'true') {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const old = await rest.get(Routes.applicationCommands(client.user.id));
    for (const cmd of old) await rest.delete(Routes.applicationCommand(client.user.id, cmd.id));

    const cmds = [
      new SlashCommandBuilder().setName('setup').setDescription('Send ticket panel').addChannelOption(opt => opt.setName('channel').setDescription('Target').setRequired(true)),
      new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
      new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket'),
      new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket').addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true)),
      new SlashCommandBuilder().setName('add').setDescription('Add a user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('remove').setDescription('Remove a user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('transcript').setDescription('Generate transcript'),
      new SlashCommandBuilder().setName('tagcreate').setDescription('Create tag').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Message').setRequired(true)),
      new SlashCommandBuilder().setName('tag').setDescription('Use tag').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)),
      new SlashCommandBuilder().setName('tagdelete').setDescription('Delete tag').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)),
      new SlashCommandBuilder().setName('taglist').setDescription('List tags')
    ].map(c => c.toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: cmds });
    console.log('✅ Commands registered');
  }
});

client.on('interactionCreate', async interaction => {
  try {
    const { commandName, options, channel, guild } = interaction;

    if (interaction.isChatInputCommand()) {
      // SETUP
      if (commandName === 'setup') {
        const target = options.getChannel('channel');
        const embed = new EmbedBuilder()
          .setTitle('**Request Middleman**')
          .setDescription('**Click Below To Request Azan’s Services**\nPlease answer all the questions correctly.')
          .setColor('Blue');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('openTicket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
        );
        await target.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Setup complete.', ephemeral: true });
      }

      // CLOSE
      if (commandName === 'close') {
        if (channel.parentId !== TICKET_CATEGORY) return interaction.reply({ content: '❌ Only in tickets.', ephemeral: true });
        const perms = channel.permissionOverwrites.cache;
        const ticketOwner = [...perms.values()].find(po =>
          po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
          ![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(po.id)
        )?.id;

        for (const [id] of perms) {
          if (![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(id)) {
            await channel.permissionOverwrites.edit(id, { SendMessages: false, ViewChannel: false });
          }
        }

        const embed = new EmbedBuilder()
          .setTitle('🔒 Ticket Closed')
          .setDescription('Select an option below to generate a transcript or delete the ticket.')
          .addFields(
            { name: 'Ticket Name', value: channel.name, inline: true },
            { name: 'Owner', value: ticketOwner ? `<@${ticketOwner}>` : 'Unknown', inline: true }
          )
          .setFooter({ text: `Closed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setColor('#2B2D31')
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('delete').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
        );
        await interaction.reply({ embeds: [embed], components: [row] });
      }

      // Other commands...
      if (commandName === 'delete') if (channel.parentId === TICKET_CATEGORY) channel.delete();
      if (commandName === 'rename') channel.setName(options.getString('name')).then(() =>
        interaction.reply({ content: '✅ Renamed.', ephemeral: true }));
      if (commandName === 'add') channel.permissionOverwrites.edit(options.getUser('user').id, {
        SendMessages: true, ViewChannel: true
      }).then(() => interaction.reply({ content: '✅ Added.', ephemeral: true }));
      if (commandName === 'remove') channel.permissionOverwrites.delete(options.getUser('user').id).then(() =>
        interaction.reply({ content: '✅ Removed.', ephemeral: true }));

      if (commandName === 'transcript') {
        if (channel.parentId !== TICKET_CATEGORY) return interaction.reply({ content: '❌ Only in tickets.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        await handleTranscript(interaction, channel);
      }

      // Tags
      if (commandName === 'tagcreate') {
        const name = options.getString('name'), msg = options.getString('message');
        db.run('INSERT OR REPLACE INTO tags(name, message) VALUES(?, ?)', [name, msg], err =>
          interaction.reply({ content: err ? '❌ Failed to create tag.' : `✅ Tag \`${name}\` saved.`, ephemeral: true }));
      }
      if (commandName === 'tag') {
        db.get('SELECT message FROM tags WHERE name = ?', [options.getString('name')], (err, row) =>
          interaction.reply({ content: row?.message || '❌ Tag not found.', ephemeral: true }));
      }
      if (commandName === 'tagdelete') {
        db.run('DELETE FROM tags WHERE name = ?', [options.getString('name')], function (err) {
          interaction.reply({ content: this.changes ? '🗑️ Tag deleted.' : '❌ Not found.', ephemeral: true });
        });
      }
      if (commandName === 'taglist') {
        db.all('SELECT name FROM tags', (err, rows) =>
          interaction.reply({ content: rows.length ? rows.map(r => `• \`${r.name}\``).join('\n') : 'No tags.' }));
      }
    }

    // BUTTON: openTicket
    if (interaction.isButton() && interaction.customId === 'openTicket') {
      const modal = new ModalBuilder().setCustomId('ticketModal').setTitle('Middleman Request')
        .addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel("What's your side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel("Their Discord ID?").setStyle(TextInputStyle.Short).setRequired(true))
        );
      await interaction.showModal(modal);
    }

    // BUTTON: transcript
    if (interaction.isButton() && interaction.customId === 'transcript') {
      if (interaction.channel.parentId !== TICKET_CATEGORY) return;
      await interaction.deferReply({ ephemeral: true });
      await handleTranscript(interaction, interaction.channel);
    }

    // BUTTON: delete
    if (interaction.isButton() && interaction.customId === 'delete') {
      await interaction.channel.delete();
    }

    // MODAL SUBMIT
    if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
      const q1 = interaction.fields.getTextInputValue('q1');
      const q2 = interaction.fields.getTextInputValue('q2');
      const q3 = interaction.fields.getTextInputValue('q3');
      const q4 = interaction.fields.getTextInputValue('q4');
      const mention = /^\d{17,19}$/.test(q4) ? `<@${q4}>` : 'Unknown';

      const ticket = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: OWNER_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle('🎟️ Middleman Request')
        .setColor('#2B2D31')
        .setDescription(`**User 1:** <@${interaction.user.id}>\n**User 2:** ${mention}\n\n> **What's the trade?**\n> ${q1}\n\n> **User 1 is giving:**\n> ${q2}\n\n> **User 2 is giving:**\n> ${q3}`)
        .setFooter({ text: `Ticket by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await ticket.send({
        content: `<@${interaction.user.id}> <@${OWNER_ID}>`,
        embeds: [embed],
        allowedMentions: { users: [interaction.user.id, OWNER_ID] }
      });

      await interaction.reply({ content: `✅ Ticket created: ${ticket}`, ephemeral: true });
    }

  } catch (err) {
    console.error('❌ Interaction error:', err);
  }
});

// TRANSCRIPT HANDLER
async function handleTranscript(interaction, channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const participants = new Map();
  const lines = sorted.map(m => {
    participants.set(m.author.id, (participants.get(m.author.id) || 0) + 1);
    return `<p><strong>${m.author.tag}</strong> <em>${new Date(m.createdTimestamp).toLocaleString()}</em>: ${m.cleanContent}</p>`;
  });

  const stats = [...participants.entries()].map(([id, c]) =>
    `<li><a href="https://discord.com/users/${id}">${id}</a>: ${c} messages</li>`).join('');
  const html = `<html><body><h2>${channel.name}</h2><ul>${stats}</ul><hr>${lines.join('')}<hr></body></html>`;

  const dir = path.join(__dirname, 'transcripts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const htmlFile = `${channel.id}.html`;
  const txtFile = `transcript-${channel.id}.txt`;
  fs.writeFileSync(path.join(dir, htmlFile), html);
  fs.writeFileSync(path.join(dir, txtFile), sorted.map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.cleanContent}`).join('\n'));

  const htmlLink = `${BASE_URL}/transcripts/${htmlFile}`;
  const embed = new EmbedBuilder()
    .setTitle('📄 Transcript Ready')
    .setDescription(`[Click to view HTML Transcript](${htmlLink})`)
    .addFields(
      { name: 'Ticket Name', value: channel.name },
      {
        name: 'Participants',
        value: [...participants.entries()].map(([id, c]) => `<@${id}> — \`${c}\` messages`).join('\n').slice(0, 1024)
      }
    )
    .setColor('#4fc3f7')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], files: [new AttachmentBuilder(path.join(dir, txtFile))] });
  const logChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logChannel) logChannel.send({ embeds: [embed], files: [new AttachmentBuilder(path.join(dir, txtFile))] });
}

client.login(process.env.TOKEN);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
setInterval(() => fetch(BASE_URL).catch(() => {}), 5 * 60 * 1000);