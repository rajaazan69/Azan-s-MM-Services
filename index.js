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
      new SlashCommandBuilder().setName('transcript').setDescription('Generate a transcript')
    ].map(cmd => cmd.toJSON());

    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ Slash commands registered');
  }
});
client.on('interactionCreate', async interaction => {
  try {
    const { commandName, options, channel, guild } = interaction;

    if (interaction.isChatInputCommand()) {
      if (commandName === 'setup') {
        const target = options.getChannel('channel');
        const embed = new EmbedBuilder()
          .setTitle('Request Middleman')
          .setDescription('Click the button below to open a ticket and request Azan’s middleman services.\n\nPlease answer all questions truthfully.')
          .setColor('#5865F2');
        const btn = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('openTicket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
        );
        await target.send({ embeds: [embed], components: [btn] });
        await interaction.reply({ content: '✅ Setup complete.', ephemeral: true }).catch(() => {});
      }

      if (commandName === 'close') {
        const parentId = channel.parentId || channel.parent?.id;
        if (parentId !== TICKET_CATEGORY) return interaction.reply({ content: '❌ You can only close ticket channels!', ephemeral: true });
        const perms = channel.permissionOverwrites.cache;
        const ticketOwner = [...perms.values()].find(po => po.allow.has(PermissionsBitField.Flags.ViewChannel) && po.id !== OWNER_ID && po.id !== MIDDLEMAN_ROLE && po.id !== guild.id)?.id;
        for (const [id] of perms) {
          if (![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(id)) {
            await channel.permissionOverwrites.edit(id, { SendMessages: false, ViewChannel: false }).catch(() => {});
          }
        }
        const embed = new EmbedBuilder()
          .setTitle('Ticket Closed')
          .setColor('#2B2D31')
          .setFields(
            { name: 'Ticket Name', value: channel.name, inline: true },
            { name: 'Owner', value: ticketOwner ? `<@${ticketOwner}>` : 'Unknown', inline: true }
          )
          .setFooter({ text: `Closed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('transcript').setLabel('Transcript').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('delete').setLabel('Delete').setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
      }

      if (commandName === 'delete') {
        if ((channel.parentId || channel.parent?.id) === TICKET_CATEGORY) await channel.delete();
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

    if (interaction.isButton()) {
      if (interaction.customId === 'openTicket') {
        const modal = new ModalBuilder()
          .setCustomId('ticketModal')
          .setTitle('Middleman Request')
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel("Your side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel("Their side?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel("Their Discord ID?").setStyle(TextInputStyle.Short).setRequired(true))
          );
        await interaction.showModal(modal).catch(console.error);
      }

      if (interaction.customId === 'transcript') {
        if ((interaction.channel.parentId || interaction.channel.parent?.id) !== TICKET_CATEGORY)
          return interaction.reply({ content: '❌ Only in ticket channels.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        await handleTranscript(interaction, interaction.channel);
      }

      if (interaction.customId === 'delete') {
        await interaction.channel.delete().catch(console.error);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
      const q1 = interaction.fields.getTextInputValue('q1');
      const q2 = interaction.fields.getTextInputValue('q2');
      const q3 = interaction.fields.getTextInputValue('q3');
      const q4 = interaction.fields.getTextInputValue('q4');
      const targetMention = /^\d{17,19}$/.test(q4) ? `<@${q4}>` : 'Unknown';

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
        .setTitle('Middleman Request')
        .setColor('#5865F2')
        .setDescription(
          `**User 1:** <@${interaction.user.id}>\n` +
          `**User 2:** ${targetMention}\n\n` +
          `**What's the trade?**\n${q1}\n\n` +
          `**User 1 is giving:**\n${q2}\n\n` +
          `**User 2 is giving:**\n${q3}`
        )
        .setFooter({ text: `Ticket by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await ticket.send({ content: `<@&${MIDDLEMAN_ROLE}>`, embeds: [embed] });
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
  const stats = [...participants.entries()].map(([id, count]) => `<li><a href="https://discord.com/users/${id}">${id}</a>: ${count} messages</li>`).join('');
  const html = `<html><body><h2>${channel.name}</h2><ul>${stats}</ul><hr>${lines.join('')}</body></html>`;
  const filename = `${channel.id}.html`;
  const filepath = path.join(__dirname, 'transcripts');
  if (!fs.existsSync(filepath)) fs.mkdirSync(filepath);
  fs.writeFileSync(path.join(filepath, filename), html);
  const htmlLink = `${BASE_URL}/transcripts/${filename}`;

  const embed = new EmbedBuilder()
    .setTitle('Transcript Ready')
    .setDescription(`[Click here to view HTML transcript](${htmlLink})`)
    .setColor('#4fc3f7')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] }).catch(() => {});
  const logChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logChannel) await logChannel.send({ embeds: [embed] });
}

client.login(process.env.TOKEN);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
setInterval(() => { fetch(BASE_URL).catch(() => {}); }, 5 * 60 * 1000);