import { differenceInCalendarWeeks } from 'date-fns';
import type { ExerciseType, Workout } from '../types';
import { prCounts, setVolume } from './stats';
import { lang, t } from '../i18n';

/**
 * XP, levels, weekly streaks and achievements — all derived from workout history,
 * so imported workouts count and nothing extra has to be stored.
 */

export interface XpPart {
  /** English text with an optional {n}, translated when shown */
  n?: number;
  label: string;
  xp: number;
}

/** XP to go from `level` to `level + 1`. */
export const xpForLevel = (level: number) => 200 + 50 * level;

export function levelFromXp(xp: number) {
  let level = 1;
  let rest = xp;
  while (rest >= xpForLevel(level)) rest -= xpForLevel(level++);
  return { level, into: rest, need: xpForLevel(level) };
}

/** Total XP needed to reach `level`. */
export const xpToReach = (level: number) => {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += xpForLevel(l);
  return xp;
};

/** Level titles: [first level, name, badge colours light → dark]. */
export const LEVEL_TITLES: [number, string, [string, string]][] = [
  [1, 'Rookie', ['#d1d5db', '#4b5563']],
  [5, 'Lifter', ['#86efac', '#15803d']],
  [10, 'Grinder', ['#5eead4', '#0f766e']],
  [15, 'Iron Regular', ['#93c5fd', '#1d4ed8']],
  [20, 'Iron Warrior', ['#a5b4fc', '#4338ca']],
  [30, 'Beast', ['#d8b4fe', '#7e22ce']],
  [40, 'Mass Monster', ['#fca5a5', '#b91c1c']],
  [50, 'Golden Era', ['#fde68a', '#b45309']],
  [75, 'Legend', ['#fdba74', '#c2410c']],
  [100, 'Immortal', ['#e0f2fe', '#0891b2']],
];
/** Index into LEVEL_TITLES for a level. */
export const titleIndex = (level: number) => LEVEL_TITLES.filter(([l]) => level >= l).length - 1;
export const levelTitle = (level: number) => LEVEL_TITLES[titleIndex(level)][1];

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** unlocks when this metric of the running totals reaches `goal` */
  metric: keyof Totals;
  goal: number;
}

