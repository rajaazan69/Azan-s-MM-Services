const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

function formatDate(dateString) {
    const date = new Date(dateString);
    const M = date.getMonth() + 1;
    const D = date.getDate();
    const Y = date.getFullYear();
    let H = date.getHours();
    const MIN = date.getMinutes().toString().padStart(2, '0');
    const S = date.getSeconds().toString().padStart(2, '0');
    const ampm = H >= 12 ? 'PM' : 'AM';
    H = H % 12;
    H = H ? H : 12;
    return `${M}/${D}/${Y} - ${H}:${MIN}:${S} ${ampm}`;
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round(Math.abs(now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30.4375);
    const years = Math.round(days / 365.25);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('robloxinfo')
        .setDescription('Fetch information about a Roblox user by username or ID.')
        .addStringOption(option =>
            option.setName('user')
                .setDescription('Roblox username or user ID')
                .setRequired(true)
        ),
    async execute(interaction) {
        const query = interaction.options.getString('user');
        await interaction.deferReply();

        let userId = null;
        let userData = null;
        let userThumbnailUrl = 'https://www.roblox.com/images/logo/roblox_logo_300x300.png';

        try {
            if (isNaN(parseInt(query))) {
                const usernameResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
                    usernames: [query],
                    excludeBannedUsers: false
                });
                if (usernameResponse.data?.data?.length > 0) {
                    userId = usernameResponse.data.data[0].id;
                } else {
                    return await interaction.editReply(`❌ Could not find a Roblox user with the username "${query}".`);
                }
            } else {
                userId = parseInt(query);
            }

            const userDetailsResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
            userData = userDetailsResponse.data;

            try {
                const thumbnailResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
                if (thumbnailResponse.data?.data?.length > 0) {
                    userThumbnailUrl = thumbnailResponse.data.data[0].imageUrl;
                }
            } catch (thumbError) {
                console.warn(`[RobloxInfo] Thumbnail fetch error: ${thumbError.message}`);
            }

            const profileLink = `https://www.roblox.com/users/${userId}/profile`;
            const embed = new EmbedBuilder()
                .setColor(userData.isBanned ? 0xFF0000 : 0x000000)
                .setAuthor({ name: userData.name, iconURL: userThumbnailUrl, url: profileLink })
                .setThumbnail(userThumbnailUrl)
                .addFields(
                    { name: 'Display Name', value: `\`${userData.displayName}\``, inline: false },
                    { name: 'ID', value: `\`[ ${userData.id} ]\``, inline: false },
                    { name: 'Created', value: `${formatDate(userData.created)}\n${timeAgo(userData.created)}`, inline: false }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            if (userData.description && userData.description.trim()) {
                embed.addFields({ name: 'Description', value: userData.description.length > 1020 ? userData.description.slice(0, 1020) + '...' : userData.description });
            }

            if (userData.isBanned) {
                embed.addFields({ name: 'Status', value: 'BANNED', inline: true });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Profile Link')
                    .setStyle(ButtonStyle.Link)
                    .setURL(profileLink)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error(`[RobloxInfo] Error:`, error);
            const errMsg = error?.response?.data?.errors?.[0]?.message || 'An unexpected error occurred.';
            await interaction.editReply(`❌ Roblox API Error: ${errMsg}`);
        }
    }
};