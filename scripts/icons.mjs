// Renders the 3D barbell app icon in every theme colour, plus iOS launch screens.
// Usage: node scripts/icons.mjs
import sharp from 'sharp';
import fs from 'node:fs';

// keep in sync with src/lib/theme.ts
const THEMES = {
  blood: ['#e5262d', '#ff7a1a'],
  inferno: ['#ff6a00', '#ffd000'],
  gold: ['#f2b705', '#fff1a8'],
  toxic: ['#a3e635', '#22d3ee'],
  steel: ['#aeb8c2', '#f1f5f9'],
  cobalt: ['#2f7cf6', '#22d3ee'],
  venom: ['#a855f7', '#ec4899'],
  pump: ['#ff2e7e', '#ffb020'],
  ocean: ['#0ea5e9', '#2dd4bf'],
  mint: ['#10b981', '#a7f3d0'],
  royal: ['#6366f1', '#c084fc'],
  sunset: ['#fb7185', '#fdba74'],
  forest: ['#16a34a', '#bef264'],
  ice: ['#7dd3fc', '#e0f2fe'],
  mono: ['#f4f4f5', '#a1a1aa'],
  coffee: ['#c08457', '#f5deb3'],
};

const INK = { gold: '#141414', toxic: '#141414', steel: '#141414', inferno: '#ffffff', ice: '#0c2433', mono: '#141414', mint: '#ffffff', sunset: '#ffffff', coffee: '#ffffff' };

const shade = (hex, f) => {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const m = n.map((c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f));
  return `#${m.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

/** Plain, flat barbell on the theme colour — like a normal app icon. */
function iconSvg([accent], { rounded = false, ink = '#ffffff' } = {}) {
  const r = rounded ? 112 : 0;
  const plate = (x, w, h) => `<rect x="${x}" y="${256 - h / 2}" width="${w}" height="${h}" rx="${Math.min(14, w / 2)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${shade(accent, 0.12)}"/>
      <stop offset="1" stop-color="${shade(accent, -0.18)}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${r}" fill="url(#bg)"/>
  <g fill="${ink}">
    <rect x="52" y="242" width="408" height="28" rx="14"/>
    ${plate(84, 40, 164)}
    ${plate(128, 54, 244)}
    ${plate(186, 18, 84)}
    ${plate(308, 18, 84)}
    ${plate(330, 54, 244)}
    ${plate(388, 40, 164)}
  </g>
</svg>`;
}

fs.mkdirSync('public/icons', { recursive: true });
for (const [name, colors] of Object.entries(THEMES)) {
  const svg = Buffer.from(iconSvg(colors, { ink: INK[name] }));
  for (const size of [180, 192, 512]) await sharp(svg, { density: 300 }).resize(size, size).png().toFile(`public/icons/${name}-${size}.png`);
}
// defaults (manifest / first install) = Blood
fs.copyFileSync('public/icons/blood-180.png', 'public/apple-touch-icon.png');
fs.copyFileSync('public/icons/blood-192.png', 'public/icon-192.png');
fs.copyFileSync('public/icons/blood-512.png', 'public/icon-512.png');
fs.writeFileSync('public/favicon.svg', iconSvg(THEMES.blood, { rounded: true }));

// iPhone portrait launch screens: [css width, css height, pixel ratio]
export const SPLASH = [
  [440, 956, 3], [430, 932, 3], [428, 926, 3], [420, 912, 3], [414, 896, 3], [414, 896, 2],
  [402, 874, 3], [393, 852, 3], [390, 844, 3], [375, 812, 3], [375, 667, 2],
];
fs.mkdirSync('public/splash', { recursive: true });
const BG = '#0b0707';
for (const [name, colors] of Object.entries({ '': THEMES.blood, ...THEMES })) {
  const dir = name ? `public/splash/${name}` : 'public/splash';
  fs.mkdirSync(dir, { recursive: true });
  const logo = Buffer.from(iconSvg(colors, { rounded: true, ink: INK[name] }));
  for (const [w, h, r] of SPLASH) {
  const W = w * r;
  const H = h * r;
  const icon = Math.round(W * 0.3);
  const png = await sharp(logo, { density: 600 }).resize(icon, icon).png().toBuffer();
  await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
    .composite([{ input: png, left: Math.round((W - icon) / 2), top: Math.round((H - icon) / 2 - H * 0.04) }])
    .png({ compressionLevel: 9 })
    .toFile(`${dir}/${W}x${H}.png`);
  }
}
console.log('icons for', Object.keys(THEMES).join(', '));
