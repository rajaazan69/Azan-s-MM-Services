function formatDate(dateString) {
    const date = new Date(dateString);
    const M = date.getMonth() + 1;
    const D = date.getDate();
    const Y = date.getFullYear();
    let H = date.getHours();
    const MIN = date.getMinutes().toString().padStart(2, '0');
    const S = date.getSeconds().toString().padStart(2, '0');
    const ampm = H >= 12 ? 'PM' : 'AM';
    H = H % 12 || 12;
    return `${M}/${D}/${Y} - ${H}:${MIN}:${S} ${ampm}`;
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30.4375);
    const years = Math.round(days / 365.25);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
}
const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField,
  ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
  import { SlashCommandBuilder, REST, Routes } from 'discord.js';
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const axios = require('axios');

const mongoUri = process.env.MONGO_URI;
const mongoClient = new MongoClient(mongoUri);
let tagsCollection;

mongoClient.connect().then(() => {
  const db = mongoClient.db('ticketbot');
  tagsCollection = db.collection('tags');
  console.log('✅ Connected to MongoDB Atlas');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

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
  console.log(`Bot online as ${client.user.tag}`);
  if (process.env.REGISTER_COMMANDS === 'true') {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const old = await rest.get(Routes.applicationCommands(1392944799983730849));
    for (const cmd of old) {
      await rest.delete(Routes.applicationCommand(client.user.id, cmd.id));
    }
    console.log('✅ Old commands deleted');

    const commands = [
      new SlashCommandBuilder().setName('setup').setDescription('Send ticket panel').addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true)),
      new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
      new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket'),
      new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket').addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true)),
      new SlashCommandBuilder().setName('add').setDescription('Add a user to the ticket').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('remove').setDescription('Remove a user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('transcript').setDescription('Generate a transcript'),
      new SlashCommandBuilder().setName('tagcreate').setDescription('Create a tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Tag message').setRequired(true)),
      new SlashCommandBuilder().setName('tag').setDescription('Send a saved tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
      new SlashCommandBuilder().setName('tagdelete').setDescription('Delete a tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
      new SlashCommandBuilder().setName('taglist').setDescription('List all tags')
    
  new SlashCommandBuilder()
    .setName('i')
    .setDescription('Get Roblox account info')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('The Roblox username')
        .setRequired(true)
    )
].map(command => command.toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered');
  } else {
    console.log('🟡 Skipping command registration (REGISTER_COMMANDS is false)');
  }
});

