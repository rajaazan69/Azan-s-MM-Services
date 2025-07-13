const {
  Client, GatewayIntentBits, Partials, ChannelType,
  PermissionsBitField, ActionRowBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, EmbedBuilder,
  ButtonBuilder, ButtonStyle, AttachmentBuilder,
  SlashCommandBuilder, REST, Routes
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

client.once('ready', () => {
  console.log(`Bot online as ${client.user.tag}`);
});

// TEMP: Clear all global slash commands
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
  try {
    console.log('⛔ Clearing global slash commands...');
    await rest.put(
      Routes.applicationCommands('1392944799983730849'),
      { body: [] }
    );
    console.log('✅ All commands removed.');
  } catch (error) {
    console.error(error);
  }
})();
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName, options, channel, guild } = interaction;

    if (commandName === 'setup') {
      const target = options.getChannel('channel');
      if (!target || target.type !== ChannelType.GuildText) return interaction.reply({ content: 'Invalid channel.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle('**Request Middleman**')
        .setDescription('Click below to request Azan’s services.\nAnswer all the questions carefully.')
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
          await channel.permissionOverwrites.edit(id, { SendMessages: false, ViewChannel: false }).catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription('Select an option below to generate the transcript or delete the ticket.')
        .addFields(
          { name: 'Ticket Name', value: channel.name, inline: true },
          { name: 'Owner', value: ticketOwner ? `<@${ticketOwner}> (${ticketOwner})` : 'Unknown', inline: true }
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
      const name = options.getString('name');
      await channel.setName(name);
      return interaction.reply({ content: `Renamed to ${name}`, ephemeral: true });
    }
    if (commandName === 'add') {
      const user = options.getUser('user');
      await channel.permissionOverwrites.edit(user.id, { SendMessages: true, ViewChannel: true });
      return interaction.reply({ content: `${user} added to the ticket.`, ephemeral: true });
    }
    if (commandName === 'remove') {
      const user = options.getUser('user');
      await channel.permissionOverwrites.delete(user.id);
      return interaction.reply({ content: `${user} removed from the ticket.`, ephemeral: true });
    }
    if (commandName === 'transcript') return handleTranscript(interaction, channel);

    // tag commands
    if (commandName === 'tagcreate') {
      const name = options.getString('name').toLowerCase();
      const message = options.getString('message');
      const tags = loadTags();
      tags[name] = message;
      saveTags(tags);
      return interaction.reply({ content: `✅ Tag \`${name}\` created.`, ephemeral: true });
    }
    if (commandName === 'tag') {
      const name = options.getString('name').toLowerCase();
      const tags = loadTags();
      if (!tags[name]) return interaction.reply({ content: `❌ Tag \`${name}\` not found.`, ephemeral: true });
      return interaction.reply({ content: tags[name] });
    }
    if (commandName === 'tagdelete') {
      const name = options.getString('name').toLowerCase();
      const tags = loadTags();
      if (!tags[name]) return interaction.reply({ content: `❌ Tag \`${name}\` not found.`, ephemeral: true });
      delete tags[name];
      saveTags(tags);
      return interaction.reply({ content: `✅ Tag \`${name}\` deleted.`, ephemeral: true });
    }
    if (commandName === 'taglist') {
      const tags = loadTags();
      const list = Object.keys(tags).length ? Object.keys(tags).map(t => `• \`${t}\``).join('\n') : 'No tags saved.';
      const embed = new EmbedBuilder().setTitle('🏷️ Saved Tags').setDescription(list).setColor('#00cc99');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    const { customId, channel } = interaction;

    if (customId === 'openTicket') {
      const modal = new ModalBuilder().setCustomId('ticketModal').setTitle('Middleman Request')
        .addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel("What's your side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel("Their Discord ID?").setStyle(TextInputStyle.Short).setRequired(true))
        );
      await interaction.showModal(modal);
    }

    if (customId === 'transcript') await handleTranscript(interaction, channel);
    if (customId === 'delete') await channel.delete();
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
    const q1 = interaction.fields.getTextInputValue('q1');
    const q2 = interaction.fields.getTextInputValue('q2');
    const q3 = interaction.fields.getTextInputValue('q3');
    const q4 = interaction.fields.getTextInputValue('q4');

    let targetMention = /^\d{17,19}$/.test(q4) ? `<@${q4}>` : 'Unknown User';

    const ticketChannel = await interaction.guild.channels.create({
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
        `**Trade:**\n${q1}\n\n**User 1 gives:**\n${q2}\n\n**User 2 gives:**\n${q3}`
      )
      .setFooter({ text: `Ticket by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await ticketChannel.send({ content: `<@${interaction.user.id}> <@${OWNER_ID}> <@&${MIDDLEMAN_ROLE}>`, embeds: [embed] });
    return interaction.reply({ content: `🎫 Ticket created: ${ticketChannel}`, ephemeral: true });
  }
});

// Transcript system
async function handleTranscript(interaction, channel) {
  await interaction.deferReply({ ephemeral: true });

  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const participants = new Map();

  const htmlLines = sorted.map(msg => {
    participants.set(msg.author.id, (participants.get(msg.author.id) || 0) + 1);
    return `<p><strong>${msg.author.tag}</strong> <em>${new Date(msg.createdTimestamp).toLocaleString()}</em>: ${msg.cleanContent}</p>`;
  });

  const statLines = [...participants.entries()]
    .map(([id, count]) => `<li><a href="https://discord.com/users/${id}">${id}</a>: ${count} messages</li>`)
    .join('');

  const html = `
    <html><head><title>Transcript for ${channel.name}</title></head><body>
    <h2>${channel.name}</h2><ul>${statLines}</ul><hr>${htmlLines.join('')}<hr></body></html>
  `;

  const filename = `${channel.id}.html`;
  const filepath = path.join(__dirname, 'transcripts');
  if (!fs.existsSync(filepath)) fs.mkdirSync(filepath);
  fs.writeFileSync(path.join(filepath, filename), html);

  const txtContent = sorted.map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.cleanContent || '[Embed/Attachment]'}`).join('\n');
  const txtPath = path.join(filepath, `transcript-${channel.id}.txt`);
  fs.writeFileSync(txtPath, txtContent);

  const embed = new EmbedBuilder()
    .setTitle('📄 Transcript Ready')
    .setDescription(`[Click to view transcript](${BASE_URL}/transcripts/${filename})`)
    .addFields(
      { name: 'Ticket', value: channel.name, inline: true },
      { name: 'Messages', value: `${messages.size}`, inline: true }
    )
    .setColor('#4fc3f7')
    .setTimestamp();

  const txtFile = new AttachmentBuilder(txtPath);
  await interaction.editReply({ embeds: [embed], files: [txtFile] });

  const logChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logChannel) logChannel.send({ embeds: [embed], files: [txtFile] });
}

// Tag storage
function loadTags() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'tags.json'), 'utf8'));
  } catch {
    return {};
  }
}
function saveTags(tags) {
  fs.writeFileSync(path.join(__dirname, 'tags.json'), JSON.stringify(tags, null, 2));
}

client.on('error', console.error);
process.on('unhandledRejection', console.error);

// Self ping for uptime
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
setInterval(() => { fetch(BASE_URL).catch(() => {}); }, 5 * 60 * 1000);

client.login(process.env.TOKEN);