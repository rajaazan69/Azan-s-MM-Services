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

// Register slash commands on each deploy
(async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Send ticket panel in a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Text channel to send panel').setRequired(true)),
    new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
    new SlashCommandBuilder().setName('delete').setDescription('Delete the channel'),
    new SlashCommandBuilder().setName('rename').setDescription('Rename the channel').addStringOption(o => o.setName('name').setRequired(true)),
    new SlashCommandBuilder().setName('add').setDescription('Add a user to ticket').addUserOption(o => o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('remove').setDescription('Remove a user from ticket').addUserOption(o => o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('transcript').setDescription('Generate transcript'),
    new SlashCommandBuilder()
      .setName('tagcreate')
      .setDescription('Create a custom tag')
      .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Tag message').setRequired(true)),
    new SlashCommandBuilder()
      .setName('tag')
      .setDescription('Use a saved tag')
      .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
    new SlashCommandBuilder()
      .setName('tagdelete')
      .setDescription('Delete a saved tag')
      .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
    new SlashCommandBuilder()
      .setName('taglist')
      .setDescription('List all saved tags')
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands('1392944799983730849'), { body: commands });
    console.log('✅ Commands registered');
  } catch (e) {
    console.error('❌ Register error:', e);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, channel, guild } = interaction;

  if (commandName === 'setup') {
    const tgt = options.getChannel('channel');
    if (!tgt || tgt.type !== ChannelType.GuildText)
      return interaction.reply({ content: 'Please pick a valid text channel.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setTitle('**Request Middleman**')
      .setDescription('Click below to request Azan’s services.')
      .setColor('Blue');
    const btn = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('openTicket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
    );
    await tgt.send({ embeds: [embed], components: [btn] });
    return interaction.reply({ content: `Panel sent to ${tgt}`, ephemeral: true });
  }

  if (commandName === 'close') {
    const perms = channel.permissionOverwrites.cache;
    const ticketOwner = [...perms.values()].find(po =>
      po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
      po.id !== OWNER_ID && po.id !== MIDDLEMAN_ROLE && po.id !== guild.id
    )?.id;

    for (const [id] of perms)
      if (![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(id))
        channel.permissionOverwrites
          .edit(id, { SendMessages: false, ViewChannel: false })
          .catch(() => {});

    const embeds = new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setDescription('Choose below to get transcript or delete.')
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
    return interaction.reply({ embeds: [embeds], components: [row] });
  }

  if (commandName === 'delete') return channel.delete();
  if (commandName === 'rename') {
    const n = options.getString('name');
    await channel.setName(n);
    return interaction.reply({ content: `Renamed to ${n}`, ephemeral: true });
  }

  if (commandName === 'add') {
    const u = options.getUser('user');
    await channel.permissionOverwrites.edit(u.id, {
      SendMessages: true,
      ViewChannel: true
    });
    return interaction.reply({ content: `${u} added.`, ephemeral: true });
  }

  if (commandName === 'remove') {
    const u = options.getUser('user');
    await channel.permissionOverwrites.delete(u.id);
    return interaction.reply({ content: `${u} removed.`, ephemeral: true });
  }

  if (commandName === 'transcript') return handleTranscript(interaction, channel);

  // Tag system
  if (commandName === 'tagcreate') {
    const name = options.getString('name').toLowerCase();
    const msg = options.getString('message');
    const tags = loadTags();
    tags[name] = msg;
    saveTags(tags);
    return interaction.reply({ content: `✅ Tag \`${name}\` saved.`, ephemeral: true });
  }
  if (commandName === 'tag') {
    const name = options.getString('name').toLowerCase();
    const tags = loadTags();
    const msg = tags[name];
    if (!msg) return interaction.reply({ content: `❌ Tag \`${name}\` not found.`, ephemeral: true });
    return interaction.reply({ content: msg });
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
    const keys = Object.keys(tags);
    const list = keys.length ? keys.map(t => `• \`${t}\``).join('\n') : 'No tags saved.';
    const embed = new EmbedBuilder().setTitle('🏷️ Saved Tags').setDescription(list).setColor('#00cc99');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

if (true) client.on('interactionCreate', null); // ensure single listener


// tag storage
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

// rest of your transcript functions and boot code remain unchanged...