client.on('interactionCreate', async interaction => {
  try {
    const { commandName, options, channel, guild } = interaction;

    if (interaction.isChatInputCommand()) {
      if (commandName === 'setup') {
        const target = options.getChannel('channel');
        const embed = new EmbedBuilder()
          .setTitle('**Request Middleman**')
          .setDescription('**Click Below To Request Azan’s Services**\nPlease answer all the questions correctly for the best support.')
          .setColor('Blue');
        const btn = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('openTicket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
        );
        await target.send({ embeds: [embed], components: [btn] });
        await interaction.reply({ content: '✅ Setup complete.', ephemeral: true }).catch(() => {});
      }

      if (commandName === 'tagcreate') {
  await interaction.deferReply({ ephemeral: true }).catch(() => {});
  const name = options.getString('name');
  const message = options.getString('message');
  try {
    await tagsCollection.updateOne(
      { name },
      { $set: { message } },
      { upsert: true }
    );
    await interaction.editReply({ content: `✅ Tag \`${name}\` saved.` });
  } catch (err) {
    console.error('❌ Tag create failed:', err);
    await interaction.editReply({ content: '❌ Failed to create tag.' });
  }
} // ✅ <---- This is needed!

      if (commandName === 'tag') {
        const name = options.getString('name');
        try {
  const tag = await tagsCollection.findOne({ name });
  if (tag) {
    await interaction.reply({ content: tag.message.slice(0, 2000) });
  } else {
    await interaction.reply({ content: `❌ Tag \`${name}\` not found.` });
  }
} catch (err) {
  console.error('❌ Tag read error:', err);
  await interaction.reply({ content: '❌ Error reading tag.' });
}
      }

      if (commandName === 'tagdelete') {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const name = options.getString('name');
       try {
  const result = await tagsCollection.deleteOne({ name });
  if (result.deletedCount === 0) {
    await interaction.editReply({ content: `❌ Tag \`${name}\` not found.` });
  } else {
    await interaction.editReply({ content: `🗑️ Tag \`${name}\` deleted.` });
  }
} catch (err) {
  console.error('❌ Tag delete error:', err);
  await interaction.editReply({ content: '❌ Failed to delete tag.' });
}
      }

      if (commandName === 'taglist') {
        try {
  const tags = await tagsCollection.find({}).toArray();
  const list = tags.map(t => `• \`${t.name}\``).join('\n') || 'No tags found.';
  await interaction.reply({ content: list });
} catch (err) {
  console.error('❌ Tag list error:', err);
  await interaction.reply({ content: '❌ Failed to fetch tag list.' });
}
      }

      if (commandName === 'close') {
  console.log('[DEBUG] /close command triggered');

  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({ ephemeral: true });
      console.log('[DEBUG] Interaction deferred');
    } catch (err) {
      console.error('[ERROR] Could not defer interaction:', err);
      return;
    }
  }

  try {
    const parentId = channel.parentId || channel.parent?.id;
    if (parentId !== TICKET_CATEGORY) {
      return interaction.editReply({
        content: '❌ You can only close ticket channels!'
      });
    }

    const perms = channel.permissionOverwrites.cache;
    const ticketOwner = [...perms.values()].find(po =>
      po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
      po.id !== OWNER_ID &&
      po.id !== MIDDLEMAN_ROLE &&
      po.id !== guild.id
    )?.id;

    // Lock the ticket - don't await each one individually
    const updates = [...perms.entries()]
      .filter(([id]) => ![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(id))
      .map(([id]) =>
        channel.permissionOverwrites.edit(id, {
          SendMessages: false,
          ViewChannel: false
        }).catch(err => {
          console.warn(`⚠️ Could not update permissions for ${id}:`, err.code || err.message);
        })
      );

    await Promise.allSettled(updates);

    const embed = new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setDescription('Select an option below to generate the transcript or delete the ticket.')
      .addFields(
        { name: 'Ticket Name', value: channel.name, inline: true },
        {
          name: 'Owner',
          value: ticketOwner ? `<@${ticketOwner}> (${ticketOwner})` : 'Unknown',
          inline: true
        }
      )
      .setColor('#2B2D31')
      .setFooter({
        text: `Closed by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('delete').setLabel('🗑️ Delete').setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    console.log('[DEBUG] Close panel sent');

  } catch (err) {
    console.error('❌ /close command error:', err);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Failed to close ticket.', ephemeral: true });
      } else {
        await interaction.editReply({ content: '❌ Failed to close ticket.' });
      }
    } catch (editErr) {
      console.error('❌ Failed to send error reply:', editErr);
    }
  }
}
      if (commandName === 'delete') {
        const parentId = channel.parentId || channel.parent?.id;
        if (parentId === TICKET_CATEGORY) await channel.delete();
        else await interaction.reply({ content: '❌ You can only delete ticket channels!', ephemeral: true });
      }

      if (commandName === 'rename') {
        const newName = options.getString('name');
        if ((channel.parentId || channel.parent?.id) !== TICKET_CATEGORY) return interaction.reply({ content: '❌ You can only rename ticket channels!', ephemeral: true });
        await channel.setName(newName);
        return interaction.reply({ content: `✅ Renamed to \`${newName}\``, ephemeral: true });
      }

      if (commandName === 'add') {
        const user = options.getUser('user');
        if ((channel.parentId || channel.parent?.id) !== TICKET_CATEGORY) return interaction.reply({ content: '❌ You can only add users in ticket channels!', ephemeral: true });
        await channel.permissionOverwrites.edit(user.id, { SendMessages: true, ViewChannel: true });
        await interaction.reply({ content: `✅ ${user} added.`, ephemeral: true });
      }

      if (commandName === 'remove') {
        const user = options.getUser('user');
        if ((channel.parentId || channel.parent?.id) !== TICKET_CATEGORY) return interaction.reply({ content: '❌ You can only remove users in ticket channels!', ephemeral: true });
        await channel.permissionOverwrites.delete(user.id);
        await interaction.reply({ content: `✅ ${user} removed.`, ephemeral: true });
      }

      if (commandName === 'transcript') {
        if ((channel.parentId || channel.parent?.id) !== TICKET_CATEGORY) return interaction.reply({ content: '❌ You can only generate transcripts in ticket channels!', ephemeral: true });
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        await handleTranscript(interaction, channel);
      }
    }
          if (commandName === 'i') {
        const username = options.getString('username');
        if (!username) return interaction.reply({ content: '❌ Provide a Roblox username.', ephemeral: true });

        try {
          await interaction.deferReply({ ephemeral: true });
          const userInfo = await axios.get(`https://users.roblox.com/v1/usernames/users`, {
            headers: { 'Content-Type': 'application/json' },
            data: { usernames: [username], excludeBannedUsers: false },
            method: 'POST'
          });

          if (!userInfo.data.data.length) {
            return interaction.editReply({ content: '❌ No user found with that username.' });
          }

          const id = userInfo.data.data[0].id;
          const details = await axios.get(`https://users.roblox.com/v1/users/${id}`);
          const avatar = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=png`);

          const embed = new EmbedBuilder()
            .setTitle(`🔎 Roblox Info for ${details.data.name}`)
            .setThumbnail(avatar.data.data[0].imageUrl)
            .setColor('Random')
            .addFields(
              { name: 'Display Name', value: details.data.displayName || 'Unknown', inline: true },
              { name: 'Username', value: details.data.name, inline: true },
              { name: 'User ID', value: id.toString(), inline: true },
              { name: 'Description', value: details.data.description || 'No description.', inline: false },
              { name: 'Profile', value: `https://roblox.com/users/${id}/profile`, inline: false }
            )
            .setFooter({ text: 'Powered by Roblox API' });

          return interaction.editReply({ embeds: [embed] });
        } catch (err) {
          console.error(err);
          return interaction.editReply({ content: '❌ Failed to fetch user info.' });
        }
      }

    // ✅ BUTTON: Open Modal
    if (interaction.isButton() && interaction.customId === 'openTicket') {
      const modal = new ModalBuilder()
        .setCustomId('ticketModal')
        .setTitle('Middleman Request')
        .addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel("What's your side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel("Their Discord ID?").setStyle(TextInputStyle.Short).setRequired(true))
        );
      await interaction.showModal(modal).catch(console.error);
    }

    // ✅ BUTTON: Transcript Fix
    if (interaction.isButton() && interaction.customId === 'transcript') {
      const parentId = interaction.channel.parentId || interaction.channel.parent?.id;
      if (parentId !== TICKET_CATEGORY) {
        return interaction.reply({ content: '❌ You can only use this inside ticket channels.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      await handleTranscript(interaction, interaction.channel);
    }
    
if (interaction.commandName === 'i') {
  const username = interaction.options.getString('username');
  await interaction.deferReply({ ephemeral: true });

  try {
    const response = await axios.post(
      'https://users.roblox.com/v1/usernames/users',
      { usernames: [username], excludeBannedUsers: false },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const user = response.data.data[0];
    if (!user) return interaction.editReply({ content: `❌ No user found for **${username}**.` });

    const [userInfo, friends, followers, following] = await Promise.all([
      axios.get(`https://users.roblox.com/v1/users/${user.id}`),
      axios.get(`https://friends.roblox.com/v1/users/${user.id}/friends/count`),
      axios.get(`https://friends.roblox.com/v1/users/${user.id}/followers/count`),
      axios.get(`https://friends.roblox.com/v1/users/${user.id}/followings/count`)
    ]);

    const info = userInfo.data;
    const joined = new Date(info.created).toLocaleDateString();

    const embed = new EmbedBuilder()
      .setTitle(`${user.name}'s Roblox Info`)
      .setURL(`https://www.roblox.com/users/${user.id}/profile`)
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${user.id}&width=420&height=420&format=png`)
      .addFields(
        { name: 'Username', value: user.name, inline: true },
        { name: 'Display Name', value: user.displayName, inline: true },
        { name: 'User ID', value: String(user.id), inline: true },
        { name: 'Friends', value: friends.data.count.toString(), inline: true },
        { name: 'Followers', value: followers.data.count.toString(), inline: true },
        { name: 'Following', value: following.data.count.toString(), inline: true },
        { name: 'Join Date', value: joined, inline: true },
        { name: 'Description', value: info.description || 'No description set.' }
      )
      .setColor('#00b0f4');

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    interaction.editReply({ content: '⚠️ Failed to fetch user info.' });
  }
}
    // ✅ BUTTON: Delete
    if (interaction.isButton() && interaction.customId === 'delete') {
      await interaction.channel.delete().catch(console.error);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
      // Prevent multiple tickets per user
const existing = interaction.guild.channels.cache.find(c =>
  c.parentId === TICKET_CATEGORY &&
  c.permissionOverwrites.cache.has(interaction.user.id)
);

if (existing) {
  return interaction.reply({ content: `❌ You already have an open ticket: ${existing}`, ephemeral: true });
}
      const q1 = interaction.fields.getTextInputValue('q1');
      const q2 = interaction.fields.getTextInputValue('q2');
      const q3 = interaction.fields.getTextInputValue('q3');
      const q4 = interaction.fields.getTextInputValue('q4');
const isValidId = /^\d{17,19}$/.test(q4);
const targetMention = isValidId ? `<@${q4}>` : 'Unknown User';

// Prepare permission overwrites array
const permissionOverwrites = [
  { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
  { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
  { id: OWNER_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
  { id: MIDDLEMAN_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
];

// Add the target user to permission overwrites if ID is valid and member exists
if (isValidId) {
  const member = interaction.guild.members.cache.get(q4);
  if (member) {
    permissionOverwrites.push({
      id: q4,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
    });
  }
}

const ticket = await interaction.guild.channels.create({
  name: `ticket-${interaction.user.username}`,
  type: ChannelType.GuildText,
  parent: TICKET_CATEGORY,
  permissionOverwrites
});
      const embed = new EmbedBuilder()
  .setTitle('Middleman Request')
  .setColor('#2B2D31')
  .setDescription(
    `**User 1:** <@${interaction.user.id}>\n` +
    `**User 2:** ${targetMention}\n\n` +
    `**Trade Details**\n` +
    `> ${q1}\n\n` +
    `**User 1 is giving:**\n` +
    `> ${q2}\n\n` +
    `**User 2 is giving:**\n` +
    `> ${q3}`
  )
  .setFooter({ text: `Ticket by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
  .setTimestamp();

        await ticket.send({
  content: `<@${interaction.user.id}> <@${OWNER_ID}>`,
  embeds: [embed]
});
          

        await interaction.reply({ content: `✅ Ticket created: ${ticket}`, ephemeral: true });
      
    }

  } catch (err) {
    console.error('❌ Interaction error:', err);
  }
});

async function handleTranscript(interaction, channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const participants = new Map();
  const lines = sorted.map(m => {
    participants.set(m.author.id, (participants.get(m.author.id) || 0) + 1);
    const tag = `${m.author.username}#${m.author.discriminator}`;
    return `<p><strong>${tag}</strong> <em>${new Date(m.createdTimestamp).toLocaleString()}</em>: ${m.cleanContent}</p>`;
  });
  const stats = [...participants.entries()].map(([id, count]) => `<li><strong><a href="https://discord.com/users/${id}">${id}</a></strong>: ${count} messages</li>`).join('');
  const html = `<html><head><title>Transcript for ${channel.name}</title></head><body><h2>${channel.name}</h2><h3>Participants</h3><ul>${stats}</ul><hr>${lines.join('')}<hr></body></html>`;
  const filename = `${channel.id}.html`;
  const filepath = path.join(__dirname, 'transcripts');
  if (!fs.existsSync(filepath)) fs.mkdirSync(filepath);
  fs.writeFileSync(path.join(filepath, filename), html);
  const htmlLink = `${BASE_URL}/transcripts/${filename}`;
  const txtLines = sorted.map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.cleanContent || '[Embed/Attachment]'}`).join('\n');
  const txtPath = path.join(filepath, `transcript-${channel.id}.txt`);
  fs.writeFileSync(txtPath, txtLines);
  const embed = new EmbedBuilder()
    .setTitle('📄 Transcript Ready')
    .setDescription(`[Click to view HTML Transcript](${htmlLink})`)
    .addFields(
      { name: 'Ticket Name', value: channel.name, inline: true },
      {
        name: 'Participants',
        value: [...participants.entries()].map(([id, count]) => `<@${id}> — \`${count}\` messages`).join('\n').slice(0, 1024) || 'None',
        inline: false
      }
    )
    .setColor('#4fc3f7')
    .setTimestamp();
  await interaction.editReply({ embeds: [embed], files: [new AttachmentBuilder(txtPath)] }).catch(() => {});
  const logChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logChannel) await logChannel.send({ embeds: [embed], files: [new AttachmentBuilder(txtPath)] });
}

client.on('error', console.error);
process.on('unhandledRejection', (reason, p) => console.error('Unhandled Rejection:', reason));
client.login(process.env.TOKEN);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
setInterval(() => { fetch(BASE_URL).catch(() => {}); }, 5 * 60 * 1000);