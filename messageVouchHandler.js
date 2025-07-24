const vouchKeywords = ['+vouch', 'vouch', 'rep', '+rep', 'vouching'];
const VOUCH_CHANNEL_ID = '1373027974827212923';

const { handleTranscript } = require('../utils/handleTranscript'); // or wherever you defined it

const recentTrades = [];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.channel.id !== VOUCH_CHANNEL_ID) return;

    const content = message.content.toLowerCase();
    if (!vouchKeywords.some(k => content.includes(k))) return;

    const now = Date.now();
    // Clean up old trades (older than 2h)
    for (let i = recentTrades.length - 1; i >= 0; i--) {
      if (now - recentTrades[i].timestamp > 2 * 60 * 60 * 1000) {
        recentTrades.splice(i, 1);
      }
    }

    const trade = recentTrades.find(t =>
      [t.user1, t.user2].includes(message.author.id)
    );
    if (!trade) return;

    if (!trade.vouched) trade.vouched = {};
    if (trade.vouched[message.author.id]) return;

    trade.vouched[message.author.id] = true;

    const otherUser = trade.user1 === message.author.id ? trade.user2 : trade.user1;
    await message.channel.send(`✅ <@${message.author.id}> has vouched for <@${otherUser}>`);

    const bothVouched = trade.vouched[trade.user1] && trade.vouched[trade.user2];
    if (bothVouched) {
      await message.channel.send(`🎉 Both users have vouched. Generating transcript...`);

      try {
        const ticketChannel = await client.channels.fetch(trade.ticketChannelId);
        
        // Fake an interaction object with .editReply() for reuse
        const fakeInteraction = {
          editReply: () => Promise.resolve(),
          replied: true,
          deferred: true
        };

        await handleTranscript(fakeInteraction, ticketChannel);

        setTimeout(() => ticketChannel.delete('Trade complete — both users vouched'), 5000);
      } catch (err) {
        console.error('Error generating transcript or deleting channel:', err);
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
};