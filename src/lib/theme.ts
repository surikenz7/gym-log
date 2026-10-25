import type { ThemeId } from '../types';

/** Accent presets. `ink` is the text colour used on top of the accent. */
export const THEMES: Record<ThemeId, { name: string; hex: string; ink: string }> = {
  blood: { name: 'Blood', hex: '#e5262d', ink: '#ffffff' },
  gold: { name: 'Gold', hex: '#f2b705', ink: '#0a0a0a' },
  toxic: { name: 'Toxic', hex: '#a3e635', ink: '#0a0a0a' },
  steel: { name: 'Steel', hex: '#2f7cf6', ink: '#ffffff' },
};

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

export function applyTheme(id: ThemeId) {
  const t = THEMES[id] ?? THEMES.blood;
  const root = document.documentElement.style;
  root.setProperty('--accent', rgb(t.hex));
  root.setProperty('--ink', rgb(t.ink));
}

export const accentHex = (id: ThemeId) => (THEMES[id] ?? THEMES.blood).hex;
