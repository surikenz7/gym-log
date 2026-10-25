import type { Workout } from '../types';
import { levelFromXp, type Journey } from './progress';
import { tierIndex } from './ranks';

export type DecoKind = 'achievement' | 'rank' | 'egg' | 'code';

export interface Decoration {
  id: string;
  name: string;
  kind: DecoKind;
  /** shown once unlocked (and for non-secret ones while locked) */
  how: string;
  /** shown instead of `how` while a secret is still locked */
  hint?: string;
  /** estimated share of lifters who unlock it, in % */
  pct: number;
}

/**
 * Rarity is an estimate of how many lifters would earn each one (from typical training habits and
 * strength-standard percentiles) — the app has no server, so it can't count real players.
 */
export const DECORATIONS: Decoration[] = [
  { id: 'iron_ring', name: 'Iron Ring', kind: 'achievement', how: 'Finish your first workout', pct: 95 },
  { id: 'sweatband', name: 'Sweatband', kind: 'achievement', how: 'Finish 10 workouts', pct: 72 },
  { id: 'stars', name: 'Orbiting Stars', kind: 'achievement', how: 'Set 10 personal records', pct: 48 },
  { id: 'cap', name: 'Gym Cap', kind: 'achievement', how: 'Finish 25 workouts', pct: 52 },
  { id: 'headphones', name: 'Headphones', kind: 'achievement', how: 'Train 4 weeks in a row', pct: 40 },
  { id: 'laurel', name: 'Laurel Wreath', kind: 'achievement', how: 'Finish 50 workouts', pct: 31 },
  { id: 'plates', name: 'Plate Orbit', kind: 'achievement', how: 'Lift 100,000 kg in total', pct: 28 },
  { id: 'crown', name: 'Gold Crown', kind: 'rank', how: 'Reach an overall Gold rank', pct: 30 },
  { id: 'lightning', name: 'Lightning', kind: 'achievement', how: 'Set 50 personal records', pct: 15 },
  { id: 'viking', name: 'Viking Helmet', kind: 'achievement', how: 'Finish 100 workouts', pct: 14 },
  { id: 'flames', name: 'Ring of Fire', kind: 'achievement', how: 'Train 12 weeks in a row', pct: 12 },
  { id: 'overhead', name: 'Thousand Pound Club', kind: 'achievement', how: 'Bench + squat + deadlift ≥ 454 kg', pct: 6 },
  { id: 'diamond', name: 'Diamond Ring', kind: 'rank', how: 'Reach an overall Diamond rank', pct: 6 },
  { id: 'sunburst', name: 'Golden Era', kind: 'achievement', how: 'Reach level 50', pct: 4 },
  { id: 'gold_1m', name: 'Million Kilo Ring', kind: 'achievement', how: 'Lift 1,000,000 kg in total', pct: 2.5 },
  { id: 'belt', name: 'Champion Belt', kind: 'rank', how: 'Reach an overall Champion rank', pct: 1.5 },
  { id: 'year_ring', name: 'Year of Iron', kind: 'achievement', how: 'Train 52 weeks in a row', pct: 1 },
  { id: 'pillars', name: 'Temple of Iron', kind: 'achievement', how: 'Finish 500 workouts', pct: 0.8 },
  { id: 'aura', name: 'Titan Aura', kind: 'rank', how: 'Reach an overall Titan rank', pct: 0.4 },
  { id: 'olympus', name: 'Wings of Olympus', kind: 'rank', how: 'Reach an overall Olympian rank', pct: 0.05 },
  { id: 'halo', name: 'Halo', kind: 'egg', how: 'Start a workout before 6:00', hint: 'The early bird gets the gains', pct: 18 },
  { id: 'horns', name: 'Devil Horns', kind: 'egg', how: 'Start a workout after 22:00', hint: 'Some lift when others sleep', pct: 22 },
  { id: 'santa', name: 'Santa Hat', kind: 'egg', how: 'Train between 24 and 26 December', hint: 'Ho ho ho…', pct: 9 },
  { id: 'party', name: 'Party Hat', kind: 'egg', how: 'Train on 1 January', hint: 'New year, new PR', pct: 7 },
  { id: 'pumpkin', name: 'Spooky Pumpkin', kind: 'egg', how: 'Train on 31 October', hint: 'Spooky season', pct: 7 },
  { id: 'moon', name: 'Midnight Moon', kind: 'egg', how: 'Start a workout between 0:00 and 0:59', hint: 'When the clock strikes twelve…', pct: 3 },
  { id: 'glitch', name: 'Glitch', kind: 'egg', how: 'Tap the version number in Settings 7 times', hint: 'Some numbers like to be tapped', pct: 3 },
  { id: 'chain', name: 'Yeah Buddy Chain', kind: 'egg', how: 'Name a workout “Light weight baby”', hint: 'Yeah buddy! Name it like the 8× Mr. Olympia', pct: 2 },
  { id: 'clover', name: 'Lucky Clover', kind: 'egg', how: 'Train on 29 February', hint: 'Comes around once in four years', pct: 0.7 },
  { id: 'neon', name: 'Neon Ring', kind: 'code', how: 'Secret code', hint: 'Redeem a secret code', pct: 1 },
  { id: 'thorns', name: 'Crown of Thorns', kind: 'code', how: 'Secret code', hint: 'Redeem a secret code', pct: 0.5 },
];

