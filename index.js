const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField,
  ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
  SlashCommandBuilder, REST, Routes
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase init
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const db = require('better-sqlite3')('tags.db');
db.prepare(`CREATE TABLE IF NOT EXISTS tags (name TEXT PRIMARY KEY, message TEXT NOT NULL)`).run();

const PORT = process.env.PORT || 3000;
const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525';
const PANEL_CHANNEL = '1373048211538841702';
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';
const BASE_URL = process.env.BASE_URL;

app.get('/', (req, res) => res.send('Bot is online.'));
app.get('/transcripts/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'transcripts', req.params.filename);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).send('Transcript not found.');
});
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  if (process.env.REGISTER_COMMANDS === 'true') {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const cmds = [
      new SlashCommandBuilder().setName('setup').setDescription('Send ticket panel').addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true)),
      new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
      new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket'),
      new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket').addStringOption(o => o.setName('name').setDescription('New name').setRequired(true)),
      new SlashCommandBuilder().setName('add').setDescription('Add user to ticket').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('remove').setDescription('Remove user from ticket').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('transcript').setDescription('Generate transcript'),
      new SlashCommandBuilder().setName('tagcreate').setDescription('Create a tag').addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Message').setRequired(true)),
      new SlashCommandBuilder().setName('tag').setDescription('Send a tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
      new SlashCommandBuilder().setName('tagdelete').setDescription('Delete a tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
      new SlashCommandBuilder().setName('taglist').setDescription('List all tags')
    ];
    await rest.put(Routes.applicationCommands(client.user.id), { body: cmds.map(c => c.toJSON()) });
    console.log('✅ Slash commands registered');
  }
});