export interface Totals {
  workouts: number;
  volume: number;
  prs: number;
  streak: number;
  bench: number;
  squat: number;
  deadlift: number;
  big3: number;
  sessionVolume: number;
  sessionMinutes: number;
  earlyBird: number;
  nightOwl: number;
}

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Squat';
const DEADLIFTS = ['Barbell_Deadlift', 'Sumo_Deadlift'];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'w1', name: 'First Blood', desc: 'Finish your first workout', icon: '🩸', metric: 'workouts', goal: 1 },
  { id: 'w10', name: 'Regular', desc: '10 workouts', icon: '💪', metric: 'workouts', goal: 10 },
  { id: 'w25', name: 'Committed', desc: '25 workouts', icon: '🔩', metric: 'workouts', goal: 25 },
  { id: 'w50', name: 'Gym Rat', desc: '50 workouts', icon: '🐀', metric: 'workouts', goal: 50 },
  { id: 'w100', name: 'Centurion', desc: '100 workouts', icon: '🛡️', metric: 'workouts', goal: 100 },
  { id: 'w250', name: 'Iron Addict', desc: '250 workouts', icon: '⛓️', metric: 'workouts', goal: 250 },
  { id: 'w500', name: 'Living Legend', desc: '500 workouts', icon: '🏛️', metric: 'workouts', goal: 500 },
  { id: 's4', name: 'Month Strong', desc: '4-week streak', icon: '🔥', metric: 'streak', goal: 4 },
  { id: 's12', name: 'Quarter Beast', desc: '12-week streak', icon: '🐺', metric: 'streak', goal: 12 },
  { id: 's26', name: 'Half-Year Grind', desc: '26-week streak', icon: '⚙️', metric: 'streak', goal: 26 },
  { id: 's52', name: 'Year of Iron', desc: '52-week streak', icon: '👑', metric: 'streak', goal: 52 },
  { id: 'v10', name: '10 Tonnes', desc: 'Lift 10,000 kg in total', icon: '🏗️', metric: 'volume', goal: 10_000 },
  { id: 'v100', name: '100 Tonnes', desc: 'Lift 100,000 kg in total', icon: '🚛', metric: 'volume', goal: 100_000 },
  { id: 'v500', name: 'Freight Train', desc: 'Lift 500,000 kg in total', icon: '🚂', metric: 'volume', goal: 500_000 },
  { id: 'v1000', name: 'Million Kilo Club', desc: 'Lift 1,000,000 kg in total', icon: '🌋', metric: 'volume', goal: 1_000_000 },
  { id: 'sv10', name: 'Volume Monster', desc: '10,000 kg in one workout', icon: '🦍', metric: 'sessionVolume', goal: 10_000 },
  { id: 'sv20', name: 'Volume Savage', desc: '20,000 kg in one workout', icon: '🦖', metric: 'sessionVolume', goal: 20_000 },
  { id: 'pr10', name: 'Record Breaker', desc: '10 personal records', icon: '🏆', metric: 'prs', goal: 10 },
  { id: 'pr50', name: 'PR Machine', desc: '50 personal records', icon: '⚡', metric: 'prs', goal: 50 },
  { id: 'pr250', name: 'Unstoppable', desc: '250 personal records', icon: '☄️', metric: 'prs', goal: 250 },
  { id: 'b60', name: 'Plate Bencher', desc: 'Bench press 60 kg (1 plate)', icon: '🥉', metric: 'bench', goal: 60 },
  { id: 'b100', name: 'Two-Plate Bench', desc: 'Bench press 100 kg', icon: '🥈', metric: 'bench', goal: 100 },
  { id: 'b140', name: 'Three-Plate Bench', desc: 'Bench press 140 kg', icon: '🥇', metric: 'bench', goal: 140 },
  { id: 'q100', name: 'Two-Plate Squat', desc: 'Squat 100 kg', icon: '🦵', metric: 'squat', goal: 100 },
  { id: 'q140', name: 'Three-Plate Squat', desc: 'Squat 140 kg', icon: '🏋️', metric: 'squat', goal: 140 },
  { id: 'q180', name: 'Four-Plate Squat', desc: 'Squat 180 kg', icon: '🐂', metric: 'squat', goal: 180 },
  { id: 'd140', name: 'Three-Plate Pull', desc: 'Deadlift 140 kg', icon: '⛏️', metric: 'deadlift', goal: 140 },
  { id: 'd180', name: 'Four-Plate Pull', desc: 'Deadlift 180 kg', icon: '🪨', metric: 'deadlift', goal: 180 },
  { id: 'd220', name: 'Five-Plate Pull', desc: 'Deadlift 220 kg', icon: '🗿', metric: 'deadlift', goal: 220 },
  { id: 'c1000', name: '1000 lb Club', desc: 'Bench + squat + deadlift ≥ 454 kg', icon: '💎', metric: 'big3', goal: 453.6 },
  { id: 'long', name: 'Marathon Session', desc: 'Train for 2 hours straight', icon: '⏳', metric: 'sessionMinutes', goal: 120 },
  { id: 'early', name: 'Early Bird', desc: 'Start a workout before 6:00', icon: '🌅', metric: 'earlyBird', goal: 1 },
  { id: 'night', name: 'Night Owl', desc: 'Start a workout after 22:00', icon: '🦉', metric: 'nightOwl', goal: 1 },
];

export interface WorkoutReward {
  xp: number;
  parts: XpPart[];
  xpBefore: number;
  streak: number;
  number: number;
  achievements: Achievement[];
}

export interface Journey {
  xp: number;
  totals: Totals;
  /** achievement id → workout that unlocked it */
  unlocked: Map<string, { workoutId: string; date: number }>;
  byWorkout: Map<string, WorkoutReward>;
}

const week = (t: number) => differenceInCalendarWeeks(t, 0, { weekStartsOn: 1 });