export const decoById = (id: string) => DECORATIONS.find((d) => d.id === id);

export function rarityOf(pct: number) {
  if (pct >= 40) return { label: 'Common', color: '#9ca3af' };
  if (pct >= 15) return { label: 'Uncommon', color: '#22c55e' };
  if (pct >= 5) return { label: 'Rare', color: '#3b82f6' };
  if (pct >= 1) return { label: 'Epic', color: '#a855f7' };
  if (pct >= 0.1) return { label: 'Legendary', color: '#f59e0b' };
  return { label: 'Mythic', color: '#ef4444' };
}

export const fmtPct = (p: number) => (p >= 10 ? `${Math.round(p)}%` : p >= 1 ? `${p.toFixed(1).replace(/\.0$/, '')}%` : `${p}%`);

/** Decorations earned from history and ranks (secret codes / taps are stored when they happen). */
export function earnedDecorations(j: Journey, workouts: Workout[], overall: number | null): string[] {
  const has = (a: string) => j.unlocked.has(a);
  const out: string[] = [];
  const add = (id: string, ok: boolean) => ok && out.push(id);
  add('iron_ring', has('w1'));
  add('sweatband', has('w10'));
  add('cap', has('w25'));
  add('laurel', has('w50'));
  add('viking', has('w100'));
  add('pillars', has('w500'));
  add('headphones', has('s4'));
  add('flames', has('s12'));
  add('year_ring', has('s52'));
  add('stars', has('pr10'));
  add('lightning', has('pr50'));
  add('plates', has('v100'));
  add('gold_1m', has('v1000'));
  add('overhead', has('c1000'));
  add('halo', has('early'));
  add('horns', has('night'));
  add('sunburst', levelFromXp(j.xp).level >= 50);
  if (overall != null) {
    const t = tierIndex(overall);
    add('crown', t >= 3);
    add('diamond', t >= 5);
    add('belt', t >= 6);
    add('aura', t >= 7);
    add('olympus', t >= 8);
  }
  let santa = false;
  let party = false;
  let pumpkin = false;
  let moon = false;
  let clover = false;
  let chain = false;
  for (const w of workouts) {
    const d = new Date(w.start);
    const m = d.getMonth();
    const day = d.getDate();
    if (m === 11 && day >= 24 && day <= 26) santa = true;
    if (m === 0 && day === 1) party = true;
    if (m === 9 && day === 31) pumpkin = true;
    if (m === 1 && day === 29) clover = true;
    if (d.getHours() === 0) moon = true;
    if (/light\s*weight,?\s*baby|yeah\s*buddy/i.test(w.name)) chain = true;
  }
  add('santa', santa);
  add('party', party);
  add('pumpkin', pumpkin);
  add('moon', moon);
  add('clover', clover);
  add('chain', chain);
  return out;
}

/** SHA-256 of the normalised code → decoration. Codes aren't stored in plain text. */
const CODES: Record<string, string> = {
  '85bfb50daf54dab11a3884afc71182b2bd4561d66e6d1a846c0ee9d7feb458d7': 'neon',
  '4484fde3c78f929cef30748cf9cdf9600e67882ac77b666fa096219903663983': 'thorns',
};

export async function redeemCode(input: string): Promise<string | null> {
  const norm = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!norm) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return CODES[hex] ?? null;
}
