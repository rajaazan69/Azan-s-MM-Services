const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// Optional: use a custom font if needed
// registerFont(path.join(__dirname, 'fonts', 'YourFont.ttf'), { family: 'YourFont' });

module.exports = async function generateTradeCanvas(user1, user2, side1, side2) {
  const canvas = createCanvas(800, 300);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#000000'; // solid black
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('• BIG | TRADE •', canvas.width / 2, 40);

  // Divider
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 60);
  ctx.lineTo(750, 60);
  ctx.stroke();

  // Load avatars
  const avatar1 = await loadImage(user1.displayAvatarURL({ extension: 'png', size: 128 }));
  const avatar2 = await loadImage(user2.displayAvatarURL({ extension: 'png', size: 128 }));

  // Sides
  ctx.font = '20px Arial';
  ctx.textAlign = 'left';

  // User 1 side
  ctx.fillText(`@${user1.username} side:`, 50, 130);
  ctx.drawImage(avatar1, 600, 90, 80, 80); // Avatar to the right

  ctx.font = '16px Arial';
  wrapText(ctx, side1, 50, 160, 500, 20);

  // Divider line
  ctx.strokeStyle = '#444';
  ctx.beginPath();
  ctx.moveTo(50, 190);
  ctx.lineTo(750, 190);
  ctx.stroke();

  // User 2 side
  ctx.font = '20px Arial';
  ctx.fillText(`@${user2.username} side:`, 50, 240);
  ctx.drawImage(avatar2, 600, 200, 80, 80); // Avatar to the right

  ctx.font = '16px Arial';
  wrapText(ctx, side2, 50, 270, 500, 20);

  return canvas.toBuffer('image/png');
};

// Utility function for wrapping text
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