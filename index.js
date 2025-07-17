// index.js

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType, PermissionsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const { QuickDB } = require('quick.db');
const db = new QuickDB();
const app = express();

// --- CONFIGURATION (edit your own IDs here) ---
const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525';
const PANEL_CHANNEL = '1373048211538841702';
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';
const TOKEN = process.env.TOKEN;
const PORT = 3000;

// --- SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

// --- MONGOOSE TAG SYSTEM ---
mongoose.connect('mongodb://127.0.0.1:27017/tagdb').then(() => {
    console.log('[MONGO] Connected.');
}).catch(err => console.error('[MONGO] Error:', err));

const tagSchema = new mongoose.Schema({
    guildId: String,
    name: String,
    content: String,
    creatorId: String,
});
const Tag = mongoose.model('Tag', tagSchema);

// --- EXPRESS + SELF PING ---
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`[EXPRESS] Web server listening on port ${PORT}`));
setInterval(() => require('node-fetch')(`http://localhost:${PORT}`), 60_000);

// --- BOT READY ---
client.once('ready', () => {
    console.log(`[BOT] Logged in as ${client.user.tag}`);
});

// --- COMMANDS ---
client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;

    const prefix = '$';
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // $setup
    if (command === 'setup') {
        const embed = new EmbedBuilder()
            .setTitle('Middleman Request')
            .setDescription('Click the button below to open a ticket.
You will be asked:
1. What's the trade?
2. What's the side?
3. What's their side?
4. What's their user ID?')
            .setColor(0x00AE86);

        const button = new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Request Middleman')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        const channel = await client.channels.fetch(PANEL_CHANNEL);
        if (channel) channel.send({ embeds: [embed], components: [row] });
        return message.reply('â Panel has been sent.');
    }

    // $tagcreate <name> <content>
    if (command === 'tagcreate') {
        const [name, ...contentArr] = args;
        const content = contentArr.join(' ');
        if (!name || !content) return message.reply('Usage: `$tagcreate <name> <content>`');
        const exists = await Tag.findOne({ guildId: message.guild.id, name });
        if (exists) return message.reply('â Tag already exists.');
        await Tag.create({ guildId: message.guild.id, name, content, creatorId: message.author.id });
        return message.reply(`â Tag \`${name}\` created.`);
    }

    // $tag <name>
    if (command === 'tag') {
        const name = args[0];
        if (!name) return message.reply('Usage: `$tag <name>`');
        const tag = await Tag.findOne({ guildId: message.guild.id, name });
        if (!tag) return message.reply('â Tag not found.');
        return message.channel.send(tag.content);
    }

    // $tagdelete <name>
    if (command === 'tagdelete') {
        const name = args[0];
        if (!name) return message.reply('Usage: `$tagdelete <name>`');
        const deleted = await Tag.findOneAndDelete({ guildId: message.guild.id, name });
        if (!deleted) return message.reply('â Tag not found.');
        return message.reply(`â Tag \`${name}\` deleted.`);
    }

    // $close
    if (command === 'close') {
        if (message.channel.parentId !== TICKET_CATEGORY) return message.reply('â Not a ticket channel.');

        const member = message.guild.members.cache.get(message.channel.topic);
        if (member) await message.channel.permissionOverwrites.edit(member, { SendMessages: false, ViewChannel: false });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('transcript').setLabel('Transcript').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('delete').setLabel('Delete').setStyle(ButtonStyle.Danger)
        );

        return message.channel.send({ content: 'Ticket closed. What do you want to do next?', components: [row] });
    }

    // $open
    if (command === 'open') {
        if (message.channel.parentId !== TICKET_CATEGORY) return message.reply('â Not a ticket channel.');
        const member = message.guild.members.cache.get(message.channel.topic);
        if (member) await message.channel.permissionOverwrites.edit(member, { SendMessages: true, ViewChannel: true });
        return message.reply('â Ticket reopened.');
    }

    // $delete
    if (command === 'delete') {
        if (message.channel.parentId !== TICKET_CATEGORY) return message.reply('â Not a ticket channel.');
        return message.channel.delete();
    }

    // $transcript
    if (command === 'transcript') {
        const messages = await message.channel.messages.fetch({ limit: 100 });
        const content = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('<br>');
        const html = `<html><body><pre>${content}</pre></body></html>`;
        const fileName = `transcript-${message.channel.id}.html`;
        const filePath = path.join(__dirname, 'transcripts', fileName);

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, html);

        const url = `http://localhost:${PORT}/transcripts/${fileName}`;
        const transcriptEmbed = new EmbedBuilder()
            .setTitle('Transcript')
            .setDescription(`[Click to view transcript](${url})`)
            .setColor(0x3498db);

        const channel = await client.channels.fetch(TRANSCRIPT_CHANNEL);
        if (channel?.isTextBased()) channel.send({ embeds: [transcriptEmbed] });
        return message.reply({ embeds: [transcriptEmbed] });
    }
});

// --- PANEL INTERACTION ---
client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId === 'create_ticket') {
        const modal = new ModalBuilder()
            .setCustomId('ticket_modal')
            .setTitle('Middleman Ticket')
            .addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel("What's the side?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4').setLabel("What's their user ID?").setStyle(TextInputStyle.Short).setRequired(false))
            );
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_modal') {
        const [q1, q2, q3, q4] = ['q1', 'q2', 'q3', 'q4'].map(id => interaction.fields.getTextInputValue(id));
        const userId = q4 || 'Unknown User';
        const ticketName = `ticket-${interaction.user.username}`;
        const channel = await interaction.guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY,
            topic: interaction.user.id,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: OWNER_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: MIDDLEMAN_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        });

        const embed = new EmbedBuilder()
            .setTitle('New Ticket Created')
            .addFields(
                { name: 'What's the trade?', value: q1 },
                { name: 'What's the side?', value: q2 },
                { name: 'What's their side?', value: q3 },
                { name: 'User ID', value: userId }
            )
            .setColor(0x00AE86);

        await channel.send({ content: `<@${interaction.user.id}> <@&${MIDDLEMAN_ROLE}>`, embeds: [embed] });
        await interaction.reply({ content: `â Ticket created: ${channel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'transcript') {
        interaction.deferReply();
        message.channel.send('$transcript');
    }

    if (interaction.isButton() && interaction.customId === 'delete') {
        interaction.channel.delete();
    }
});

client.login(TOKEN);
