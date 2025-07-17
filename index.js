// 📦 Required Modules
const {
	Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField,
	ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
	ButtonBuilder, ButtonStyle
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

// ⚙️ Config
const OWNER_ID = '1356149794040446998';
const MIDDLEMAN_ROLE = '1373062797545570525';
const PANEL_CHANNEL = '1373048211538841702';
const TICKET_CATEGORY = '1373027564926406796';
const TRANSCRIPT_CHANNEL = '1373058123547283568';

// 📡 Bot Client
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers
	],
	partials: [Partials.Channel]
});

// 🌍 Express Setup
const app = express();
const PORT = 3000;
app.get('/', (_, res) => res.send('Bot is alive.'));
app.use('/transcripts', express.static(path.join(__dirname, 'transcripts')));
app.listen(PORT, () => console.log(`🌐 Express running on port ${PORT}`));
setInterval(() => {
	require('node-fetch')(`http://localhost:${PORT}`).catch(() => {});
}, 5 * 60 * 1000);

// 🌐 MongoDB Setup
mongoose.connect(process.env.MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// 🧠 MongoDB Schema
const tagSchema = new mongoose.Schema({
	name: String,
	content: String,
	author: String,
});
const Tag = mongoose.model('Tag', tagSchema);

// 💬 Command Handler
client.commands = new Map();
const prefix = "$";

client.on('messageCreate', async (message) => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	// ---- $tag ----
	if (commandName === 'tag') {
		const name = args[0];
		if (!name) return message.reply('❌ Provide a tag name.');
		const tag = await Tag.findOne({ name });
		if (!tag) return message.reply('❌ Tag not found.');
		return message.channel.send(tag.content);
	}

	// ---- $tagcreate ----
	if (commandName === 'tagcreate') {
		const name = args.shift();
		const content = args.join(' ');
		if (!name || !content) return message.reply('❌ Provide a tag name and content.');
		const exists = await Tag.findOne({ name });
		if (exists) return message.reply('❌ Tag already exists.');
		await Tag.create({ name, content, author: message.author.id });
		return message.reply(`✅ Tag \`${name}\` created.`);
	}

	// ---- $tagdelete ----
	if (commandName === 'tagdelete') {
		const name = args[0];
		if (!name) return message.reply('❌ Provide a tag name.');
		const tag = await Tag.findOne({ name });
		if (!tag) return message.reply('❌ Tag not found.');
		if (tag.author !== message.author.id && message.author.id !== OWNER_ID)
			return message.reply('❌ You are not the owner of this tag.');
		await Tag.deleteOne({ name });
		return message.reply(`✅ Tag \`${name}\` deleted.`);
	}

	// ---- $tagedit ----
	if (commandName === 'tagedit') {
		const name = args.shift();
		const newContent = args.join(' ');
		if (!name || !newContent) return message.reply('❌ Provide tag name and new content.');
		const tag = await Tag.findOne({ name });
		if (!tag) return message.reply('❌ Tag not found.');
		if (tag.author !== message.author.id && message.author.id !== OWNER_ID)
			return message.reply('❌ You are not the owner of this tag.');
		tag.content = newContent;
		await tag.save();
		return message.reply(`✅ Tag \`${name}\` updated.`);
	}

	// ---- $taglist ----
	if (commandName === 'taglist') {
		const tags = await Tag.find({});
		if (!tags.length) return message.reply('📭 No tags found.');
		const embed = new EmbedBuilder()
			.setTitle('📚 All Tags')
			.setDescription(tags.map(t => `• \`${t.name}\``).join('\n'))
			.setColor('Blue');
		return message.channel.send({ embeds: [embed] });
	}
});

// 🎫 Interactions
client.on('interactionCreate', async (interaction) => {
	if (interaction.isButton()) {
		if (interaction.customId === 'createTicket') {
			const modal = new ModalBuilder().setCustomId('ticketModal').setTitle('Middleman Ticket');

			const inputs = [
				new TextInputBuilder().setCustomId('q1').setLabel("What's the trade?").setStyle(TextInputStyle.Short),
				new TextInputBuilder().setCustomId('q2').setLabel("What's your side?").setStyle(TextInputStyle.Short),
				new TextInputBuilder().setCustomId('q3').setLabel("What's their side?").setStyle(TextInputStyle.Short),
				new TextInputBuilder().setCustomId('q4').setLabel("Their Roblox User ID?").setStyle(TextInputStyle.Short).setRequired(false)
			];

			modal.addComponents(...inputs.map(i => new ActionRowBuilder().addComponents(i)));
			return interaction.showModal(modal);
		}

		if (interaction.customId === 'deleteTicket') {
			await interaction.channel.delete().catch(() => {});
		}

		if (interaction.customId === 'transcript') {
			const messages = await interaction.channel.messages.fetch({ limit: 100 });
			const content = [...messages.values()].reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
			const fileName = `${interaction.channel.id}.html`;
			const filePath = path.join(__dirname, 'transcripts', fileName);
			const html = `<html><body><pre>${content}</pre></body></html>`;
			fs.writeFileSync(filePath, html);
			const url = `http://localhost:${PORT}/transcripts/${fileName}`;
			const embed = new EmbedBuilder().setTitle('📄 Transcript').setDescription(`[View Transcript](${url})`).setColor('Green');
			return interaction.reply({ embeds: [embed], ephemeral: true });
		}
	}

	if (interaction.isModalSubmit() && interaction.customId === 'ticketModal') {
		const q1 = interaction.fields.getTextInputValue('q1');
		const q2 = interaction.fields.getTextInputValue('q2');
		const q3 = interaction.fields.getTextInputValue('q3');
		const q4 = interaction.fields.getTextInputValue('q4') || 'Unknown';

		const ticketChannel = await interaction.guild.channels.create({
			name: `ticket-${interaction.user.username}`,
			type: 0,
			parent: TICKET_CATEGORY,
			permissionOverwrites: [
				{ id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
				{ id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
				{ id: OWNER_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
				{ id: MIDDLEMAN_ROLE, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
			]
		});

		const embed = new EmbedBuilder()
			.setTitle('🎟️ New Ticket')
			.setDescription(`**Trade:** ${q1}\n**Their Side:** ${q3}\n**Your Side:** ${q2}\n**User ID:** ${q4}`)
			.setColor('Blue')
			.setFooter({ text: `User: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

		ticketChannel.send({ content: `<@${interaction.user.id}> <@&${MIDDLEMAN_ROLE}>`, embeds: [embed] });
		return interaction.reply({ content: `✅ Ticket created: ${ticketChannel}`, ephemeral: true });
	}
});

// ✅ Login
client.login(process.env.TOKEN);