client.on('interactionCreate', async interaction => {
  const { commandName, options, channel, guild, user } = interaction;

  if (interaction.isChatInputCommand()) {
    console.log(`📘 /${commandName} by ${user.tag} in #${channel?.name}`);

    if (commandName === 'setup') {
      const target = options.getChannel('channel');
      const embed = new EmbedBuilder().setTitle('**Request Middleman**').setDescription('Click below to request Azan’s services.\nPlease answer all questions correctly.').setColor('Blue');
      const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('openTicket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary));
      await target.send({ embeds: [embed], components: [btn] });
      return interaction.reply({ content: '✅ Panel sent.', ephemeral: true });
    }

    // --- TAG COMMANDS ---
    if (commandName === 'tagcreate') {
      const name = options.getString('name');
      const message = options.getString('message');
      db.prepare(`INSERT OR REPLACE INTO tags(name, message) VALUES(?, ?)`).run(name, message);
      return interaction.reply({ content: `✅ Tag \`${name}\` saved.`, ephemeral: true });
    }

    if (commandName === 'tag') {
      const name = options.getString('name');
      const row = db.prepare('SELECT message FROM tags WHERE name = ?').get(name);
      return interaction.reply({ content: row ? row.message : `❌ Tag \`${name}\` not found.` });
    }

    if (commandName === 'tagdelete') {
      const name = options.getString('name');
      const info = db.prepare('DELETE FROM tags WHERE name = ?').run(name);
      return interaction.reply({ content: info.changes ? `🗑️ Tag \`${name}\` deleted.` : `❌ Tag \`${name}\` not found.`, ephemeral: true });
    }

    if (commandName === 'taglist') {
      const rows = db.prepare('SELECT name FROM tags').all();
      const list = rows.map(r => `• \`${r.name}\``).join('\n') || 'No tags found.';
      return interaction.reply({ content: list });
    }

    // --- TICKET COMMANDS ---
    if (!channel || channel.parentId !== TICKET_CATEGORY) {
      return interaction.reply({ content: '❌ This command can only be used in ticket channels!', ephemeral: true });
    }

    if (commandName === 'close') {
      const ticketOwnerId = [...channel.permissionOverwrites.cache.values()].find(po =>
        po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
        po.id !== OWNER_ID && po.id !== MIDDLEMAN_ROLE && po.id !== guild.id
      )?.id;

      for (const [id] of channel.permissionOverwrites.cache) {
        if (![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(id)) {
          await channel.permissionOverwrites.edit(id, { SendMessages: false, ViewChannel: false }).catch(() => {});
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription('Select an option below.')
        .addFields(
          { name: 'Ticket Name', value: channel.name, inline: true },
          { name: 'Owner', value: ticketOwnerId ? `<@${ticketOwnerId}> (${ticketOwnerId})` : 'Unknown', inline: true }
        )
        .setColor('#2B2D31')
        .setFooter({ text: `Closed by ${user.tag}`, iconURL: user.displayAvatarURL() })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('delete').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'delete') {
      return await channel.delete().catch(() => {
        interaction.reply({ content: '❌ Failed to delete channel.', ephemeral: true });
      });
    }

    if (commandName === 'rename') {
      const newName = options.getString('name');
      await channel.setName(newName);
      return interaction.reply({ content: `✅ Renamed to \`${newName}\``, ephemeral: true });
    }

    if (commandName === 'add') {
      const user = options.getUser('user');
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true, SendMessages: true
      });
      return interaction.reply({ content: `✅ ${user} added.`, ephemeral: true });
    }

    if (commandName === 'remove') {
      const user = options.getUser('user');
      await channel.permissionOverwrites.delete(user.id);
      return interaction.reply({ content: `✅ ${user} removed.`, ephemeral: true });
    }

    if (commandName === 'transcript') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      await handleTranscript(interaction, channel);
    }
  }

  // --- BUTTON INTERACTIONS ---
  if (interaction.isButton()) {
    if (interaction.customId === 'delete') return interaction.channel.delete();

    if (interaction.customId === 'transcript') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      await handleTranscript(interaction, channel);
    }

    if (interaction.customId === 'openTicket') {
      const modal = new ModalBuilder().setCustomId('ticketModal').setTitle('Middleman Request').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel("What's your side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel("Their Discord ID?").setStyle(TextInputStyle.Short).setRequired(true))
      );
      await interaction.showModal(modal);
    }
  }

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
        { id: OWNER_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: MIDDLEMAN_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const embed = new EmbedBuilder()
      .setTitle('🎟️ Middleman Request')
      .setColor('#00b0f4')
      .setDescription(
        `**User 1:** <@${interaction.user.id}>\n**User 2:** ${targetMention}\n\n` +
        `**What's the trade?**\n${q1}\n\n**User 1 is giving:**\n${q2}\n\n**User 2 is giving:**\n${q3}`
      )
      .setFooter({ text: `Ticket by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await ticket.send({ content: `<@${interaction.user.id}> <@${OWNER_ID}> <@&${MIDDLEMAN_ROLE}>`, embeds: [embed] });
    await interaction.reply({ content: `✅ Ticket created: ${ticket}`, ephemeral: true });
  }
});

async function handleTranscript(interaction, channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const participants = new Map();

  const lines = sorted.map(m => {
    participants.set(m.author.id, (participants.get(m.author.id) || 0) + 1);
    return `<p><strong>${m.author.tag}</strong> <em>${new Date(m.createdTimestamp).toLocaleString()}</em>: ${m.cleanContent}</p>`;
  });

  const stats = [...participants.entries()].map(([id, count]) => `<li><a href="https://discord.com/users/${id}">${id}</a>: ${count}</li>`).join('');
  const html = `<html><body><h2>${channel.name}</h2><ul>${stats}</ul><hr>${lines.join('')}</body></html>`;

  const filename = `${channel.id}.html`;
  const filepath = path.join(__dirname, 'transcripts');
  if (!fs.existsSync(filepath)) fs.mkdirSync(filepath);
  fs.writeFileSync(path.join(filepath, filename), html);

  // Upload to Supabase
  const { error } = await supabase.storage.from('transcripts').upload(filename, html, { contentType: 'text/html', upsert: true });
  const publicURL = `${BASE_URL}/transcripts/${filename}`;

  const embed = new EmbedBuilder()
    .setTitle('📄 Transcript Ready')
    .setDescription(`[View HTML Transcript](${publicURL})`)
    .addFields({ name: 'Ticket', value: channel.name })
    .setColor('#4fc3f7')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] }).catch(() => {});
  const log = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (log) log.send({ embeds: [embed] });
}

// Uptime system
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
setInterval(() => fetch(BASE_URL).catch(() => {}), 5 * 60 * 1000);

client.login(process.env.TOKEN);