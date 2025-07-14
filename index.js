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

const tagsPath = path.join(__dirname, 'tag.json');
let tags = {};
if (fs.existsSync(tagsPath)) {
  try {
    tags = JSON.parse(fs.readFileSync(tagsPath, 'utf-8'));
    console.log('✅ Tags loaded from tag.json');
  } catch (err) {
    console.error('❌ Failed to parse tag.json:', err);
  }
}

const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const PORT = process.env.PORT || 3000;
const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525'; // kept for permissions
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';
const BASE_URL = process.env.BASE_URL;

app.get('/', (req, res) => res.send('Bot is online.'));
app.get('/transcripts/:filename', (req, res) => {
  const fp = path.join(__dirname, 'transcripts', req.params.filename);
  if (fs.existsSync(fp)) res.sendFile(fp);
  else res.status(404).send('Transcript not found.');
});
app.listen(PORT, () => console.log(`Uptime server on port ${PORT}`));

client.once('ready', async () => {
  console.log(`Bot online as ${client.user.tag}`);
  if (process.env.REGISTER_COMMANDS === 'true') {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const existing = await rest.get(Routes.applicationCommands(client.user.id));
    for (const c of existing)
      await rest.delete(Routes.applicationCommand(client.user.id, c.id));
    console.log('✅ Old commands cleared');

    const commands = [
      new SlashCommandBuilder().setName('setup').setDescription('Send ticket panel')
        .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true)),
      new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
      new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket'),
      new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket')
        .addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true)),
      new SlashCommandBuilder().setName('add').setDescription('Add user to ticket')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('remove').setDescription('Remove user from ticket')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('transcript').setDescription('Generate a transcript'),
      new SlashCommandBuilder().setName('tagcreate').setDescription('Create a tag')
        .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Tag message').setRequired(true)),
      new SlashCommandBuilder().setName('tag').setDescription('Send a saved tag')
        .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
      new SlashCommandBuilder().setName('tagdelete').setDescription('Delete a tag')
        .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
      new SlashCommandBuilder().setName('taglist').setDescription('List tags'),
    ].map(c => c.toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered');
  }
});

