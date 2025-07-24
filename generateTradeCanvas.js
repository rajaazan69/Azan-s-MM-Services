// generateTradeCanvas.js
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Optional: If using a custom font like Inter
// registerFont(path.join(__dirname, 'Inter-Bold.ttf'), { family: 'Inter' });

async function generateTradeCanvas(user1, user2, side1, side2) {
  const canvas = createCanvas(1000, 400);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '30px Arial';
  ctx.fillText('• Trade •', 420, 50);

  // Load avatars
  const avatar1 = await loadImage(user1.displayAvatarURL({ extension: 'png', size: 256 }));
  const avatar2 = await loadImage(user2.displayAvatarURL({ extension: 'png', size: 256 }));

  // Avatars
  ctx.drawImage(avatar1, 80, 120, 128, 128);
  ctx.drawImage(avatar2, 790, 120, 128, 128);

  // Usernames
  ctx.font = 'bold 24px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(user1.username, 80, 280);
  ctx.fillText(user2.username, 790, 280);

  // Trade items
  ctx.font = '20px Arial';
  ctx.fillStyle = '#cccccc';
  ctx.fillText(`Side: ${side1}`, 250, 170, 400);
  ctx.fillText(`Side: ${side2}`, 470, 170, 400);

  return { attachment: canvas.toBuffer(), name: 'trade.png' };
}

module.exports = generateTradeCanvas;