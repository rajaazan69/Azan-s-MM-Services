
const { EmbedBuilder, PermissionsBitField } = require('discord.js');


module.exports = {
    name: 'whois',
    description: 'Displays information about a Discord user in the server or yourself.',
    aliases: ['userinfo', 'ui'],
    usage: '[@user or userID]',
    category: 'info', 
    async execute(message, args, client) {
        let targetMember;

        if (args.length > 0) {
            const targetArg = args[0];
            if (message.mentions.members.first()) {
                targetMember = message.mentions.members.first();
            } else if (/^\d{17,19}$/.test(targetArg)) {
                try {
                    targetMember = await message.guild.members.fetch(targetArg);
                } catch (e) {
                    return message.reply({ content: 'Could not find a member with that ID in this server.', ephemeral: true });
                }
            } else {
                
                const searchString = args.join(' ').toLowerCase();
                
                const fetchedMembers = await message.guild.members.fetch({ query: searchString, limit: 1 }).catch(() => null);
                if (fetchedMembers && fetchedMembers.size > 0) {
                    targetMember = fetchedMembers.first();
                } else {
                    return message.reply({ content: `Could not find a member matching "${args.join(' ')}". Please use an ID, mention, or ensure the name is correct.`, ephemeral: true });
                }
            }
        } else {
            targetMember = message.member; 
        }

        if (!targetMember) {
            
            return message.reply({ content: 'Could not find or resolve the specified member.', ephemeral: true });
        }

        const user = targetMember.user;

        const formatDate = (date) => {
            if (!date) return 'N/A';
            return `<t:${Math.floor(date.getTime() / 1000)}:F> (<t:${Math.floor(date.getTime() / 1000)}:R>)`;
        };

       
        const roles = targetMember.roles.cache
            .filter(role => role.id !== message.guild.id) 
            .sort((a, b) => b.position - a.position) 
            .map(role => `<@&${role.id}>`); 
        
        const roleCount = roles.length;
        
        const displayedRoles = roleCount > 0 ? (roles.slice(0, 10).join(', ') + (roles.length > 10 ? ` and ${roles.length - 10} more...` : '')) : 'No roles';

        const userFlags = user.flags ? user.flags.toArray() : [];
        const flagEmojis = { 
            Staff: '🛡️ Discord Staff',
            Partner: '🤝 Partnered Server Owner',
            Hypesquad: '🎉 HypeSquad Events',
            BugHunterLevel1: '🐛 Bug Hunter (Level 1)',
            BugHunterLevel2: '🐞 Bug Hunter (Level 2)',
            HypeSquadOnlineHouse1: '🏠 Bravery', 
            HypeSquadOnlineHouse2: '🏠 Brilliance', 
            HypeSquadOnlineHouse3: '🏠 Balance', 
            PremiumEarlySupporter: '💎 Early Supporter',
            TeamPseudoUser: '🤖 Team User', 
            VerifiedBot: '✅ Verified Bot',
            VerifiedDeveloper: '🛠️ Early Verified Bot Developer',
            CertifiedModerator: '📜 Discord Certified Moderator', 
            ActiveDeveloper: '💻 Active Developer'
        };

        const badgeString = userFlags.map(flag => flagEmojis[flag] || flag.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())).join('\n') || 'None';


        const whoisEmbed = new EmbedBuilder()
            .setColor(targetMember.displayHexColor === '#000000' ? '#99aab5' : targetMember.displayHexColor)
            .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { 
                    name: 'User Information', 
                    value: `**Mention:** <@${user.id}>\n**ID:** \`${user.id}\`\n**Username:** ${user.username}\n**Display Name:** ${user.globalName || user.username}\n**Is Bot:** ${user.bot ? 'Yes' : 'No'}`, 
                    inline: true 
                },
                { name: 'Dates', value: `**Created:** ${formatDate(user.createdAt)}\n**Joined Server:** ${formatDate(targetMember.joinedAt)}`, inline: false },
                { name: `Roles (${roleCount})`, value: displayedRoles, inline: false }
            )
            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        if (userFlags.length > 0) {
            whoisEmbed.addFields({ name: 'Badges', value: badgeString, inline: false });
        }
         if (targetMember.premiumSinceTimestamp) { 
            whoisEmbed.addFields({ name: '✨ Server Booster', value: `Boosting since ${formatDate(new Date(targetMember.premiumSinceTimestamp))}`, inline: false });
        }
        if (targetMember.voice.channel) {
            whoisEmbed.addFields({ name: 'Voice Channel', value: `${targetMember.voice.channel.name} (ID: \`${targetMember.voice.channel.id}\`)`, inline: false });
        }


        await message.channel.send({ embeds: [whoisEmbed] });
    },
};
