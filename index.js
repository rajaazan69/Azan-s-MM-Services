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

  // Register slash commands once
  const commands = [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Send ticket panel in a selected channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true)),
    new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
    new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket'),
    new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket').addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true)),
    new SlashCommandBuilder().setName('add').setDescription('Add a user to the ticket').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
    new SlashCommandBuilder().setName('remove').setDescription('Remove a user from the ticket').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
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
// ... all your imports and setup (unchanged) ...

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
        if (!interaction.replied && !interaction.deferred) {
  await interaction.reply({ content: '✅ Setup complete.', ephemeral: true }).catch(() => {});
}
      }

      if (commandName === 'tagcreate') {
        const name = options.getString('name');
        const msg = options.getString('message');
        tags[name] = msg;
        return interaction.reply({ content: `✅ Tag \`${name}\` created.`, ephemeral: true });
      }

      if (commandName === 'tag') {
        const name = options.getString('name');
        return interaction.reply({ content: tags[name] || '❌ Tag not found.', ephemeral: true });
      }

      if (commandName === 'tagdelete') {
        const name = options.getString('name');
        if (tags[name]) {
          delete tags[name];
          return interaction.reply({ content: `🗑️ Tag \`${name}\` deleted.`, ephemeral: true });
        } else return interaction.reply({ content: '❌ Tag not found.', ephemeral: true });
      }

      if (commandName === 'taglist') {
        const list = Object.keys(tags).map(t => `• \`${t}\``).join('\n') || 'No tags found.';
        return interaction.reply({ content: `📂 Tags:\n${list}`, ephemeral: true });
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
        return interaction.reply({ embeds: [embed], components: [row] });
      }

      if (commandName === 'delete') return channel.delete();
      if (commandName === 'rename') {
        const newName = options.getString('name');
        await channel.setName(newName);
        return interaction.reply({ content: `✅ Renamed to \`${newName}\`.`, ephemeral: true });
      }
      if (commandName === 'add') {
        const user = options.getUser('user');
        await channel.permissionOverwrites.edit(user.id, {
          SendMessages: true,
          ViewChannel: true
        });
        return interaction.reply({ content: `✅ ${user} added to the ticket.`, ephemeral: true });
      }
      if (commandName === 'remove') {
        const user = options.getUser('user');
        await channel.permissionOverwrites.delete(user.id);
        return interaction.reply({ content: `✅ ${user} removed from the ticket.`, ephemeral: true });
      }
      if (commandName === 'transcript') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        await handleTranscript(interaction, channel);
      }
    }

    if (interaction.isButton()) {
      const { customId, channel } = interaction;

      if (customId === 'transcript') {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.deferReply({ ephemeral: true }).catch(() => {});
        }
        await handleTranscript(interaction, channel);
      }

      if (customId === 'delete') {
        await channel.delete();
      }

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
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
      // unchanged...
      // create ticket logic
    }
  } catch (err) {
    console.error('❌ Interaction error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An unexpected error occurred.', ephemeral: true }).catch(() => {});
    }
  }
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
client.login(process.env.TOKEN);

// Keep alive ping
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
setInterval(() => { fetch(BASE_URL).catch(() => {}); }, 5 * 60 * 1000);