client.on('interactionCreate', async interaction => {
  try {
    const { commandName, options, channel, guild } = interaction;

    // Slash commands
    if (interaction.isChatInputCommand()) {
      switch (commandName) {
        case 'setup': {
          const target = options.getChannel('channel');
          const embed = new EmbedBuilder()
            .setTitle('**Request Middleman**')
            .setDescription('**Click Below To Request Azan’s Services**\nPlease answer all the questions correctly.')
            .setColor('Blue');
          const btn = new ActionRowBuilder()
            .addComponents(new ButtonBuilder()
              .setCustomId('openTicket')
              .setLabel('Request Middleman')
              .setStyle(ButtonStyle.Primary));
          await target.send({ embeds: [embed], components: [btn] });
          return interaction.reply({ content: '✅ Setup complete.', ephemeral: true });
        }
        case 'close': {
          const parentId = channel.parentId;
          if (parentId !== TICKET_CATEGORY)
            return interaction.reply({ content: '❌ Only in ticket channels', ephemeral: true });
          const perms = channel.permissionOverwrites.cache;
          for (const [id] of perms) {
            if (![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(id))
              await channel.permissionOverwrites.edit(id, { SendMessages: false, ViewChannel: false });
          }
          const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription('Select an option to generate transcript or delete')
            .addFields(
              { name: 'Ticket Name', value: channel.name, inline: true },
              { name: 'Owner', value: `<@${options.user?.id || 'Unknown'}>`, inline: true }
            )
            .setColor('#2B2D31')
            .setFooter({ text: `Closed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder().setCustomId('transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('delete').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
            );
          return interaction.reply({ embeds: [embed], components: [row] });
        }
        case 'delete': {
          const parentId = channel.parentId;
          if (parentId === TICKET_CATEGORY) return channel.delete();
          else return interaction.reply({ content: '❌ Only delete ticket channels', ephemeral: true });
        }
        case 'rename': {
          if (channel.parentId !== TICKET_CATEGORY)
            return interaction.reply({ content: '❌ Only rename ticket channels', ephemeral: true });
          const newName = options.getString('name');
          await channel.setName(newName);
          return interaction.reply({ content: `✅ Renamed to \`${newName}\``, ephemeral: true });
        }
        case 'add': {
          if (channel.parentId !== TICKET_CATEGORY)
            return interaction.reply({ content: '❌ Only tickets', ephemeral: true });
          const user = options.getUser('user');
          await channel.permissionOverwrites.edit(user.id, {
            SendMessages: true,
            ViewChannel: true
          });
          return interaction.reply({ content: `✅ ${user} added.`, ephemeral: true });
        }
        case 'remove': {
          if (channel.parentId !== TICKET_CATEGORY)
            return interaction.reply({ content: '❌ Only tickets', ephemeral: true });
          const user = options.getUser('user');
          await channel.permissionOverwrites.delete(user.id);
          return interaction.reply({ content: `✅ ${user} removed.`, ephemeral: true });
        }
        case 'transcript': {
          if (channel.parentId !== TICKET_CATEGORY)
            return interaction.reply({ content: '❌ Only generate in tickets', ephemeral: true });
          await interaction.deferReply({ ephemeral: true });
          return handleTranscript(interaction, channel);
        }
        case 'tagcreate': {
          await interaction.deferReply({ ephemeral: true });
          const name = options.getString('name'), msg = options.getString('message');
          db.run(`INSERT OR REPLACE INTO tags(name, message) VALUES(?,?)`, [name, msg], err => {
            if (err) return interaction.editReply({ content: '❌ Failed to create tag' });
            interaction.editReply({ content: `✅ Tag \`${name}\` saved.` });
          });
          break;
        }
        case 'tag': {
          const name = options.getString('name');
          db.get('SELECT message FROM tags WHERE name = ?', [name], (err, row) => {
            if (err) return interaction.reply({ content: '❌ Error reading tag.' });
            if (row) interaction.reply({ content: row.message.slice(0, 2000) });
            else interaction.reply({ content: `❌ Tag \`${name}\` not found.` });
          });
          break;
        }
        case 'tagdelete': {
          await interaction.deferReply({ ephemeral: true });
          db.run('DELETE FROM tags WHERE name = ?', [options.getString('name')], function(err) {
            if (err) return interaction.editReply({ content: '❌ Delete failed.' });
            interaction.editReply({ content: this.changes ? `🗑️ Tag deleted.` : '❌ Not found.' });
          });
          break;
        }
        case 'taglist': {
          db.all('SELECT name FROM tags', (err, rows) => {
            if (err) return interaction.reply({ content: '❌ Failed to fetch tags.' });
            const list = rows.map(r => `• \`${r.name}\``).join('\n') || 'No tags found.';
            interaction.reply({ content: list, ephemeral: true });
          });
          break;
        }
      }
    }
    
    // Button handlers
    if (interaction.isButton()) {
      if (interaction.customId === 'openTicket') {
        const modal = new ModalBuilder()
          .setCustomId('ticketModal')
          .setTitle('Middleman Request')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('q2').setLabel("What's your side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('q4').setLabel("Their Discord ID?").setStyle(TextInputStyle.Short).setRequired(true))
          );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'transcript') {
        if (channel.parentId !== TICKET_CATEGORY)
          return interaction.reply({ content: '❌ Only in tickets', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        return handleTranscript(interaction, channel);
      }

      if (interaction.customId === 'delete') {
        return channel.delete().catch(console.error);
      }
    }

    // Modal submit – only here!
    if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
      const q1 = interaction.fields.getTextInputValue('q1');
      const q2 = interaction.fields.getTextInputValue('q2');
      const q3 = interaction.fields.getTextInputValue('q3');
      const q4 = interaction.fields.getTextInputValue('q4');
      const targetMention = /^\d{17,19}$/.test(q4) ? `<@${q4}>` : 'Unknown User';

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
        .setDescription(`**User 1:** <@${interaction.user.id}>\n**User 2:** ${targetMention}\n\n**What's the trade?**\n> ${q1}\n\n**User 1 is giving:**\n> ${q2}\n\n**User 2 is giving:**\n> ${q3}`)
        .setFooter({ text: `Ticket by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await ticket.send({ content: `<@${interaction.user.id}> <@${OWNER_ID}>`, embeds: [embed] });
      await interaction.reply({ content: `✅ Ticket created: ${ticket}`, ephemeral: true });
    }
  } catch (err) {
    console.error('❌ Interaction error:', err);
  }
});

// Transcript helper
async function handleTranscript(interaction, channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const participants = new Map();
  for (const m of sorted) participants.set(m.author.id, (participants.get(m.author.id) || 0) + 1);

  const lines = sorted.map(m =>
    `<p><strong>${m.author.username}#${m.author.discriminator}</strong> <em>${new Date(m.createdTimestamp).toLocaleString()}</em>: ${m.cleanContent}"
);
  const stats = [...participants.entries()].map(([id, cnt]) =>
    `<li><strong><a href="https://discord.com/users/${id}">${id}</a></strong>: ${cnt} messages</li>`
  ).join('');

  const html = `<html><body><h2>${channel.name}</h2><ul>${stats}</ul><hr>${lines.join('')}<hr></body></html>`;
  const dir = path.join(__dirname, 'transcripts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const htmlFile = `${channel.id}.html`;
  const txtFile = `transcript-${channel.id}.txt`;
  fs.writeFileSync(path.join(dir, htmlFile), html);
  const txt = sorted.map(m =>
    `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.cleanContent || '[Embed/Attachment]'}`
  ).join('\n');
  fs.writeFileSync(path.join(dir, txtFile), txt);

  const htmlLink = `${BASE_URL}/transcripts/${htmlFile}`;
  const embed = new EmbedBuilder()
    .setTitle('📄 Transcript Ready')
    .setDescription(`[Click to view HTML Transcript](${htmlLink})`)
    .addFields(
      { name: 'Ticket Name', value: channel.name, inline: true },
      { name: 'Participants', value: [...participants.entries()]
          .map(([id, cnt]) => `<@${id}> — \`${cnt}\` messages`).join('\n').slice(0, 1024), inline: false }
    )
    .setColor('#4fc3f7')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], files: [new AttachmentBuilder(path.join(dir, txtFile))] });
  const logCh = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logCh) logCh.send({ embeds: [embed], files: [new AttachmentBuilder(path.join(dir, txtFile))] });
}

client.login(process.env.TOKEN);
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
setInterval(() => fetch(BASE_URL).catch(console.error), 5 * 60 * 1000);