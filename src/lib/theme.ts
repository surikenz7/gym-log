import type { ModeId, StyleId, ThemeId } from '../types';

export interface Theme {
  name: string;
  /** main accent and the text colour used on top of it */
  accent: string;
  ink: string;
  /** second colour for gradients, glows and highlights */
  accent2: string;
  /** ticked-off sets */
  done: string;
  /** dark surfaces, each tinted towards the theme */
  bg: string;
  card: string;
  card2: string;
  line: string;
  /** darker accent (and its ink) for light mode, when the normal one is too pale on white */
  light?: [string, string];
}

export const THEMES: Record<ThemeId, Theme> = {
  blood: { name: 'Blood', accent: '#e5262d', ink: '#ffffff', accent2: '#ff7a1a', done: '#22c55e', bg: '#0b0707', card: '#181010', card2: '#241717', line: '#3a2424' },
  inferno: { name: 'Inferno', accent: '#ff6a00', ink: '#120800', accent2: '#ffd000', done: '#84cc16', bg: '#0b0805', card: '#19120b', card2: '#251a10', line: '#3d2b19', light: ['#ea580c', '#ffffff'] },
  gold: { name: 'Gold', accent: '#f2b705', ink: '#0a0a0a', accent2: '#fff1a8', done: '#a3e635', bg: '#0a0906', card: '#17140c', card2: '#221e12', line: '#3a321c', light: ['#c99400', '#ffffff'] },
  toxic: { name: 'Toxic', accent: '#a3e635', ink: '#0a0a0a', accent2: '#22d3ee', done: '#4ade80', bg: '#070a06', card: '#11170f', card2: '#1a2217', line: '#2a3826', light: ['#5b9b0c', '#ffffff'] },
  steel: { name: 'Steel', accent: '#aeb8c2', ink: '#0b0c0d', accent2: '#f1f5f9', done: '#5eead4', bg: '#08090a', card: '#141618', card2: '#1d2023', line: '#30353a', light: ['#56616c', '#ffffff'] },
  cobalt: { name: 'Cobalt', accent: '#2f7cf6', ink: '#ffffff', accent2: '#22d3ee', done: '#22c55e', bg: '#06080d', card: '#10151d', card2: '#18202d', line: '#243149' },
  venom: { name: 'Venom', accent: '#a855f7', ink: '#ffffff', accent2: '#ec4899', done: '#34d399', bg: '#09060d', card: '#150f1d', card2: '#1f172a', line: '#33254a' },
  pump: { name: 'Pump', accent: '#ff2e7e', ink: '#ffffff', accent2: '#ffb020', done: '#22c55e', bg: '#0b0609', card: '#190f14', card2: '#25161e', line: '#3e2331' },
  ocean: { name: 'Ocean', accent: '#0ea5e9', ink: '#ffffff', accent2: '#2dd4bf', done: '#34d399', bg: '#050a0e', card: '#0d171e', card2: '#14222c', line: '#1f3646', light: ['#0284c7', '#ffffff'] },
  mint: { name: 'Mint', accent: '#10b981', ink: '#04130d', accent2: '#a7f3d0', done: '#a3e635', bg: '#050b08', card: '#0e1813', card2: '#15231c', line: '#21382d', light: ['#059669', '#ffffff'] },
  royal: { name: 'Royal', accent: '#6366f1', ink: '#ffffff', accent2: '#c084fc', done: '#22c55e', bg: '#07070d', card: '#11111d', card2: '#191a2b', line: '#2a2b47' },
  sunset: { name: 'Sunset', accent: '#fb7185', ink: '#1a0508', accent2: '#fdba74', done: '#4ade80', bg: '#0c0708', card: '#1a1013', card2: '#26181c', line: '#40262d', light: ['#e11d48', '#ffffff'] },
  forest: { name: 'Forest', accent: '#16a34a', ink: '#ffffff', accent2: '#bef264', done: '#facc15', bg: '#060906', card: '#0f160f', card2: '#172117', line: '#243624' },
  ice: { name: 'Ice', accent: '#7dd3fc', ink: '#04121a', accent2: '#e0f2fe', done: '#5eead4', bg: '#06090c', card: '#0f161c', card2: '#172129', line: '#253441', light: ['#0369a1', '#ffffff'] },
  mono: { name: 'Mono', accent: '#f4f4f5', ink: '#0a0a0a', accent2: '#a1a1aa', done: '#d4d4d8', bg: '#080808', card: '#141414', card2: '#1e1e1e', line: '#2e2e2e', light: ['#18181b', '#ffffff'] },
  coffee: { name: 'Coffee', accent: '#c08457', ink: '#140b05', accent2: '#f5deb3', done: '#a3e635', bg: '#0b0806', card: '#18120d', card2: '#241b14', line: '#3a2c20', light: ['#92400e', '#ffffff'] },
};

