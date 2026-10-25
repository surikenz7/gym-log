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
};

const shade = (hex, f) => {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const m = n.map((c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f));
  return `#${m.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

/** One iron plate seen at a 3/4 angle: back rim, body, then the bevelled front face with a hub. */
function plate(x, w, h, id, ring) {
  const cy = 256;
  const rx = Math.round(h * 0.13);
  return `
    <ellipse cx="${x}" cy="${cy}" rx="${rx}" ry="${h / 2}" fill="#0a0a0a"/>
    <rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" fill="url(#side)"/>
    <ellipse cx="${x + w}" cy="${cy}" rx="${rx}" ry="${h / 2}" fill="url(#face${id})" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
    <ellipse cx="${x + w}" cy="${cy}" rx="${rx * 0.86}" ry="${h * 0.43}" fill="none" stroke="${ring}" stroke-opacity=".9" stroke-width="5"/>
    <ellipse cx="${x + w}" cy="${cy}" rx="${rx * 0.72}" ry="${h * 0.36}" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="3"/>
    <ellipse cx="${x + w}" cy="${cy}" rx="${rx * 0.6}" ry="${h * 0.3}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="5"/>
    <ellipse cx="${x + w}" cy="${cy}" rx="${rx * 0.3}" ry="${h * 0.075}" fill="url(#chromeV)" stroke="#000" stroke-opacity=".6" stroke-width="1.5"/>
    <path d="M${x + w - rx * 0.55} ${cy - h * 0.43} A${rx} ${h / 2} 0 0 1 ${x + w + rx * 0.7} ${cy - h * 0.25}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>`;
}

function iconSvg([accent, accent2], { rounded = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(accent, 0.15)}"/>
      <stop offset=".55" stop-color="${accent}"/>
      <stop offset="1" stop-color="${shade(accent, -0.55)}"/>
    </linearGradient>
    <radialGradient id="glow" cx=".3" cy=".25" r=".7">
      <stop offset="0" stop-color="${accent2}" stop-opacity=".55"/>
      <stop offset="1" stop-color="${accent2}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx=".5" cy=".5" r=".75">
      <stop offset=".6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".45"/>
    </radialGradient>
    <linearGradient id="side" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a4d52"/>
      <stop offset=".18" stop-color="#2a2c30"/>
      <stop offset=".55" stop-color="#131416"/>
      <stop offset="1" stop-color="#050505"/>
    </linearGradient>
    <radialGradient id="face1" cx=".35" cy=".3" r=".9">
      <stop offset="0" stop-color="#5b5f66"/>
      <stop offset=".5" stop-color="#26282c"/>
      <stop offset="1" stop-color="#0c0c0d"/>
    </radialGradient>
    <radialGradient id="face2" cx=".35" cy=".3" r=".9">
      <stop offset="0" stop-color="#666a71"/>
      <stop offset=".5" stop-color="#2c2e33"/>
      <stop offset="1" stop-color="#0e0e10"/>
    </radialGradient>
    <linearGradient id="chromeV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".3" stop-color="#d9dde2"/>
      <stop offset=".55" stop-color="#7c838c"/>
      <stop offset=".75" stop-color="#c9ced4"/>
      <stop offset="1" stop-color="#4b5058"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10"/>
      <feOffset dx="6" dy="18" result="b"/>
      <feComponentTransfer><feFuncA type="linear" slope=".7"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#glow)"/>
  <g opacity=".07" stroke="#000" stroke-width="14">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${-200 + i * 70}" y1="560" x2="${120 + i * 70}" y2="-40"/>`).join('')}
  </g>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#vig)"/>
  <g transform="translate(256 256) scale(1.1) rotate(-22) translate(-256 -256)" filter="url(#shadow)">
    <rect x="30" y="245" width="452" height="22" rx="5" fill="url(#chromeV)"/>
    <rect x="30" y="240" width="74" height="32" rx="5" fill="url(#chromeV)"/>
    <rect x="408" y="240" width="74" height="32" rx="5" fill="url(#chromeV)"/>
    ${plate(96, 34, 260, 1, accent)}
    ${plate(130, 24, 196, 2, accent2)}
    <rect x="156" y="236" width="14" height="40" rx="3" fill="url(#chromeV)"/>
    <rect x="342" y="236" width="14" height="40" rx="3" fill="url(#chromeV)"/>
    ${plate(358, 24, 196, 2, accent2)}
    ${plate(382, 34, 260, 1, accent)}
    <g fill="url(#chromeV)" opacity=".9">
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${206 + i * 11}" y="248" width="4" height="16" fill="#000" opacity=".18"/>`).join('')}
    </g>
  </g>
</svg>`;
}

fs.mkdirSync('public/icons', { recursive: true });
for (const [name, colors] of Object.entries(THEMES)) {
  const svg = Buffer.from(iconSvg(colors));
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
const logo = Buffer.from(iconSvg(THEMES.blood, { rounded: true }));
fs.mkdirSync('public/splash', { recursive: true });
for (const [w, h, r] of SPLASH) {
  const W = w * r;
  const H = h * r;
  const icon = Math.round(W * 0.3);
  const png = await sharp(logo, { density: 600 }).resize(icon, icon).png().toBuffer();
  await sharp({ create: { width: W, height: H, channels: 3, background: '#0b0707' } })
    .composite([{ input: png, left: Math.round((W - icon) / 2), top: Math.round((H - icon) / 2 - H * 0.04) }])
    .png({ compressionLevel: 9 })
    .toFile(`public/splash/${W}x${H}.png`);
}
console.log('icons for', Object.keys(THEMES).join(', '));
