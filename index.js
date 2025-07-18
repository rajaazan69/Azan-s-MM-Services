const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, PermissionFlagsBits,
  ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder,
  SlashCommandBuilder, REST, Routes
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { MongoClient } = require('mongodb');
const stickyMap = new Map(); // Stores sticky message per channel

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
    const old = await rest.get(Routes.applicationCommands(client.user.id));
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
      new SlashCommandBuilder().setName('taglist').setDescription('List all tags'),
    new SlashCommandBuilder()
  .setName('i')
  .setDescription('Get Roblox user info')
  .addStringOption(opt =>
    opt.setName('username')
      .setDescription('The Roblox username to look up')
      .setRequired(true)
  ),
  new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member from the server')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to kick')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the kick')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member from the server')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to ban')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the ban')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user by their ID')
  .addStringOption(option =>
    option.setName('userid')
      .setDescription('The ID of the user to unban')
      .setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Timeout a member for a set number of minutes')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to timeout')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('duration')
      .setDescription('Duration in minutes')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for timeout')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a user')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to warn')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('reason')
      .setDescription('Reason for the warning')
      .setRequired(false))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock the current channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Unlock the current channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    ].map(cmd => cmd.toJSON());
  

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

    const panelEmbed = new EmbedBuilder()
      .setColor('#000000')
      .setTitle('Azan’s Middleman Service')
      .setDescription(
        `To request a middleman from this server\n` +
        `click the \`Request Middleman\` button below.\n\n` +

        `**How does a Middleman Work?**\n` +
        `Example: Trade is Harvester (MM2) for Robux.\n` +
        `1. Seller gives Harvester to middleman.\n` +
        `2. Buyer pays seller robux (after middleman confirms receiving mm2).\n` +
        `3. Middleman gives buyer Harvester (after seller received robux).\n\n` +

        `**Important**\n` +
        `• Troll tickets are not allowed. Once the trade is completed you must vouch your middleman in their respective servers.\n` +
        `• If you have trouble getting a user's ID click [here](https://youtube.com/shorts/pMG8CuIADDs?feature=shared).\n` +
        `• Make sure to read <#1373027499738398760> before making a ticket.`
      );

    const btn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('openTicket')
        .setLabel('Request Middleman')
        .setStyle(ButtonStyle.Primary)
    );

    await target.send({ embeds: [panelEmbed], components: [btn] });
    await interaction.reply({ content: '✅ Setup complete.', ephemeral: true }).catch(() => {});
  }
  if (commandName === 'sticky') {
  const channel = options.getChannel('channel');
  const message = options.getString('message');

  if (!channel || channel.type !== ChannelType.GuildText) {
    return interaction.reply({ content: '❌ Please select a valid text channel.', ephemeral: true });
  }

  // Send the sticky message
  const sentMessage = await channel.send({ content: message });

  // Store sticky info
  stickyMap.set(channel.id, {
    message: message,
    messageId: sentMessage.id
  });

  return interaction.reply({ content: `✅ Sticky message set in <#${channel.id}>!`, ephemeral: true });
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
    if (commandName === 'i') {
  const username = options.getString('username');
  await interaction.deferReply();

  try {
    const userRes = await fetch(`https://users.roblox.com/v1/usernames/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
    });

    const userData = await userRes.json();
    const user = userData.data?.[0];

    if (!user) {
      return interaction.editReply({ content: '❌ User not found.' });
    }

    const [profileRes, followersRes, followingRes, avatarRes] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${user.id}`),
      fetch(`https://friends.roblox.com/v1/users/${user.id}/followers/count`),
      fetch(`https://friends.roblox.com/v1/users/${user.id}/followings/count`),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.id}&size=720x720&format=Png&isCircular=false`)
    ]);

    const profile = await profileRes.json();
    const followers = await followersRes.json();
    const following = await followingRes.json();
    const avatarData = await avatarRes.json();
    const avatarUrl = avatarData.data?.[0]?.imageUrl || null;

    const createdDate = new Date(profile.created);
    const now = new Date();
    const yearsOld = ((now - createdDate) / (1000 * 60 * 60 * 24 * 365)).toFixed(1);

    const embed = new EmbedBuilder()
      .setTitle(`Roblox User Information`)
      .setColor('#000000')
      .setThumbnail(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=true`)
      .addFields(
        { name: 'Display Name', value: `${profile.displayName}`, inline: false },
        { name: 'Username', value: `${profile.name}`, inline: false },
        { name: 'User ID', value: `${user.id}`, inline: false },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: 'Account Created', value: `<t:${Math.floor(createdDate.getTime() / 1000)}:F>`, inline: false },
        { name: 'Account Age', value: `${yearsOld} years`, inline: false },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: 'Followers', value: `${followers?.count?.toLocaleString() || 'N/A'}`, inline: false },
        { name: 'Following', value: `${following?.count?.toLocaleString() || 'N/A'}`, inline: false }
      )
      .setFooter({ text: 'Roblox Profile Info', iconURL: 'https://tr.rbxcdn.com/4f82333f5f54d234e95d1f81251a67dc/150/150/Image/Png' })
      .setTimestamp();

    if (avatarUrl) embed.setImage(avatarUrl);

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View Profile')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://www.roblox.com/users/${user.id}/profile`)
    );

    await interaction.editReply({ embeds: [embed], components: [button] });

  } catch (err) {
    console.error('❌ Roblox user info error:', err);
    await interaction.editReply({ content: '❌ Failed to fetch user info.' });
  }
}
if (commandName === 'ban') {
  const member = options.getMember('user');
  const reason = options.getString('reason') || 'No reason provided';

  if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });

  if (!member || !member.bannable)
    return interaction.reply({ content: '❌ Cannot ban this user.', ephemeral: true });

  await member.ban({ reason });
  await interaction.reply({ content: `✅ Banned ${member.user.tag} | Reason: ${reason}` });
}
if (commandName === 'kick') {
  const member = options.getMember('user');
  const reason = options.getString('reason') || 'No reason provided';

  if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers))
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });

  if (!member || !member.kickable)
    return interaction.reply({ content: '❌ Cannot kick this user.', ephemeral: true });

  await member.kick(reason);
  await interaction.reply({ content: `✅ Kicked ${member.user.tag} | Reason: ${reason}` });
}
if (commandName === 'lock') {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
    return interaction.reply({ content: '❌ You do not have permission to lock channels.', ephemeral: true });

  await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
    SendMessages: false
  });

  await interaction.reply({ content: '🔒 Channel locked.' });
}
if (commandName === 'mute') {
  const member = options.getMember('user');
  const duration = options.getInteger('duration');
  const reason = options.getString('reason') || 'No reason provided';

  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });

  try {
    await member.timeout(duration * 60 * 1000, reason);
    await interaction.reply({ content: `✅ Timed out ${member.user.tag} for ${duration} minutes.` });
  } catch {
    await interaction.reply({ content: '❌ Failed to timeout the user.', ephemeral: true });
  }
}
if (commandName === 'unban') {
  const userId = options.getString('userid');

  if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });

  try {
    await interaction.guild.members.unban(userId);
    await interaction.reply({ content: `✅ Unbanned user with ID: ${userId}` });
  } catch (err) {
    await interaction.reply({ content: '❌ Failed to unban user. Make sure the ID is valid.', ephemeral: true });
  }
}
if (commandName === 'unlock') {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
    return interaction.reply({ content: '❌ You do not have permission to unlock channels.', ephemeral: true });

  await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
    SendMessages: true
  });

  await interaction.reply({ content: '🔓 Channel unlocked.' });
}
if (commandName === 'warn') {
  const member = options.getMember('user');
  const reason = options.getString('reason') || 'No reason provided';

  if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers))
    return interaction.reply({ content: '❌ You do not have permission to warn.', ephemeral: true });

  await interaction.reply({ content: `⚠️ Warned ${member.user.tag} | Reason: ${reason}` });
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

