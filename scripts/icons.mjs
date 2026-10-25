// Renders PNG app icons + iOS launch screens from public/favicon.svg. Usage: node scripts/icons.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const svg = fs.readFileSync('public/favicon.svg');
// Full-bleed variant (no rounded corners) — iOS and Android apply their own mask.
const square = Buffer.from(svg.toString().replace('rx="112"', 'rx="0"'));
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await sharp(square, { density: 300 }).resize(size, size).png().toFile(`public/${file}`);
}

// iPhone portrait screens: [css width, css height, pixel ratio]
export const SPLASH = [
  [440, 956, 3], [430, 932, 3], [428, 926, 3], [420, 912, 3], [414, 896, 3], [414, 896, 2],
  [402, 874, 3], [393, 852, 3], [390, 844, 3], [375, 812, 3], [375, 667, 2],
];
fs.mkdirSync('public/splash', { recursive: true });
for (const [w, h, r] of SPLASH) {
  const W = w * r;
  const H = h * r;
  const icon = Math.round(W * 0.26);
  const logo = await sharp(svg, { density: 600 }).resize(icon, icon).png().toBuffer();
  await sharp({ create: { width: W, height: H, channels: 3, background: '#000000' } })
    .composite([{ input: logo, left: Math.round((W - icon) / 2), top: Math.round((H - icon) / 2 - H * 0.04) }])
    .png({ compressionLevel: 9 })
    .toFile(`public/splash/${W}x${H}.png`);
}
console.log(
  SPLASH.map(([w, h, r]) => `    <link rel="apple-touch-startup-image" href="/gym-log/splash/${w * r}x${h * r}.png" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" />`).join('\n'),
);
