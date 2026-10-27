import type { CSSProperties } from 'react';

/*
 * Chat themes (like Instagram's), drawn as tiled SVG patterns so they stay sharp, tiny and free to use.
 * The theme is stored on the chat, so both people see the same one.
 */

const svg = (w: number, h: number, body: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

const dumbbell = (x: number, y: number, r: number, c: string, o: number, s = 1) =>
  `<g transform='translate(${x} ${y}) rotate(${r}) scale(${s})' fill='${c}' opacity='${o}'><rect x='-14' y='-1.6' width='28' height='3.2' rx='1.6'/><rect x='-13' y='-7' width='4' height='14' rx='1.5'/><rect x='-9' y='-5' width='3' height='10' rx='1.2'/><rect x='9' y='-7' width='4' height='14' rx='1.5'/><rect x='6' y='-5' width='3' height='10' rx='1.2'/></g>`;
const plate = (x: number, y: number, r: number, c: string, o: number) =>
  `<g opacity='${o}'><circle cx='${x}' cy='${y}' r='${r}' fill='none' stroke='${c}' stroke-width='${r * 0.28}'/><circle cx='${x}' cy='${y}' r='${r * 0.18}' fill='${c}'/></g>`;
const kettlebell = (x: number, y: number, s: number, c: string, o: number) =>
  `<g transform='translate(${x} ${y}) scale(${s})' fill='${c}' opacity='${o}'><path d='M-6 -10 a6 6 0 0 1 12 0 v2 h-3 v-2 a3 3 0 0 0 -6 0 v2 h-3z'/><circle cx='0' cy='4' r='9'/></g>`;

export interface ChatTheme {
  id: string;
  name: string;
  bg: CSSProperties;
  /** your bubbles */
  mine: CSSProperties;
  /** their bubbles */
  theirs: CSSProperties;
  /** small preview swatch */
  swatch: string;
}

export const CHAT_THEMES: ChatTheme[] = [
  {
    id: 'default',
    name: 'Classic',
    bg: {},
    mine: {},
    theirs: {},
    swatch: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent2)))',
  },
  {
    id: 'iron',
    name: 'Iron Plates',
    bg: {
      backgroundColor: '#15171a',
      backgroundImage: `${svg(120, 120, plate(30, 30, 18, '#9aa3ad', 0.12) + plate(90, 85, 12, '#9aa3ad', 0.09) + dumbbell(85, 25, -30, '#c9ced4', 0.08))}, radial-gradient(120% 80% at 50% 0%, #2a2e34, #0c0d0f)`,
    },
    mine: { background: 'linear-gradient(135deg, #e5e7eb, #9ca3af)', color: '#111' },
    theirs: { background: '#2a2e34', color: '#fff' },
    swatch: 'radial-gradient(circle at 30% 30%, #4b5563, #111827)',
  },
  {
    id: 'blood',
    name: 'Bloodsport',
    bg: {
      backgroundColor: '#140406',
      backgroundImage: `${svg(140, 140, dumbbell(35, 35, -35, '#ff4d4d', 0.13) + dumbbell(105, 105, -35, '#ff4d4d', 0.1) + dumbbell(105, 35, 35, '#ff4d4d', 0.06, 0.8))}, radial-gradient(100% 70% at 50% 100%, #5b0b12, #0d0203)`,
    },
    mine: { background: 'linear-gradient(135deg, #ef4444, #991b1b)', color: '#fff' },
    theirs: { background: '#2b0d10', color: '#fecaca' },
    swatch: 'linear-gradient(135deg, #ef4444, #450a0a)',
  },
  {
    id: 'neon',
    name: 'Neon Pump',
    bg: {
      backgroundColor: '#0b0618',
      backgroundImage: `${svg(80, 80, `<path d='M0 40 H80 M40 0 V80' stroke='#a855f7' stroke-opacity='.18' stroke-width='1'/>` + dumbbell(40, 40, 45, '#22d3ee', 0.14, 0.9))}, radial-gradient(90% 60% at 50% 0%, #3b0764, #0b0618 70%)`,
    },
    mine: { background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', color: '#fff', boxShadow: '0 0 14px rgb(236 72 153 / .45)' },
    theirs: { background: '#1e1036', color: '#a5f3fc', boxShadow: 'inset 0 0 0 1px rgb(34 211 238 / .35)' },
    swatch: 'linear-gradient(135deg, #ec4899, #22d3ee)',
  },
  {
    id: 'olympia',
    name: 'Olympia Gold',
    bg: {
      backgroundColor: '#0b0905',
      backgroundImage: `${svg(130, 130, dumbbell(30, 30, -20, '#f2b705', 0.14) + kettlebell(95, 95, 1.2, '#f2b705', 0.1) + plate(100, 30, 9, '#f2b705', 0.08))}, radial-gradient(100% 70% at 50% 0%, #3a2c06, #050402)`,
    },
    mine: { background: 'linear-gradient(135deg, #fde68a, #d97706)', color: '#1a1200' },
    theirs: { background: '#221a07', color: '#fde68a' },
    swatch: 'linear-gradient(135deg, #fde68a, #92400e)',
  },
  {
    id: 'chalk',
    name: 'Chalk & Iron',
    bg: {
      backgroundColor: '#1f2326',
      backgroundImage: `${svg(160, 160, `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .08 0'/></filter><rect width='160' height='160' filter='url(#n)'/>` + `<ellipse cx='50' cy='60' rx='30' ry='10' fill='#fff' opacity='.05' transform='rotate(-20 50 60)'/>` + dumbbell(115, 120, 15, '#fff', 0.07))}, linear-gradient(#262b2f, #15181a)`,
    },
    mine: { background: '#f5f5f4', color: '#18181b' },
    theirs: { background: '#33393e', color: '#f5f5f4' },
    swatch: 'linear-gradient(135deg, #f5f5f4, #3f474e)',
  },
  {
    id: 'arctic',
    name: 'Arctic Cut',
    bg: {
      backgroundColor: '#061a26',
      backgroundImage: `${svg(110, 110, dumbbell(28, 28, 60, '#bae6fd', 0.14) + kettlebell(82, 78, 1, '#e0f2fe', 0.09))}, linear-gradient(160deg, #0c4a6e, #020617)`,
    },
    mine: { background: 'linear-gradient(135deg, #7dd3fc, #2563eb)', color: '#fff' },
    theirs: { background: '#0f2a3d', color: '#e0f2fe' },
    swatch: 'linear-gradient(135deg, #7dd3fc, #1e3a8a)',
  },
  {
    id: 'jungle',
    name: 'Beast Mode',
    bg: {
      backgroundColor: '#07120a',
      backgroundImage: `${svg(120, 120, `<path d='M20 10 q8 30 0 60 M32 6 q8 34 0 66 M44 12 q8 28 0 56' stroke='#4ade80' stroke-opacity='.13' stroke-width='4' fill='none' stroke-linecap='round'/>` + kettlebell(90, 90, 1.1, '#86efac', 0.1))}, radial-gradient(100% 70% at 50% 0%, #14532d, #030805)`,
    },
    mine: { background: 'linear-gradient(135deg, #a3e635, #15803d)', color: '#052e16' },
    theirs: { background: '#0f2416', color: '#bbf7d0' },
    swatch: 'linear-gradient(135deg, #a3e635, #14532d)',
  },
  {
    id: 'sunset',
    name: 'Summer Shred',
    bg: {
      backgroundColor: '#1a0b14',
      backgroundImage: `${svg(130, 130, dumbbell(35, 95, -15, '#fdba74', 0.13) + plate(95, 35, 14, '#fb7185', 0.1))}, linear-gradient(180deg, #4c1d3b, #1a0b14 60%)`,
    },
    mine: { background: 'linear-gradient(135deg, #fb923c, #e11d48)', color: '#fff' },
    theirs: { background: '#3a1630', color: '#ffe4e6' },
    swatch: 'linear-gradient(135deg, #fb923c, #be185d)',
  },
];

export const chatThemeOf = (id?: string | null) => CHAT_THEMES.find((t) => t.id === id) ?? CHAT_THEMES[0];

/** Background for a custom photo theme (darkened so bubbles stay readable). */
export const photoBg = (src: string): CSSProperties => ({
  backgroundImage: `linear-gradient(rgb(0 0 0 / .45), rgb(0 0 0 / .55)), url(${src})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
});
