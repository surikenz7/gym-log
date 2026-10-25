// Renders PNG app icons from public/favicon.svg. Usage: node scripts/icons.mjs
import sharp from 'sharp';
import fs from 'node:fs';
const svg = fs.readFileSync('public/favicon.svg');
// Full-bleed variant (no rounded corners) — iOS and Android apply their own mask.
const square = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"'));
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await sharp(square, { density: 300 }).resize(size, size).png().toFile(`public/${file}`);
}
console.log('icons done');
