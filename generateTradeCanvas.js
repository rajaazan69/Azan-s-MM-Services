const { createCanvas, loadImage, registerFont } = require('canvas');
const fetch = require('node-fetch');
const path = require('path');

// Optional: Register custom font
// registerFont(path.join(__dirname, 'fonts', 'yourfont.ttf'), { family: 'YourFont' });

module.exports = async (user1, user2, side1, side2) => {
  const width = 900;
  const height = 360;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#2b2d31';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('• TRADE •', width / 2 - 60, 45);

  // Separator
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(width / 2, 80);
  ctx.lineTo(width / 2, height - 30);
  ctx.stroke();

  // Fetch avatars
  const avatar1 = await loadImage(user1.displayAvatarURL({ format: 'png', size: 128 }));
  const avatar2 = await loadImage(user2.displayAvatarURL({ format: 'png', size: 128 }));

  // Left user
  ctx.drawImage(avatar1, 50, 100, 128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${user1.username}`, 50, 250);
  ctx.font = '18px sans-serif';
  ctx.fillText(`Side: ${side1}`, 50, 280);

  // Right user
  ctx.drawImage(avatar2, width - 178, 100, 128, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${user2.username}`, width - 178, 250);
  ctx.font = '18px sans-serif';
  ctx.fillText(`Side: ${side2}`, width - 178, 280);

  return canvas.toBuffer();
};