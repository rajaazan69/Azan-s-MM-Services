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

// Slash Command Registration
(async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Send ticket panel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send panel').setRequired(true)),
    new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
    new SlashCommandBuilder().setName('delete').setDescription('Delete the channel'),
    new SlashCommandBuilder().setName('rename').setDescription('Rename the channel').addStringOption(opt => opt.setName('name').setRequired(true)),
    new SlashCommandBuilder().setName('add').setDescription('Add user').addUserOption(opt => opt.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('remove').setDescription('Remove user').addUserOption(opt => opt.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('transcript').setDescription('Generate transcript'),
    new SlashCommandBuilder().setName('tagcreate').setDescription('Create a tag')
      .addStringOption(opt => opt.setName('name').setRequired(true))
      .addStringOption(opt => opt.setName('message').setRequired(true)),
    new SlashCommandBuilder().setName('tag').setDescription('Use a tag')
      .addStringOption(opt => opt.setName('name').setRequired(true)),
    new SlashCommandBuilder().setName('tagdelete').setDescription('Delete a tag')
      .addStringOption(opt => opt.setName('name').setRequired(true)),
    new SlashCommandBuilder().setName('taglist').setDescription('List all saved tags')
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands('1392944799983730849'), { body: commands });
    console.log('✅ Commands registered');
  } catch (e) {
    console.error('❌ Command registration failed:', e);
  }
})();

client.once('ready', () => console.log(`Bot online as ${client.user.tag}`));

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, channel, guild } = interaction;

  if (commandName === 'setup') {
    const tgt = options.getChannel('channel');
    if (!tgt || tgt.type !== ChannelType.GuildText)
      return interaction.reply({ content: 'Choose a valid text channel.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('**Request Middleman**')
      .setDescription('Click below to request Azan’s services.\nAnswer all questions accurately.')
      .setColor('Blue');

    const btn = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('openTicket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
    );

    await tgt.send({ embeds: [embed], components: [btn] });
    return interaction.reply({ content: `✅ Panel sent to ${tgt}`, ephemeral: true });
  }

  if (commandName === 'close') {
    const perms = channel.permissionOverwrites.cache;
    const ticketOwner = [...perms.values()].find(po =>
      po.allow.has(PermissionsBitField.Flags.ViewChannel) &&
      po.id !== OWNER_ID && po.id !== MIDDLEMAN_ROLE && po.id !== guild.id
    )?.id;

    for (const [id] of perms)
      if (![OWNER_ID, MIDDLEMAN_ROLE, guild.id].includes(id))
        await channel.permissionOverwrites.edit(id, {
          SendMessages: false, ViewChannel: false
        }).catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setDescription('Choose below to generate transcript or delete.')
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
    return interaction.reply({ content: `Renamed to ${newName}`, ephemeral: true });
  }

  if (commandName === 'add') {
    const user = options.getUser('user');
    await channel.permissionOverwrites.edit(user.id, {
      SendMessages: true, ViewChannel: true
    });
    return interaction.reply({ content: `${user} added.`, ephemeral: true });
  }

  if (commandName === 'remove') {
    const user = options.getUser('user');
    await channel.permissionOverwrites.delete(user.id);
    return interaction.reply({ content: `${user} removed.`, ephemeral: true });
  }

  if (commandName === 'transcript') return handleTranscript(interaction, channel);

  // Tag commands
  if (commandName === 'tagcreate') {
    const name = options.getString('name').toLowerCase();
    const message = options.getString('message');
    const tags = loadTags();
    tags[name] = message;
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
    const list = Object.keys(tags).map(t => `• \`${t}\``).join('\n') || 'No tags saved.';
    const embed = new EmbedBuilder().setTitle('🏷️ Saved Tags').setDescription(list).setColor('#00cc99');
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.on('interactionCreate', async interaction => {
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
      return interaction.showModal(modal);
    }
    if (customId === 'transcript') return handleTranscript(interaction, channel);
    if (customId === 'delete') return channel.delete();
  }

  if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
    const q1 = interaction.fields.getTextInputValue('q1');
    const q2 = interaction.fields.getTextInputValue('q2');
    const q3 = interaction.fields.getTextInputValue('q3');
    const q4 = interaction.fields.getTextInputValue('q4');

    const channel = await interaction.guild.channels.create({
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

    const mention = /^\d{17,19}$/.test(q4) ? `<@${q4}>` : 'Unknown User';

    const embed = new EmbedBuilder()
      .setTitle('🎟️ Middleman Request')
      .setDescription(`**User 1:** <@${interaction.user.id}>\n**User 2:** ${mention}\n\n**What's the trade?**\n${q1}\n\n**User 1 is giving:**\n${q2}\n\n**User 2 is giving:**\n${q3}`)
      .setColor('#00b0f4')
      .setFooter({ text: `Ticket by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await channel.send({ content: `<@${interaction.user.id}> <@${OWNER_ID}> <@&${MIDDLEMAN_ROLE}>`, embeds: [embed] });
    return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  }
});

// Tag functions
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

// Transcript function
async function handleTranscript(interaction, channel) {
  await interaction.deferReply({ ephemeral: true });

  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const participants = new Map();

  const htmlLines = sorted.map(m => {
    participants.set(m.author.id, (participants.get(m.author.id) || 0) + 1);
    return `<p><strong>${m.author.tag}</strong> <em>${new Date(m.createdTimestamp).toLocaleString()}</em>: ${m.cleanContent}</p>`;
  });

  const stats = [...participants.entries()].map(([id, count]) =>
    `<li><strong><a href="https://discord.com/users/${id}">${id}</a></strong>: ${count} messages</li>`).join('');

  const html = `
    <html><head><title>Transcript for ${channel.name}</title></head><body>
    <h2>${channel.name}</h2><h3>Participants</h3><ul>${stats}</ul><hr>${htmlLines.join('')}<hr>
    </body></html>`;

  const filename = `${channel.id}.html`;
  const dir = path.join(__dirname, 'transcripts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, filename), html);

  const txt = sorted.map(m =>
    `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || '[Embed/Attachment]'}`
  ).join('\n');

  const txtFile = new AttachmentBuilder(Buffer.from(txt), { name: `transcript-${channel.id}.txt` });

  const embed = new EmbedBuilder()
    .setTitle('📄 Transcript Ready')
    .setDescription(`[Click to view transcript](${BASE_URL}/transcripts/${filename})`)
    .setColor('#4fc3f7')
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], files: [txtFile] });
  const logChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logChannel) logChannel.send({ embeds: [embed], files: [txtFile] });
}

client.login(process.env.TOKEN);
setInterval(() => {
  fetch(BASE_URL).catch(() => {});
}, 5 * 60 * 1000);