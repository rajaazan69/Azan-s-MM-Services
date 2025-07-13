const {
  Client, GatewayIntentBits, Partials, ChannelType,
  PermissionsBitField, ActionRowBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, EmbedBuilder,
  ButtonBuilder, ButtonStyle, AttachmentBuilder, SlashCommandBuilder,
  REST, Routes
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const PORT = process.env.PORT || 3000;
const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525';
const PANEL_CHANNEL = '1373048211538841702';
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';
const BASE_URL = process.env.BASE_URL;
const TAGS_FILE = path.join(__dirname, 'tags.json');

app.get('/', (req, res) => res.send('Bot is online.'));
app.get('/transcripts/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'transcripts', req.params.filename);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).send('Transcript not found.');
});
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

// Register slash commands on startup
(async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Send ticket panel to selected channel')
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(false)),
    new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
    new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket'),
    new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket').addStringOption(o => o.setName('name').setDescription('New name').setRequired(true)),
    new SlashCommandBuilder().setName('add').setDescription('Add user to ticket').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('remove').setDescription('Remove user from ticket').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('transcript').setDescription('Generate transcript'),
    new SlashCommandBuilder().setName('tagcreate').setDescription('Create tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Tag message').setRequired(true)),
    new SlashCommandBuilder().setName('tag').setDescription('Send tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
    new SlashCommandBuilder().setName('tagdelete').setDescription('Delete tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
    new SlashCommandBuilder().setName('taglist').setDescription('List all tags')
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands('1392944799983730849'), { body: commands });
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
})();

client.once('ready', () => console.log(`Bot online as ${client.user.tag}`));

client.on('interactionCreate', async interaction => {
  const { commandName, options, channel, guild } = interaction;

  if (interaction.isChatInputCommand()) {
    if (commandName === 'setup') {
      const target = options.getChannel('channel') || await client.channels.fetch(PANEL_CHANNEL);
      const embed = new EmbedBuilder()
        .setTitle('**Request Middleman**')
        .setDescription('Click below to request Azan’s services.')
        .setColor('Blue');
      const btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('openTicket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
      );
      await target.send({ embeds: [embed], components: [btn] });
      return interaction.reply({ content: `✅ Panel sent to ${target}`, ephemeral: true });
    }

    if (commandName === 'close') {
      const perms = channel.permissionOverwrites.cache;
      const ticketOwner = [...perms.values()].find(po =>
        po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
        po.id !== OWNER_ID && po.id !== MIDDLEMAN_ROLE && po.id !== guild.id
      )?.id;

      for (const [id] of perms)
        if (![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(id))
          channel.permissionOverwrites.edit(id, { SendMessages: false, ViewChannel: false }).catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription('Choose below to get transcript or delete.')
        .addFields(
          { name: 'Ticket Name', value: channel.name },
          { name: 'Owner', value: ticketOwner ? `<@${ticketOwner}> (${ticketOwner})` : 'Unknown' }
        )
        .setColor('#2B2D31')
        .setFooter({ text: `Closed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('delete').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
      );
      return interaction.reply({ embeds: [embed], components: [row] });
    }

    if (commandName === 'delete') return channel.delete();
    if (commandName === 'rename') {
      await channel.setName(options.getString('name'));
      return interaction.reply({ content: `Renamed successfully.`, ephemeral: true });
    }
    if (commandName === 'add') {
      const user = options.getUser('user');
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
      return interaction.reply({ content: `${user} added.`, ephemeral: true });
    }
    if (commandName === 'remove') {
      const user = options.getUser('user');
      await channel.permissionOverwrites.delete(user.id);
      return interaction.reply({ content: `${user} removed.`, ephemeral: true });
    }
    if (commandName === 'transcript') return handleTranscript(interaction, channel);

    // TAG COMMANDS
    const tags = loadTags();
    if (commandName === 'tagcreate') {
      tags[options.getString('name').toLowerCase()] = options.getString('message');
      saveTags(tags);
      return interaction.reply({ content: `✅ Tag saved.`, ephemeral: true });
    }
    if (commandName === 'tag') {
      const tag = tags[options.getString('name').toLowerCase()];
      if (!tag) return interaction.reply({ content: '❌ Tag not found.', ephemeral: true });
      return interaction.reply({ content: tag });
    }
    if (commandName === 'tagdelete') {
      const name = options.getString('name').toLowerCase();
      if (!tags[name]) return interaction.reply({ content: '❌ Tag not found.', ephemeral: true });
      delete tags[name]; saveTags(tags);
      return interaction.reply({ content: `✅ Tag deleted.`, ephemeral: true });
    }
    if (commandName === 'taglist') {
      const keys = Object.keys(tags);
      const desc = keys.length ? keys.map(t => `• \`${t}\``).join('\n') : 'No tags saved.';
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏷️ Tags').setDescription(desc).setColor('#00cc99')], ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'transcript') return handleTranscript(interaction, channel);
    if (interaction.customId === 'delete') return channel.delete();
  }
});

function loadTags() {
  try { return JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8')); } catch { return {}; }
}
function saveTags(tags) {
  fs.writeFileSync(TAGS_FILE, JSON.stringify(tags, null, 2));
}

async function handleTranscript(interaction, channel) {
  await interaction.deferReply({ ephemeral: true });
  const htmlLink = await generateTranscript(channel);
  const txtFile = await generateTextTranscript(channel);

  const messages = await channel.messages.fetch({ limit: 100 });
  const participants = new Map();
  messages.forEach(msg => {
    const id = msg.author.id;
    participants.set(id, (participants.get(id) || 0) + 1);
  });

  const mentionList = [...participants.entries()]
    .map(([id, count]) => `• <@${id}>: ${count} messages`)
    .join('\n');

  const perms = channel.permissionOverwrites.cache;
  const ticketOwner = [...perms.values()].find(po =>
    po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
    po.id !== OWNER_ID && po.id !== MIDDLEMAN_ROLE && po.id !== channel.guild.id
  )?.id;

  const embed = new EmbedBuilder()
    .setTitle('📄 Transcript Ready')
    .setDescription(`[Click to view transcript](${htmlLink})`)
    .addFields(
      { name: 'Ticket Name', value: channel.name, inline: true },
      { name: 'Owner', value: ticketOwner ? `<@${ticketOwner}> (${ticketOwner})` : 'Unknown', inline: true },
      { name: 'Participants', value: mentionList || 'No messages.' }
    )
    .setColor('#4fc3f7')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], files: [txtFile] });

  const logChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logChannel) await logChannel.send({ embeds: [embed], files: [txtFile] });
}

