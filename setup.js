const { SlashCommandBuilder, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Send the ticket panel.'),

    async execute(interaction) {
        const panelEmbed = new EmbedBuilder()
            .setTitle('Request a Middleman')
            .setDescription('Click the button below to request a trusted middleman.\n\n> 💬 Please make sure to answer honestly when prompted.\n\n**Note:** Staff might deny suspicious or vague requests.')
            .setColor('#2f3136');

        const openButton = new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('Request Middleman')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(openButton);

        await interaction.reply({ embeds: [panelEmbed], components: [row] });
    }
};