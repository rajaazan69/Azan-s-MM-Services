const { createCanvas, loadImage, registerFont } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const path = require('path');

// Optional: Use a custom font (you can replace this with your own TTF)

module.exports = async function generateTradeCanvas(user1, user2, user1Side, user2Side, tradeTitle) {
  const width = 1000;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw background
  ctx.fillStyle = '#1a1b1f'; // dark gray/black
  ctx.fillRect(0, 0, width, height);

  // Draw main title
  ctx.font = '30px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('• Trade •', width / 2 - ctx.measureText('• Trade •').width / 2, 50);

  // Avatar positions
  const avatarSize = 100;
  const leftAvatarX = 80;
  const rightAvatarX = width - avatarSize - 80;
  const avatarY = 80;

  // Draw avatars
  if (user1?.displayAvatarURL) {
    const avatar1 = await loadImage(user1.displayAvatarURL({ extension: 'png', size: 256 }));
    ctx.drawImage(avatar1, leftAvatarX, avatarY, avatarSize, avatarSize);
  }

  if (user2?.displayAvatarURL) {
    const avatar2 = await loadImage(user2.displayAvatarURL({ extension: 'png', size: 256 }));
    ctx.drawImage(avatar2, rightAvatarX, avatarY, avatarSize, avatarSize);
  }

  // Text spacing
  const textYStart = avatarY + avatarSize + 30;
  const textLeftX = leftAvatarX;
  const textRightX = rightAvatarX;

  // Labels
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#ffffff';

  ctx.fillText(`User 1:`, textLeftX, textYStart);
  ctx.fillText(`User 2:`, textRightX, textYStart);

  ctx.font = '16px Arial';
  ctx.fillText(`${user1?.username || 'Unknown'}`, textLeftX, textYStart + 25);
  ctx.fillText(`${user2?.username || 'Unknown'}`, textRightX, textYStart + 25);

  // Trade sides
  ctx.font = 'bold 18px Arial';
  ctx.fillText(`Side:`, textLeftX, textYStart + 60);
  ctx.fillText(`Side:`, textRightX, textYStart + 60);

  ctx.font = '16px Arial';
  wrapText(ctx, user1Side || 'N/A', textLeftX, textYStart + 85, 200, 20);
  wrapText(ctx, user2Side || 'N/A', textRightX, textYStart + 85, 200, 20);

  // Create attachment
  const buffer = canvas.toBuffer('image/png');
  const attachment = new AttachmentBuilder(buffer, { name: 'trade.png' });
  return attachment;
};

// Utility function to wrap text
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}