async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const participants = new Map();

  const lines = sorted.map(m => {
    const tag = `${m.author.username}#${m.author.discriminator}`;
    participants.set(m.author.id, (participants.get(m.author.id) || 0) + 1);
    return `<p><strong>${tag}</strong> <em>${new Date(m.createdTimestamp).toLocaleString()}</em>: ${m.cleanContent}</p>`;
  });

  const stats = [...participants.entries()].map(([id, count]) => `<li><a href="https://discord.com/users/${id}">${id}</a>: ${count} messages</li>`).join('');
  const html = `<html><head><title>Transcript for ${channel.name}</title></head><body><h2>${channel.name}</h2><h3>Participants</h3><ul>${stats}</ul><hr>${lines.join('')}<hr></body></html>`;

  const filename = `${channel.id}.html`;
  const filepath = path.join(__dirname, 'transcripts');
  if (!fs.existsSync(filepath)) fs.mkdirSync(filepath);
  fs.writeFileSync(path.join(filepath, filename), html);
  return `${BASE_URL}/transcripts/${filename}`;
}

async function generateTextTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].reverse();
  let content = `Transcript for #${channel.name}\n\n`;
  for (const msg of sorted) {
    const time = msg.createdAt.toISOString();
    const clean = msg.content || '[Embed/Attachment]';
    content += `[${time}] ${msg.author.tag}: ${clean}\n`;
  }
  const fileName = `transcript-${channel.id}.txt`;
  const filePath = path.join(__dirname, 'transcripts', fileName);
  if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return new AttachmentBuilder(filePath);
}

client.login(process.env.TOKEN);
setInterval(() => { fetch(BASE_URL).catch(() => {}); }, 5 * 60 * 1000);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));