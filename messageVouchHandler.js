const { handleTranscript } = require('../utils/handleTranscript'); // or wherever it's located
const { ChannelType, AttachmentBuilder } = require('discord.js');

const vouchKeywords = ['+vouch', 'vouch', 'rep', '+rep', 'vouching'];
const VOUCH_CHANNEL_ID = 'YOUR_VOUCH_CHANNEL_ID_HERE'; // 🟡 <-- Replace with your real channel ID

const recentTrades = [];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (
      message.author.bot ||
      message.channel.id !== VOUCH_CHANNEL_ID
    ) return;

    const content = message.content.toLowerCase();
    if (!vouchKeywords.some(k => content.includes(k))) return;

    const trade = recentTrades.find(t =>
      [t.user1, t.user2].includes(message.author.id)
    );
    if (!trade) return;

    if (!trade.vouched) trade.vouched = {};
    if (trade.vouched[message.author.id]) return;

    const otherUser = trade.user1 === message.author.id ? trade.user2 : trade.user1;
    trade.vouched[message.author.id] = true;

    await message.channel.send(`✅ <@${message.author.id}> has vouched for <@${otherUser}>`);

    if (trade.vouched[trade.user1] && trade.vouched[trade.user2]) {
      await message.channel.send(`🎉 Both users have vouched. Generating transcript and closing ticket...`);

      try {
        const ticketChannel = await client.channels.fetch(trade.ticketChannelId);

        // Fake an interaction to match your handleTranscript() input
        const fakeInteraction = {
          editReply: () => Promise.resolve(),
          replied: true,
          deferred: true
        };

        await handleTranscript(fakeInteraction, ticketChannel);

        setTimeout(() => {
          ticketChannel.delete('✅ Both users vouched — trade complete.');
        }, 5000);

      } catch (err) {
        console.error('❌ Failed to close ticket after vouch:', err);
      }
    }
  });
};

module.exports.addRecentTrade = (user1Id, user2Id, ticketChannelId) => {
  recentTrades.push({
    user1: user1Id,
    user2: user2Id,
    ticketChannelId,
    timestamp: Date.now()
  });

  // Clean up old trades (after 2 hours)
  const now = Date.now();
  for (let i = recentTrades.length - 1; i >= 0; i--) {
    if (now - recentTrades[i].timestamp > 2 * 60 * 60 * 1000) {
      recentTrades.splice(i, 1);
    }
  }
};