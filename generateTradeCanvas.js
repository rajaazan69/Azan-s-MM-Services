const { createCanvas, loadImage, registerFont } = require('canvas');
const { AttachmentBuilder } = require('discord.js');
const path = require('path');

registerFont('./fonts/Inter-Bold.ttf', { family: 'Inter' });

async function generateTradeCanvas(user1, user2, side1, side2) {
  const canvas = createCanvas(900, 250);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('• Trade •', canvas.width / 2, 45);

  const avatar1 = await loadImage(user1.displayAvatarURL({ extension: 'png', size: 128 }));
  const avatar2 = await loadImage(user2.displayAvatarURL({ extension: 'png', size: 128 }));

  const leftX = 70;
  const rightX = canvas.width - 70 - 96;
  const midY = 100;

  ctx.drawImage(avatar1, leftX, midY, 96, 96);
  ctx.drawImage(avatar2, rightX, midY, 96, 96);

  ctx.font = 'bold 20px Inter';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(user1.tag, leftX + 110, midY + 20);
  ctx.fillText(user2.tag, rightX - 210, midY + 20);

  ctx.font = '18px Inter';
  ctx.fillStyle = '#aaaaaa';
  ctx.fillText(`Side: ${side1}`, leftX + 110, midY + 50);
  ctx.fillText(`Side: ${side2}`, rightX - 210, midY + 50);

  const buffer = canvas.toBuffer();
  return new AttachmentBuilder(buffer, { name: 'trade_embed_canvas.png' });
}

module.exports = { generateTradeCanvas };