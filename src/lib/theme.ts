import type { ThemeId } from '../types';

export interface Theme {
  name: string;
  /** main accent and the text colour used on top of it */
  accent: string;
  ink: string;
  /** second colour for gradients, glows and highlights */
  accent2: string;
  /** ticked-off sets */
  done: string;
  /** surfaces, each tinted towards the theme */
  bg: string;
  card: string;
  card2: string;
  line: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  blood: { name: 'Blood', accent: '#e5262d', ink: '#ffffff', accent2: '#ff7a1a', done: '#22c55e', bg: '#0b0707', card: '#181010', card2: '#241717', line: '#3a2424' },
  inferno: { name: 'Inferno', accent: '#ff6a00', ink: '#120800', accent2: '#ffd000', done: '#84cc16', bg: '#0b0805', card: '#19120b', card2: '#251a10', line: '#3d2b19' },
  gold: { name: 'Gold', accent: '#f2b705', ink: '#0a0a0a', accent2: '#fff1a8', done: '#a3e635', bg: '#0a0906', card: '#17140c', card2: '#221e12', line: '#3a321c' },
  toxic: { name: 'Toxic', accent: '#a3e635', ink: '#0a0a0a', accent2: '#22d3ee', done: '#4ade80', bg: '#070a06', card: '#11170f', card2: '#1a2217', line: '#2a3826' },
  steel: { name: 'Steel', accent: '#aeb8c2', ink: '#0b0c0d', accent2: '#f1f5f9', done: '#5eead4', bg: '#08090a', card: '#141618', card2: '#1d2023', line: '#30353a' },
  cobalt: { name: 'Cobalt', accent: '#2f7cf6', ink: '#ffffff', accent2: '#22d3ee', done: '#22c55e', bg: '#06080d', card: '#10151d', card2: '#18202d', line: '#243149' },
  venom: { name: 'Venom', accent: '#a855f7', ink: '#ffffff', accent2: '#ec4899', done: '#34d399', bg: '#09060d', card: '#150f1d', card2: '#1f172a', line: '#33254a' },
  pump: { name: 'Pump', accent: '#ff2e7e', ink: '#ffffff', accent2: '#ffb020', done: '#22c55e', bg: '#0b0609', card: '#190f14', card2: '#25161e', line: '#3e2331' },
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

/** Opaque mix of two colours (used for ticked set rows so swipe-to-delete never bleeds through). */
function mix(a: string, b: string, t: number) {
  const pa = rgb(a).split(' ').map(Number);
  const pb = rgb(b).split(' ').map(Number);
  return pa.map((x, i) => Math.round(x * (1 - t) + pb[i] * t)).join(' ');
}

export const themeOf = (id: ThemeId) => THEMES[id] ?? THEMES.blood;

export function applyTheme(id: ThemeId) {
  const t = themeOf(id);
  const root = document.documentElement.style;
  root.setProperty('--accent', rgb(t.accent));
  root.setProperty('--accent2', rgb(t.accent2));
  root.setProperty('--ink', rgb(t.ink));
  root.setProperty('--done', rgb(t.done));
  root.setProperty('--done-soft', mix(t.card, t.done, 0.2));
  root.setProperty('--bg', rgb(t.bg));
  root.setProperty('--card', rgb(t.card));
  root.setProperty('--card2', rgb(t.card2));
  root.setProperty('--line', rgb(t.line));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  // iOS reads this when the app is added to the Home Screen, so the icon matches the chosen colour
  const base = import.meta.env.BASE_URL;
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', `${base}icons/${id}-180.png`);
  const fav = document.querySelector('link[rel="icon"]');
  fav?.setAttribute('href', `${base}icons/${id}-192.png`);
  fav?.setAttribute('type', 'image/png');
}

/** Link that opens the app in Safari with a theme pre-selected, so "Add to Home Screen" picks up that icon. */
export const themeLink = (id: ThemeId) => `${location.origin}${import.meta.env.BASE_URL}?theme=${id}`;

export const accentHex = (id: ThemeId) => themeOf(id).accent;
