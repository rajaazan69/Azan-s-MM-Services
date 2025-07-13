// FULL `index.js` — keep everything else same (like .env, transcripts folder, etc.)

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
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

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
    const commands = [
      new SlashCommandBuilder().setName('setup').setDescription('Send ticket panel').addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true)),
      new SlashCommandBuilder().setName('close').setDescription('Close the ticket'),
      new SlashCommandBuilder().setName('delete').setDescription('Delete the ticket'),
      new SlashCommandBuilder().setName('rename').setDescription('Rename the ticket').addStringOption(opt => opt.setName('name').setDescription('New name').setRequired(true)),
      new SlashCommandBuilder().setName('add').setDescription('Add a user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('remove').setDescription('Remove a user').addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true)),
      new SlashCommandBuilder().setName('transcript').setDescription('Generate transcript'),
      new SlashCommandBuilder().setName('tagcreate').setDescription('Create tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)).addStringOption(o => o.setName('message').setDescription('Tag message').setRequired(true)),
      new SlashCommandBuilder().setName('tag').setDescription('Send tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
      new SlashCommandBuilder().setName('tagdelete').setDescription('Delete tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)),
      new SlashCommandBuilder().setName('taglist').setDescription('List tags')
    ].map(c => c.toJSON());
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
          .setTitle('**Request Middleman**')
          .setDescription('**Click Below To Request Azan’s Services**\nPlease answer all the questions correctly.')
          .setColor('Blue');
        const btn = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('openTicket').setLabel('Request Middleman').setStyle(ButtonStyle.Primary)
        );
        await target.send({ embeds: [embed], components: [btn] });
        await interaction.reply({ content: '✅ Panel setup complete.', ephemeral: true });
      }

      // --- TAG COMMANDS USING SUPABASE ---
      if (commandName === 'tagcreate') {
        const name = options.getString('name');
        const message = options.getString('message');
        await supabase.from('tags').upsert([{ name, message }]);
        return interaction.reply({ content: `✅ Tag \`${name}\` saved.`, ephemeral: true });
      }

      if (commandName === 'tag') {
        const name = options.getString('name');
        const { data } = await supabase.from('tags').select('message').eq('name', name).single();
        if (data) interaction.reply({ content: data.message });
        else interaction.reply({ content: `❌ Tag \`${name}\` not found.` });
      }

      if (commandName === 'tagdelete') {
        const name = options.getString('name');
        await supabase.from('tags').delete().eq('name', name);
        return interaction.reply({ content: `🗑️ Tag \`${name}\` deleted.`, ephemeral: true });
      }

      if (commandName === 'taglist') {
        const { data } = await supabase.from('tags').select('name');
        const list = data.map(row => `• \`${row.name}\``).join('\n') || 'No tags found.';
        interaction.reply({ content: list });
      }

      // CLOSE, DELETE, ADD, REMOVE, RENAME, TRANSCRIPT — keep unchanged
      // (Not repeated here for brevity, just copy from your current file)
    }

    // ✅ FIXED BUTTON INTERACTION HANDLING
    if (interaction.isButton()) {
      if (interaction.customId === 'delete') {
        await interaction.channel.delete();
      }

      if (interaction.customId === 'transcript') {
        await handleTranscript(interaction, interaction.channel);
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
    console.error('❌ Interaction Error:', err);
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
  const stats = [...participants.entries()].map(([id, count]) => `<li><a href="https://discord.com/users/${id}">${id}</a>: ${count} msgs</li>`).join('');
  const html = `<html><body><h2>${channel.name}</h2><ul>${stats}</ul><hr>${lines.join('')}<hr></body></html>`;
  const filename = `${channel.id}.html`;
  const folder = path.join(__dirname, 'transcripts');
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, filename), html);
  const txt = sorted.map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.cleanContent || '[Embed]'}`).join('\n');
  fs.writeFileSync(path.join(folder, `transcript-${channel.id}.txt`), txt);
  const embed = new EmbedBuilder()
    .setTitle('📄 Transcript')
    .setDescription(`[View Transcript](${BASE_URL}/transcripts/${filename})`)
    .setColor('Green')
    .setTimestamp();
  await interaction.reply({ embeds: [embed], files: [new AttachmentBuilder(path.join(folder, `transcript-${channel.id}.txt`))] }).catch(() => {});
  const logChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL);
  if (logChannel) logChannel.send({ embeds: [embed] });
}

client.login(process.env.TOKEN);
setInterval(() => fetch(BASE_URL).catch(() => {}), 5 * 60 * 1000);