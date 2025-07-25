const { createCanvas, loadImage } = require('canvas');

module.exports = async function generateTradeCanvas(user1, user2, side1, side2) {
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff'; // Change to '#000000' for black background
  ctx.fillRect(0, 0, width, height);

  // Fonts
  ctx.font = 'bold 36px Arial';
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.fillText('• Trade •', width / 2, 70);

  // Load avatars
  const avatar1 = await loadImage(user1.displayAvatarURL({ extension: 'png', size: 128 }));
  const avatar2 = await loadImage(user2.displayAvatarURL({ extension: 'png', size: 128 }));

  // Left text / right avatar layout
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'left';

  // User 1
  ctx.fillText(`• ${user1.username}'s side:`, 50, 180);
  ctx.font = 'normal 22px Arial';
  ctx.fillText(side1, 50, 220);
  ctx.drawImage(avatar1, width - 180, 140, 100, 100);

  // User 2
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`• ${user2.username}'s side:`, 50, 340);
  ctx.font = 'normal 22px Arial';
  ctx.fillText(side2, 50, 380);
  ctx.drawImage(avatar2, width - 180, 300, 100, 100);

  return canvas.toBuffer();
};