export const STYLES: Record<StyleId, { name: string; desc: string }> = {
  raw: { name: 'Raw', desc: 'Condensed caps, cut steel corners, grain' },
  elegant: { name: 'Elegant', desc: 'Serif headings, soft glow, fine lines' },
  minimal: { name: 'Minimal', desc: 'Clean system type, flat colour, no frills' },
  playful: { name: 'Playful', desc: 'Rounded type, bubbly shapes, bright' },
  cyber: { name: 'Cyber', desc: 'Neon edges, italic heavy type, grid' },
  frost: { name: 'Frost', desc: 'Frosted glass cards over soft colour' },
  tactical: { name: 'Tactical', desc: 'Stencil type, corner brackets, hazard' },
  brutal: { name: 'Brutalist', desc: 'Poster type, thick lines, hard shadows' },
  terminal: { name: 'Terminal', desc: 'Monospace, thin outlines, scanlines' },
};

export const MODES: Record<ModeId, { name: string }> = {
  dark: { name: 'Dark' },
  amoled: { name: 'Black' },
  dim: { name: 'Dim' },
  light: { name: 'Light' },
};

const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (n: number[]) => `#${n.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
const rgb = (hex: string) => parse(hex).join(' ');
/** Mix of two colours, `t` = share of `b`. */
export function mix(a: string, b: string, t: number) {
  const pa = parse(a);
  const pb = parse(b);
  return toHex(pa.map((x, i) => x * (1 - t) + pb[i] * t));
}

export const themeOf = (id: ThemeId) => THEMES[id] ?? THEMES.blood;

export interface Palette {
  accent: string;
  ink: string;
  accent2: string;
  done: string;
  doneSoft: string;
  bg: string;
  card: string;
  card2: string;
  line: string;
  fg: string;
  muted: string;
  light: boolean;
}

/** Resolved colours for a colour theme in a light/dark mode. */
export function paletteOf(id: ThemeId, mode: ModeId): Palette {
  const t = themeOf(id);
  const base = { accent: t.accent, ink: t.ink, accent2: t.accent2, done: t.done, fg: '#ffffff', muted: '#8e8e8e', light: false };
  let s = { bg: t.bg, card: t.card, card2: t.card2, line: t.line };
  if (mode === 'amoled') s = { bg: '#000000', card: mix(t.card, '#000000', 0.4), card2: t.card, line: t.card2 };
  if (mode === 'dim') s = { bg: mix(t.bg, '#1d2026', 0.85), card: mix(t.card, '#272a31', 0.8), card2: mix(t.card2, '#31353d', 0.8), line: mix(t.line, '#40454e', 0.75) };
  if (mode === 'light') {
    const [accent, ink] = t.light ?? [t.accent, t.ink];
    const p = {
      ...base,
      accent,
      ink,
      fg: '#141417',
      muted: '#6b6b74',
      light: true,
      bg: mix('#f2f2f4', t.accent, 0.035),
      card: '#ffffff',
      card2: mix('#ececef', t.accent, 0.05),
      line: '#dadade',
      done: mix(t.done, '#000000', 0.15),
    };
    return { ...p, doneSoft: mix('#ffffff', p.done, 0.2) };
  }
  return { ...base, ...s, doneSoft: mix(s.card, t.done, 0.2) };
}

export interface LookExtras {
  textSize?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  grain?: 'auto' | 'on' | 'off';
}

const TEXT_SIZE = { sm: '15px', md: '16px', lg: '17.5px' };

export function applyLook(id: ThemeId, style: StyleId, mode: ModeId, extras: LookExtras = {}) {
  const p = paletteOf(id, mode);
  const el = document.documentElement;
  el.style.fontSize = TEXT_SIZE[extras.textSize ?? 'md'];
  el.dataset.glow = extras.glow === false ? 'off' : 'on';
  el.dataset.grain = extras.grain ?? 'auto';
  const root = el.style;
  root.setProperty('--accent', rgb(p.accent));
  root.setProperty('--accent2', rgb(p.accent2));
  root.setProperty('--ink', rgb(p.ink));
  root.setProperty('--done', rgb(p.done));
  root.setProperty('--done-soft', rgb(p.doneSoft));
  root.setProperty('--bg', rgb(p.bg));
  root.setProperty('--card', rgb(p.card));
  root.setProperty('--card2', rgb(p.card2));
  root.setProperty('--line', rgb(p.line));
  root.setProperty('--fg', rgb(p.fg));
  root.setProperty('--muted', rgb(p.muted));
  el.dataset.style = style;
  el.dataset.mode = mode;
  el.style.colorScheme = p.light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg);
  // index.html reads this before the app starts, to pick the status-bar style (iOS reads it at launch)
  try {
    localStorage.setItem('gymlog-look', JSON.stringify({ light: p.light, bg: p.bg, accent: p.accent, accent2: p.accent2, theme: id }));
  } catch {
    /* private mode */
  }
  // the icon iOS uses when the app is added to the Home Screen
  const base = import.meta.env.BASE_URL;
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', `${base}icons/${id}-180.png`);
  const fav = document.querySelector('link[rel="icon"]');
  fav?.setAttribute('href', `${base}icons/${id}-192.png`);
  fav?.setAttribute('type', 'image/png');
}

/** Link that opens the app in Safari with a theme pre-selected, so "Add to Home Screen" picks up that icon. */
export const themeLink = (id: ThemeId) => `${location.origin}${import.meta.env.BASE_URL}?theme=${id}`;

export const accentHex = (id: ThemeId) => themeOf(id).accent;
