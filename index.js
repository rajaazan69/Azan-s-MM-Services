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
const tags = {};

app.get('/', (req, res) => res.send('Bot is online.'));
app.get('/transcripts/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'transcripts', req.params.filename);
  if (fs.existsSync(filePath)) res.sendFile(filePath);
  else res.status(404).send('Transcript not found.');
});
app.listen(PORT, () => console.log(`Uptime server running on port ${PORT}`));

client.once('ready', async () => {
  console.log(`Bot online as ${client.user.tag}`);
  const commands = [
    new SlashCommandBuilder().setName('setup').setDescription('Send ticket panel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true)),
    new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
    new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket'),
    new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket').addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true)),
    new SlashCommandBuilder().setName('add').setDescription('Add a user to the ticket').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('remove').setDescription('Remove a user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('transcript').setDescription('Generate a transcript'),
    new SlashCommandBuilder().setName('tagcreate').setDescription('Create a tag')
      .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Tag message').setRequired(true)),
    new SlashCommandBuilder().setName('tag').setDescription('Send a saved tag')
      .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
    new SlashCommandBuilder().setName('tagdelete').setDescription('Delete a tag')
      .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
    new SlashCommandBuilder().setName('taglist').setDescription('List all tags')
  ].map(cmd => cmd.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log('✅ Slash commands registered');
});

client.on('interactionCreate', async interaction => {
  try {
    const { commandName, options, channel, guild } = interaction;
    if (interaction.isChatInputCommand()) {
      if (commandName === 'setup') {
        const target = options.getChannel('channel');
        const embed = new EmbedBuilder().setTitle('**Request Middleman**')
          .setDescription('**Click Below To Request Azan’s Services**\nPlease answer all the questions correctly for the best support.')
          .setColor('Blue');
        const btn = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('openTicket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
        );
        await target.send({ embeds: [embed], components: [btn] });
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '✅ Setup complete.', ephemeral: true }).catch(() => {});
        }
      }
      if (commandName === 'tagcreate') {
        tags[options.getString('name')] = options.getString('message');
        await interaction.reply({ content: '✅ Tag created.', ephemeral: true });
      }
      if (commandName === 'tag') {
        await interaction.reply({ content: tags[options.getString('name')] || '❌ Tag not found.', ephemeral: true });
      }
      if (commandName === 'tagdelete') {
        const name = options.getString('name');
        delete tags[name];
        await interaction.reply({ content: `🗑️ Tag \`${name}\` deleted.`, ephemeral: true });
      }
      if (commandName === 'taglist') {
        const list = Object.keys(tags).map(t => `• \`${t}\``).join('\n') || 'No tags found.';
        await interaction.reply({ content: list, ephemeral: true });
      }
      if (commandName === 'close') {
        const perms = channel.permissionOverwrites.cache;
        const ticketOwner = [...perms.values()].find(po =>
          po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
          po.id !== OWNER_ID && po.id !== MIDDLEMAN_ROLE && po.id !== guild.id
        )?.id;
        for (const [id] of perms) {
          if (id !== OWNER_ID && id !== MIDDLEMAN_ROLE && id !== guild.id) {
            await channel.permissionOverwrites.edit(id, { SendMessages: false, ViewChannel: false }).catch(() => {});
          }
        }
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
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [embed], components: [row] });
        }
      }
      if (commandName === 'delete') return channel.delete();
      if (commandName === 'rename') {
        const newName = options.getString('name');
        await channel.setName(newName);
        await interaction.reply({ content: `✅ Renamed to \`${newName}\``, ephemeral: true });
      }
      if (commandName === 'add') {
        const user = options.getUser('user');
        await channel.permissionOverwrites.edit(user.id, {
          SendMessages: true,
          ViewChannel: true
        });
        await interaction.reply({ content: `✅ ${user} added.`, ephemeral: true });
      }
      if (commandName === 'remove') {
        const user = options.getUser('user');
        await channel.permissionOverwrites.delete(user.id);
        await interaction.reply({ content: `✅ ${user} removed.`, ephemeral: true });
      }
      if (commandName === 'transcript') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        await handleTranscript(interaction, channel);
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'transcript') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        await handleTranscript(interaction, interaction.channel);
      }
      if (interaction.customId === 'delete') {
        await interaction.channel.delete();
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
    .addFields({ name: 'Ticket Name', value: channel.name, inline: true })
    .setColor('#4fc3f7')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], files: [new AttachmentBuilder(txtPath)] }).catch(() => {});
  const logChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logChannel) await logChannel.send({ embeds: [embed], files: [new AttachmentBuilder(txtPath)] });
}

client.on('error', console.error);
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection:', reason);
});
client.login(process.env.TOKEN);

// Keep alive
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
setInterval(() => { fetch(BASE_URL).catch(() => {}); }, 5 * 60 * 1000);