// ... all your imports and initializations

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'middleman') {
      const modal = new ModalBuilder()
        .setCustomId('middlemanRequest')
        .setTitle('Request Middleman');

      const q1 = new TextInputBuilder()
        .setCustomId('q1')
        .setLabel('Trade Details')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const q2 = new TextInputBuilder()
        .setCustomId('q2')
        .setLabel('You are giving?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const q3 = new TextInputBuilder()
        .setCustomId('q3')
        .setLabel('They are giving?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(q1);
      const row2 = new ActionRowBuilder().addComponents(q2);
      const row3 = new ActionRowBuilder().addComponents(q3);

      modal.addComponents(row1, row2, row3);
      await interaction.showModal(modal);
    }
  } catch (err) {
    console.error('❌ Interaction command error:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== 'middlemanRequest') return;

    const q1 = interaction.fields.getTextInputValue('q1');
    const q2 = interaction.fields.getTextInputValue('q2');
    const q3 = interaction.fields.getTextInputValue('q3');

    const modalContent = await interaction.message?.components?.[0]?.components?.[0]?.value;
    const targetMention = interaction.fields.getTextInputValue('user2') || '`Unknown User`';

    const ticket = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY,
      permissionOverwrites,
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
      embeds: [embed],
    });

    await interaction.reply({ content: `✅ Ticket created: ${ticket}`, ephemeral: true });
  } catch (err) {
    console.error('❌ Modal interaction error:', err);
  }
});

// ✅ Sticky message handler
client.on('messageCreate', async (message) => {
  if (message.author.bot || message.channel.type !== ChannelType.GuildText) return;

  const sticky = stickyMap.get(message.channel.id);
  if (!sticky) return;

  try {
    const oldMsg = await message.channel.messages.fetch(sticky.messageId).catch(() => {});
    if (oldMsg) await oldMsg.delete().catch(() => {});

    const newMsg = await message.channel.send({ content: sticky.message });

    stickyMap.set(message.channel.id, {
      message: sticky.message,
      messageId: newMsg.id,
    });
  } catch (err) {
    console.error('Sticky message error:', err);
  }
});

// ✅ Transcript function (unchanged unless you need edits)
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
        inline: false,
      }
    )
    .setColor('#4fc3f7')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], files: [new AttachmentBuilder(txtPath)] }).catch(() => {});
  const logChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logChannel) await logChannel.send({ embeds: [embed], files: [new AttachmentBuilder(txtPath)] });
}

// ✅ Logging & keep-alive
client.on('error', console.error);

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection:', reason);
});

client.login(process.env.TOKEN);

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
setInterval(() => {
  fetch(BASE_URL).catch(() => {});
}, 5 * 60 * 1000); // ✅ keep this