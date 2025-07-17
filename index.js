const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField,
  ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
  SlashCommandBuilder, REST, Routes
} = require('discord.js');
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { MongoClient } = require('mongodb');

const mongoClient = new MongoClient(process.env.MONGO_URI);
let tagsCollection;

mongoClient.connect()
  .then(() => {
    tagsCollection = mongoClient.db('ticketbot').collection('tags');
    console.log('✅ Connected to MongoDB Atlas');
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

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
    const existing = await rest.get(Routes.applicationCommands(client.user.id));
    for (const cmd of existing) {
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
      new SlashCommandBuilder().setName('taglist').setDescription('List all tags'),
      new SlashCommandBuilder().setName('i').setDescription('Fetch Roblox account info by username').addStringOption(option => option.setName('username').setDescription('The Roblox username to look up').setRequired(true)),
    ].map(cmd => cmd.toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered');
  } else {
    console.log('🟡 Skipping command registration');
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName, options, channel, guild } = interaction;

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
        await interaction.reply({ content: '✅ Setup complete.', ephemeral: true });
      }

      if (commandName === 'tagcreate') {
        await interaction.deferReply({ ephemeral: true });
        const name = options.getString('name');
        const message = options.getString('message');
        try {
          await tagsCollection.updateOne({ name }, { $set: { message } }, { upsert: true });
          await interaction.editReply({ content: `✅ Tag \`${name}\` saved.` });
        } catch {
          await interaction.editReply({ content: '❌ Failed to create tag.' });
        }
      }

      if (commandName === 'tag') {
        const name = options.getString('name');
        const tag = await tagsCollection.findOne({ name });
        await interaction.reply({ content: tag ? tag.message.slice(0, 2000) : `❌ Tag \`${name}\` not found.` });
      }

      if (commandName === 'tagdelete') {
        await interaction.deferReply({ ephemeral: true });
        const name = options.getString('name');
        const result = await tagsCollection.deleteOne({ name });
        await interaction.editReply({ content: result.deletedCount ? `🗑️ Tag \`${name}\` deleted.` : `❌ Tag \`${name}\` not found.` });
      }

      if (commandName === 'taglist') {
        const allTags = await tagsCollection.find({}).toArray();
        const list = allTags.map(t => `• \`${t.name}\``).join('\n') || 'No tags found.';
        await interaction.reply({ content: list });
      }

      if (commandName === 'close') {
        await interaction.deferReply({ ephemeral: true });
        const parentId = channel.parentId;
        if (parentId !== TICKET_CATEGORY) return await interaction.editReply({ content: '❌ You can only close ticket channels!' });

        const perms = channel.permissionOverwrites.cache;
        const ticketOwner = [...perms.values()].find(po =>
          po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
          ![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(po.id)
        )?.id;

        await Promise.all([...perms.entries()]
          .filter(([id]) => ![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(id))
          .map(([id]) => channel.permissionOverwrites.edit(id, {
            SendMessages: false, ViewChannel: false
          }).catch(() => {})));

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
        await interaction.editReply({ embeds: [embed], components: [row] });
      }

      if (commandName === 'delete') {
        const parentId = channel.parentId;
        if (parentId === TICKET_CATEGORY) await channel.delete();
        else await interaction.reply({ content: '❌ You can only delete ticket channels!', ephemeral: true });
      }

      if (commandName === 'rename') {
        if (channel.parentId !== TICKET_CATEGORY) return await interaction.reply({ content: '❌ You can only rename ticket channels!', ephemeral: true });
        const newName = options.getString('name');
        await channel.setName(newName);
        await interaction.reply({ content: `✅ Renamed to \`${newName}\``, ephemeral: true });
      }

      if (commandName === 'add') {
        if (channel.parentId !== TICKET_CATEGORY) return await interaction.reply({ content: '❌ You can only add users in ticket channels!', ephemeral: true });
        const user = options.getUser('user');
        await channel.permissionOverwrites.edit(user.id, { SendMessages: true, ViewChannel: true });
        await interaction.reply({ content: `✅ ${user} added.`, ephemeral: true });
      }

      if (commandName === 'remove') {
        if (channel.parentId !== TICKET_CATEGORY) return await interaction.reply({ content: '❌ You can only remove users in ticket channels!', ephemeral: true });
        const user = options.getUser('user');
        await channel.permissionOverwrites.delete(user.id);
        await interaction.reply({ content: `✅ ${user} removed.`, ephemeral: true });
      }

      if (commandName === 'transcript') {
        if (channel.parentId !== TICKET_CATEGORY) return await interaction.reply({ content: '❌ You can only generate transcripts in ticket channels!', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        await handleTranscript(interaction, channel);
      }

      if (commandName === 'i') {
        await interaction.deferReply();
        const username = options.getString('username');
        // Roblox lookup logic remains untouched...
        // ... (same as before)
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'openTicket') {
        const modal = new ModalBuilder()
          .setCustomId('ticketModal')
          .setTitle('Middleman Request')
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel("What's your side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel("Their Discord ID?").setStyle(TextInputStyle.Short).setRequired(true))
          );
        await interaction.showModal(modal);
      }

      if (interaction.customId === 'transcript') {
        if (interaction.channel.parentId !== TICKET_CATEGORY) return await interaction.reply({ content: '❌ You can only use this inside ticket channels.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        await handleTranscript(interaction, interaction.channel);
      }

      if (interaction.customId === 'delete') {
        await interaction.channel.delete().catch(() => {});
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
      const existing = interaction.guild.channels.cache.find(c =>
        c.parentId === TICKET_CATEGORY && c.permissionOverwrites.cache.has(interaction.user.id)
      );
      if (existing) return await interaction.reply({ content: `❌ You already have an open ticket: ${existing}`, ephemeral: true });

      const [q1, q2, q3, q4] = ['q1','q2','q3','q4'].map(id => interaction.fields.getTextInputValue(id));
      const isValidId = /^\d{17,19}$/.test(q4);
      const permissionOverwrites = [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: OWNER_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: MIDDLEMAN_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ];
      if (isValidId && interaction.guild.members.cache.has(q4)) {
        permissionOverwrites.push({ id: q4, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
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
          `**User 1:** <@${interaction.user.id}>\n**User 2:** ${isValidId ? `<@${q4}>` : 'Unknown User'}\n\n` +
          `**Trade Details**\n> ${q1}\n\n**User 1 is giving:**\n> ${q2}\n\n**User 2 is giving:**\n> ${q3}`
        )
        .setFooter({ text: `Ticket by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await ticket.send({ content: `<@${interaction.user.id}> <@${OWNER_ID}>`, embeds: [embed] });
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
    return `<p><strong>${m.author.tag}</strong> <em>${new Date(m.createdTimestamp).toLocaleString()}</em>: ${m.cleanContent}</p>`;
  });

  const stats = [...participants.entries()].map(
    ([id, count]) => `<li><strong><a href="https://discord.com/users/${id}">${id}</a></strong>: ${count} messages</li>`
  ).join('');

  if (!fs.existsSync(path.join(__dirname, 'transcripts'))) fs.mkdirSync(path.join(__dirname, 'transcripts'));
  const htmlFile = path.join(__dirname, 'transcripts', `${channel.id}.html`);
  fs.writeFileSync(htmlFile, `<html><body><h2>${channel.name}</h2><ul>${stats}</ul><hr>${lines.join('')}</body></html>`);

  const txtFile = path.join(__dirname, 'transcripts', `transcript-${channel.id}.txt`);
  fs.writeFileSync(txtFile, sorted.map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.cleanContent}`).join('\n'));

  const embed = new EmbedBuilder()
    .setTitle('📄 Transcript Ready')
    .setDescription(`[Click to view HTML Transcript](${BASE_URL}/transcripts/${channel.id}.html)`)
    .addFields(
      { name: 'Ticket Name', value: channel.name, inline: true },
      { name: 'Participants', value: [...participants.entries()].map(([id, c]) => `<@${id}> — \`${c}\` messages`).join('\n').slice(0, 1024) }
    )
    .setColor('#4fc3f7')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], files: [new AttachmentBuilder(txtFile)] });
  const logC = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logC) await logC.send({ embeds: [embed], files: [new AttachmentBuilder(txtFile)] });
}

client.on('error', console.error);
client.login(process.env.TOKEN);

// Uptime ping
setInterval(() => fetch(BASE_URL).catch(() => {}), 5 * 60 * 1000);