export function computeJourney(workouts: Workout[], typeOf: (id: string) => ExerciseType): Journey {
  const prs = prCounts(workouts, typeOf);
  const t: Totals = { workouts: 0, volume: 0, prs: 0, streak: 0, bench: 0, squat: 0, deadlift: 0, big3: 0, sessionVolume: 0, sessionMinutes: 0, earlyBird: 0, nightOwl: 0 };
  const unlocked = new Map<string, { workoutId: string; date: number }>();
  const byWorkout = new Map<string, WorkoutReward>();
  let xp = 0;
  let lastWeek: number | null = null;

  for (const w of [...workouts].sort((a, b) => a.start - b.start)) {
    const wk = week(w.start);
    const firstThisWeek = lastWeek !== wk;
    if (lastWeek == null || wk - lastWeek > 1) t.streak = 1;
    else if (wk - lastWeek === 1) t.streak++;
    lastWeek = wk;

    let sets = 0;
    let vol = 0;
    for (const e of w.exercises) {
      const type = typeOf(e.exerciseId);
      for (const s of e.sets) {
        if (!s.done) continue;
        if (s.type !== 'warmup') sets++;
        vol += setVolume(s, type);
        const kg = s.type === 'warmup' || !(s.reps && s.reps > 0) ? 0 : (s.weight ?? 0);
        if (e.exerciseId === BENCH) t.bench = Math.max(t.bench, kg);
        if (e.exerciseId === SQUAT) t.squat = Math.max(t.squat, kg);
        if (DEADLIFTS.includes(e.exerciseId)) t.deadlift = Math.max(t.deadlift, kg);
      }
    }
    const pr = prs.get(w.id) ?? 0;
    const hour = new Date(w.start).getHours();
    t.workouts++;
    t.volume += vol;
    t.prs += pr;
    t.big3 = t.bench && t.squat && t.deadlift ? t.bench + t.squat + t.deadlift : 0;
    t.sessionVolume = Math.max(t.sessionVolume, vol);
    t.sessionMinutes = Math.max(t.sessionMinutes, (w.end - w.start) / 60e3);
    if (hour < 6) t.earlyBird = 1;
    if (hour >= 22) t.nightOwl = 1;

    const parts: XpPart[] = [{ label: 'Workout complete', xp: 100 }];
    if (sets) parts.push({ label: 'Working sets: {n}', n: sets, xp: Math.min(sets, 40) * 10 });
    if (pr) parts.push({ label: 'Personal records: {n}', n: pr, xp: pr * 25 });
    if (firstThisWeek) parts.push({ label: 'First workout this week', xp: 50 });
    if (t.streak > 1) parts.push({ label: '{n} wk streak', n: t.streak, xp: Math.min(t.streak, 10) * 10 });

    const fresh: Achievement[] = [];
    for (const a of ACHIEVEMENTS) {
      if (!unlocked.has(a.id) && t[a.metric] >= a.goal) {
        unlocked.set(a.id, { workoutId: w.id, date: w.start });
        fresh.push(a);
      }
    }
    if (fresh.length) parts.push({ label: 'Trophies: {n}', n: fresh.length, xp: fresh.length * 75 });

    const gained = parts.reduce((s, p) => s + p.xp, 0);
    byWorkout.set(w.id, { xp: gained, parts, xpBefore: xp, streak: t.streak, number: t.workouts, achievements: fresh });
    xp += gained;
  }
  // a streak is only alive if you trained this week or last week
  if (lastWeek != null && week(Date.now()) - lastWeek > 1) t.streak = 0;
  return { xp, totals: t, unlocked, byWorkout };
}

/** Fun "that's like lifting…" comparisons for a workout's volume (kg). */
const THINGS: [number, string, string][] = [
  [100, 'a baby elephant', 'baby elephants'],
  [400, 'a grand piano', 'grand pianos'],
  [700, 'a grizzly bear', 'grizzly bears'],
  [1500, 'a car', 'cars'],
  [2500, 'a rhino', 'rhinos'],
  [6000, 'an African elephant', 'African elephants'],
  [8000, 'a T-Rex', 'T-Rexes'],
  [12000, 'a school bus', 'school buses'],
  [40000, 'a loaded semi-truck', 'loaded semi-trucks'],
  [150000, 'a blue whale', 'blue whales'],
];

export function volumeComparison(kg: number): string | null {
  let pick: (typeof THINGS)[number] | null = null;
  for (const t of THINGS) if (kg >= t[0]) pick = t;
  if (!pick) return null;
  const n = kg / pick[0];
  const num = n < 10 ? n.toFixed(1) : String(Math.round(n));
  if (lang() === 'en') return n < 1.15 ? pick[1] : `${num} ${pick[2]}`;
  const noun = t(pick[1].replace(/^(a|an) /, ''));
  return n < 1.15 ? noun : `${num}× ${noun}`;
}
