import type { Exercise, LoadSetup, WSet, Workout } from '../types';
import { epley1RM } from './stats';

/**
 * Liftoff-style strength ranks.
 *
 * Every working set gets a score from 0 to 1000; an exercise's rank is its best set.
 * Scores come from public bodyweight-ratio strength standards (beginner → elite), not from
 * Liftoff's private curves. Each standard level is worth 150 points:
 *
 *   untrained 0 · beginner 150 · novice 300 · intermediate 450 · advanced 600 · elite 750 · legend 900
 *
 * where "legend" sits 0.6 of an advanced→elite step above elite.
 */

export type Sex = 'male' | 'female';
export type RankGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';
/**
 * ratio:   estimated 1RM ÷ bodyweight (dumbbells per hand), scaled to a reference bodyweight
 * bw:      (bodyweight + added weight) 1RM ÷ bodyweight, for pull-ups/dips
 * reps:    max reps in one set
 * seconds: longest hold
 */
export type RankMetric = 'ratio' | 'bw' | 'reps' | 'seconds';

interface Std {
  group: RankGroup;
  metric: RankMetric;
  /** male [beginner, novice, intermediate, advanced, elite] */
  m: number[];
  /** female levels when they don't follow the group factor */
  f?: number[];
  /** isolation lift: nobody tests a 1-rep max on these, so targets are shown for 8-15 reps */
  iso?: boolean;
}

export const GROUPS: { id: RankGroup; label: string }[] = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'legs', label: 'Legs' },
  { id: 'core', label: 'Core' },
];

/** How female standards compare to male ones per group (ratio metrics). */
const FEMALE_FACTOR: Record<RankGroup, number> = { chest: 0.55, shoulders: 0.55, arms: 0.6, back: 0.62, legs: 0.75, core: 0.7 };
/** Strength grows with ~bodyweight^(2/3), so ratios are normalised to these bodyweights. */
const REF_BW: Record<Sex, number> = { male: 80, female: 62 };

const r = (group: RankGroup, m: number[], iso = false): Std => ({ group, metric: 'ratio', m, iso });

/*
 * Male standards. Compound lifts follow published bodyweight-ratio tables (Strength Level /
 * Symmetric Strength style). Isolation and machine lifts are set from what lifters really move
 * for 8-12 reps (turned into a 1RM): an advanced lifter does about 40 kg x 10 on a rope pushdown
 * and an elite one about 35 kg x 10 on an overhead rope extension, not 100+ kg.
 */
export const STANDARDS: Record<string, Std> = {
  // Chest
  'Barbell_Bench_Press_-_Medium_Grip': r('chest', [0.74, 1.03, 1.38, 1.79, 2.24]),
  Dumbbell_Bench_Press: r('chest', [0.2, 0.32, 0.46, 0.62, 0.8]),
  'Barbell_Incline_Bench_Press_-_Medium_Grip': r('chest', [0.6, 0.85, 1.13, 1.47, 1.84]),
  Incline_Dumbbell_Press: r('chest', [0.17, 0.28, 0.4, 0.55, 0.71]),
  Decline_Barbell_Bench_Press: r('chest', [0.75, 1.05, 1.4, 1.8, 2.25]),
  Smith_Machine_Bench_Press: r('chest', [0.6, 0.88, 1.2, 1.57, 1.97]),
  Smith_Machine_Incline_Bench_Press: r('chest', [0.5, 0.75, 1.03, 1.35, 1.7]),
  Machine_Bench_Press: r('chest', [0.42, 0.66, 0.95, 1.28, 1.65]),
  Leverage_Incline_Chest_Press: r('chest', [0.38, 0.6, 0.88, 1.2, 1.55]),
  Butterfly: r('chest', [0.25, 0.43, 0.65, 0.9, 1.18], true),
  Dumbbell_Flyes: r('chest', [0.07, 0.13, 0.2, 0.28, 0.37], true),
  Cable_Crossover: r('chest', [0.06, 0.12, 0.19, 0.27, 0.36], true),
  Pushups: { group: 'chest', metric: 'reps', m: [5, 15, 30, 45, 60], f: [2, 8, 18, 28, 40] },
  'Dips_-_Chest_Version': { group: 'chest', metric: 'bw', m: [1.1, 1.3, 1.55, 1.85, 2.2], f: [1.0, 1.12, 1.28, 1.48, 1.72] },

  // Back
  Barbell_Deadlift: r('back', [1.19, 1.6, 2.08, 2.63, 3.2]),
  Sumo_Deadlift: r('back', [1.15, 1.55, 2.05, 2.6, 3.15]),
  Bent_Over_Barbell_Row: r('back', [0.56, 0.8, 1.08, 1.42, 1.78]),
  x_pendlay_row: r('back', [0.56, 0.8, 1.08, 1.42, 1.78]),
  'One-Arm_Dumbbell_Row': r('back', [0.2, 0.34, 0.5, 0.68, 0.88]),
  'T-Bar_Row_with_Handle': r('back', [0.45, 0.7, 1.0, 1.35, 1.75]),
  'Wide-Grip_Lat_Pulldown': r('back', [0.45, 0.65, 0.9, 1.18, 1.48]),
  'Close-Grip_Front_Lat_Pulldown': r('back', [0.45, 0.65, 0.9, 1.18, 1.48]),
  Seated_Cable_Rows: r('back', [0.45, 0.66, 0.92, 1.22, 1.55]),
  x_cable_row_wide: r('back', [0.42, 0.62, 0.86, 1.14, 1.45]),
  Leverage_Iso_Row: r('back', [0.4, 0.62, 0.9, 1.22, 1.58]),
  Pullups: { group: 'back', metric: 'bw', m: [1.03, 1.17, 1.4, 1.7, 2.0], f: [1.0, 1.07, 1.2, 1.38, 1.6] },
  'Chin-Up': { group: 'back', metric: 'bw', m: [1.05, 1.2, 1.43, 1.73, 2.03], f: [1.0, 1.08, 1.22, 1.4, 1.62] },
  Barbell_Shrug: r('back', [0.7, 1.05, 1.45, 1.9, 2.4], true),
  Dumbbell_Shrug: r('back', [0.25, 0.4, 0.58, 0.78, 1.0], true),

  // Shoulders
  Standing_Military_Press: r('shoulders', [0.49, 0.68, 0.9, 1.18, 1.48]),
  Seated_Barbell_Military_Press: r('shoulders', [0.5, 0.7, 0.93, 1.2, 1.5]),
  Dumbbell_Shoulder_Press: r('shoulders', [0.15, 0.25, 0.36, 0.49, 0.63]),
  Machine_Shoulder_Military_Press: r('shoulders', [0.3, 0.48, 0.7, 0.95, 1.24]),
  Arnold_Dumbbell_Press: r('shoulders', [0.13, 0.21, 0.31, 0.43, 0.56]),
  Side_Lateral_Raise: r('shoulders', [0.05, 0.09, 0.14, 0.2, 0.27], true),
  Cable_Seated_Lateral_Raise: r('shoulders', [0.03, 0.06, 0.1, 0.15, 0.2], true),
  Face_Pull: r('shoulders', [0.15, 0.26, 0.4, 0.56, 0.74], true),
  Upright_Barbell_Row: r('shoulders', [0.33, 0.5, 0.72, 0.97, 1.25]),
  Front_Dumbbell_Raise: r('shoulders', [0.06, 0.1, 0.16, 0.23, 0.3], true),
  Reverse_Flyes: r('shoulders', [0.04, 0.08, 0.13, 0.19, 0.26], true),

  // Arms
  Barbell_Curl: r('arms', [0.25, 0.4, 0.58, 0.8, 1.03], true),
  'EZ-Bar_Curl': r('arms', [0.25, 0.39, 0.57, 0.78, 1.0], true),
  Dumbbell_Bicep_Curl: r('arms', [0.1, 0.17, 0.26, 0.37, 0.48], true),
  Hammer_Curls: r('arms', [0.11, 0.19, 0.28, 0.4, 0.52], true),
  Standing_Biceps_Cable_Curl: r('arms', [0.2, 0.33, 0.49, 0.68, 0.88], true),
  Preacher_Curl: r('arms', [0.18, 0.31, 0.46, 0.64, 0.84], true),
  Concentration_Curls: r('arms', [0.08, 0.14, 0.22, 0.31, 0.41], true),
  Incline_Dumbbell_Curl: r('arms', [0.07, 0.13, 0.2, 0.28, 0.37], true),
  'Close-Grip_Barbell_Bench_Press': r('arms', [0.6, 0.85, 1.15, 1.5, 1.88]),
  'EZ-Bar_Skullcrusher': r('arms', [0.17, 0.28, 0.42, 0.59, 0.77], true),
  Triceps_Pushdown: r('arms', [0.2, 0.34, 0.51, 0.71, 0.93], true),
  'Triceps_Pushdown_-_Rope_Attachment': r('arms', [0.17, 0.29, 0.44, 0.62, 0.82], true),
  Cable_Rope_Overhead_Triceps_Extension: r('arms', [0.12, 0.21, 0.32, 0.45, 0.6], true),
  Standing_Dumbbell_Triceps_Extension: r('arms', [0.1, 0.17, 0.26, 0.37, 0.49], true),
  'Dips_-_Triceps_Version': { group: 'arms', metric: 'bw', m: [1.1, 1.3, 1.55, 1.85, 2.2], f: [1.0, 1.12, 1.28, 1.48, 1.72] },

  // Legs
  Barbell_Squat: r('legs', [0.98, 1.33, 1.75, 2.25, 2.8]),
  Front_Barbell_Squat: r('legs', [0.8, 1.1, 1.45, 1.88, 2.35]),
  Trap_Bar_Deadlift: r('legs', [1.25, 1.7, 2.2, 2.75, 3.35]),
  Leg_Press: r('legs', [1.3, 2.0, 2.85, 3.8, 4.85]),
  Hack_Squat: r('legs', [0.75, 1.2, 1.75, 2.4, 3.1]),
  Smith_Machine_Squat: r('legs', [0.8, 1.13, 1.5, 1.93, 2.4]),
  Goblet_Squat: r('legs', [0.15, 0.25, 0.37, 0.5, 0.65]),
  x_bulgarian_split_squat: r('legs', [0.08, 0.15, 0.25, 0.37, 0.5]),
  Barbell_Lunge: r('legs', [0.45, 0.68, 0.95, 1.27, 1.62]),
  Dumbbell_Lunges: r('legs', [0.12, 0.21, 0.32, 0.45, 0.6]),
  Romanian_Deadlift: r('legs', [0.8, 1.13, 1.5, 1.93, 2.4]),
  'Stiff-Legged_Dumbbell_Deadlift': r('legs', [0.2, 0.32, 0.47, 0.64, 0.83]),
  Leg_Extensions: r('legs', [0.35, 0.58, 0.85, 1.17, 1.52], true),
  Lying_Leg_Curls: r('legs', [0.25, 0.41, 0.6, 0.82, 1.06], true),
  Seated_Leg_Curl: r('legs', [0.3, 0.48, 0.7, 0.95, 1.22], true),
  Barbell_Hip_Thrust: r('legs', [0.7, 1.12, 1.62, 2.2, 2.85]),
  Barbell_Glute_Bridge: r('legs', [0.6, 0.98, 1.42, 1.95, 2.52]),
  Standing_Calf_Raises: r('legs', [0.55, 0.9, 1.32, 1.8, 2.35], true),
  Seated_Calf_Raise: r('legs', [0.3, 0.55, 0.85, 1.2, 1.58], true),
  x_wall_sit: { group: 'legs', metric: 'seconds', m: [30, 60, 100, 150, 220] },

  // Core
  Plank: { group: 'core', metric: 'seconds', m: [20, 45, 90, 150, 240] },
  x_side_plank: { group: 'core', metric: 'seconds', m: [15, 30, 60, 100, 150] },
  Crunches: { group: 'core', metric: 'reps', m: [10, 25, 45, 70, 100] },
  x_leg_raise_lying: { group: 'core', metric: 'reps', m: [8, 18, 30, 45, 65] },
  Hanging_Leg_Raise: { group: 'core', metric: 'reps', m: [3, 8, 14, 20, 28], f: [2, 6, 11, 16, 22] },
  Cable_Crunch: r('core', [0.25, 0.42, 0.62, 0.85, 1.1], true),
  Ab_Crunch_Machine: r('core', [0.25, 0.43, 0.65, 0.9, 1.18], true),
};

/**
 * Dumbbell / cable standards measured per hand (one dumbbell, one handle).
 * Every other standard is the total load on one implement (bar, rope, single dumbbell).
 */
const PER_SIDE = new Set([
  'Dumbbell_Bench_Press', 'Incline_Dumbbell_Press', 'Dumbbell_Flyes', 'Cable_Crossover', 'One-Arm_Dumbbell_Row', 'Dumbbell_Shrug',
  'Dumbbell_Shoulder_Press', 'Arnold_Dumbbell_Press', 'Side_Lateral_Raise', 'Cable_Seated_Lateral_Raise', 'Front_Dumbbell_Raise', 'Reverse_Flyes',
  'Dumbbell_Bicep_Curl', 'Hammer_Curls', 'Concentration_Curls', 'Incline_Dumbbell_Curl',
  'x_bulgarian_split_squat', 'Dumbbell_Lunges', 'Stiff-Legged_Dumbbell_Deadlift',
]);

const SPLIT_EQUIPMENT = ['Dumbbell', 'Cable'];

/** Which "how did you log it" questions apply to an exercise. */
export function loadQuestions(ex: Pick<Exercise, 'id' | 'equipment'>) {
  const split = SPLIT_EQUIPMENT.includes(ex.equipment);
  return {
    // ranked single-implement lifts (rope pushdown, goblet squat) can't be "per side"
    side: split && (STANDARDS[ex.id] ? PER_SIDE.has(ex.id) : true),
    pulley: ex.equipment === 'Cable',
  };
}

export function loadMissing(ex: Pick<Exercise, 'id' | 'equipment' | 'load'>) {
  const q = loadQuestions(ex);
  return (q.side && !ex.load?.side) || (q.pulley && !ex.load?.pulley);
}

/**
 * Multiplier from the logged weight to the weight the standard expects, or null while the
 * exercise still needs its load setup (so nobody gets a better rank from ambiguous numbers).
 */
export function loadFactor(ex: Pick<Exercise, 'id' | 'equipment' | 'load'>): number | null {
  if (!STANDARDS[ex.id] || STANDARDS[ex.id].metric !== 'ratio') return 1;
  if (loadMissing(ex)) return null;
  const q = loadQuestions(ex);
  let f = 1;
  if (q.side && ex.load?.side === 'both') f /= 2;
  if (q.pulley) f /= ex.load?.pulley ?? 1;
  return f;
}

export type { LoadSetup };

export interface Tier {
  name: string;
  min: number;
  /** light, base, dark */
  c: [string, string, string];
}

export const TIERS: Tier[] = [
  { name: 'Wood', min: 0, c: ['#c08a5a', '#8b5a2b', '#4a2c14'] },
  { name: 'Bronze', min: 200, c: ['#f0b27a', '#c87533', '#6b3510'] },
  { name: 'Silver', min: 300, c: ['#f4f6f8', '#aab3bf', '#5b6470'] },
  { name: 'Gold', min: 400, c: ['#fff1a8', '#f2b705', '#8a5a00'] },
  { name: 'Platinum', min: 500, c: ['#d5fff6', '#4fd1c5', '#1d6f6a'] },
  { name: 'Diamond', min: 600, c: ['#e0f2ff', '#60a5fa', '#1e3a8a'] },
  { name: 'Champion', min: 700, c: ['#ffb4b4', '#e11d48', '#6b0f24'] },
  { name: 'Titan', min: 800, c: ['#ecd5ff', '#a855f7', '#4c1d95'] },
  { name: 'Olympian', min: 900, c: ['#ffffff', '#ffd95e', '#c2410c'] },
];

const POINTS = [0, 150, 300, 450, 600, 750, 900];
export const LEVEL_NAMES = ['Untrained', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'Legend'];

export function tierIndex(score: number) {
  let i = 0;
  while (i + 1 < TIERS.length && score >= TIERS[i + 1].min) i++;
  return i;
}
export const tierOf = (score: number) => TIERS[tierIndex(score)];

/** 0..1 progress through the current tier (Olympian fills up to 1000). */
export function tierProgress(score: number) {
  const i = tierIndex(score);
  const lo = TIERS[i].min;
  const hi = TIERS[i + 1]?.min ?? 1000;
  return Math.max(0, Math.min(1, (score - lo) / (hi - lo)));
}

export function standardFor(exerciseId: string) {
  return STANDARDS[exerciseId];
}

/** Metric values at each scoring anchor (0, beginner … elite, legend) for this sex. */
export function anchors(std: Std, sex: Sex): number[] {
  let lv = std.m;
  if (sex === 'female') {
    if (std.f) lv = std.f;
    else if (std.metric === 'ratio') lv = std.m.map((x) => x * FEMALE_FACTOR[std.group]);
    else if (std.metric === 'reps') lv = std.m.map((x) => x * 0.65);
  }
  const zero = std.metric === 'bw' ? Math.min(0.85, lv[0] - 0.1) : 0;
  // legend: 0.6 of an advanced -> elite step above elite (world class, but humanly possible)
  return [zero, ...lv, lv[4] + 0.6 * (lv[4] - lv[3])];
}

export function scoreFor(value: number, a: number[]) {
  if (!(value > a[0])) return 0;
  for (let i = 1; i < a.length; i++) {
    if (value <= a[i]) return POINTS[i - 1] + ((value - a[i - 1]) / (a[i] - a[i - 1])) * (POINTS[i] - POINTS[i - 1]);
  }
  const n = a.length - 1;
  const slope = (POINTS[n] - POINTS[n - 1]) / (a[n] - a[n - 1]);
  return Math.min(1000, POINTS[n] + (value - a[n]) * slope);
}

export function valueForScore(score: number, a: number[]) {
  for (let i = 1; i < a.length; i++) {
    if (score <= POINTS[i]) return a[i - 1] + ((score - POINTS[i - 1]) / (POINTS[i] - POINTS[i - 1])) * (a[i] - a[i - 1]);
  }
  const n = a.length - 1;
  return a[n] + ((score - POINTS[n]) * (a[n] - a[n - 1])) / (POINTS[n] - POINTS[n - 1]);
}

const bwScale = (bw: number, sex: Sex) => Math.cbrt(bw / REF_BW[sex]);

/** The metric value one set reaches, or null if it can't be ranked. */
export function setValue(set: Pick<WSet, 'weight' | 'reps' | 'duration'>, std: Std, bw: number, sex: Sex): number | null {
  const reps = set.reps ?? 0;
  const kg = set.weight ?? 0;
  switch (std.metric) {
    case 'ratio':
      if (kg <= 0 || reps < 1 || reps > 30) return null;
      return (epley1RM(kg, reps) / bw) * bwScale(bw, sex);
    case 'bw':
      if (reps < 1 || reps > 30) return null;
      return epley1RM(bw + Math.max(0, kg), reps) / bw;
    case 'reps':
      return reps > 0 ? reps : null;
    case 'seconds':
      return set.duration ? set.duration : null;
  }
}

/** Logged weight (kg) needed to reach `score` with `reps` reps. Null for rep/time standards. */
export function weightForScore(exerciseId: string, score: number, reps: number, bw: number, sex: Sex, factor = 1): number | null {
  const std = STANDARDS[exerciseId];
  if (!std) return null;
  const v = valueForScore(score, anchors(std, sex));
  const f = reps === 1 ? 1 : 1 + reps / 30;
  if (std.metric === 'ratio') return (v * bw) / bwScale(bw, sex) / f / factor;
  if (std.metric === 'bw') return (v * bw) / f - bw;
  return null;
}

/** Reps or seconds needed for a rep/time standard. */
export function targetForScore(exerciseId: string, score: number, sex: Sex) {
  const std = STANDARDS[exerciseId];
  return std ? valueForScore(score, anchors(std, sex)) : 0;
}

export interface RankCtx {
  sex: Sex;
  /** bodyweight in kg at a moment in time */
  bwAt: (t: number) => number;
  /** logged → standard weight multiplier per exercise; null = not set up yet (unranked) */
  factor?: (exerciseId: string) => number | null;
}

export function setScore(exerciseId: string, set: WSet, bw: number, sex: Sex, factor: number | null = 1) {
  const std = STANDARDS[exerciseId];
  if (!std || set.type === 'warmup' || factor == null) return 0;
  const v = setValue(factor === 1 ? set : { ...set, weight: (set.weight ?? 0) * factor }, std, bw, sex);
  return v == null ? 0 : Math.round(scoreFor(v, anchors(std, sex)));
}

export interface ExerciseRank {
  exerciseId: string;
  score: number;
  workoutId: string;
  setId: string;
  date: number;
}

/** Best-set rank for every ranked exercise in `workouts`. */
export function exerciseRanks(workouts: Workout[], ctx: RankCtx): Map<string, ExerciseRank> {
  const out = new Map<string, ExerciseRank>();
  for (const w of workouts) {
    const bw = ctx.bwAt(w.start);
    for (const e of w.exercises) {
      if (!STANDARDS[e.exerciseId]) continue;
      const factor = ctx.factor ? ctx.factor(e.exerciseId) : 1;
      if (factor == null) continue;
      for (const s of e.sets) {
        if (!s.done) continue;
        const score = setScore(e.exerciseId, s, bw, ctx.sex, factor);
        const cur = out.get(e.exerciseId);
        if (score > 0 && (!cur || score > cur.score)) out.set(e.exerciseId, { exerciseId: e.exerciseId, score, workoutId: w.id, setId: s.id, date: w.start });
      }
    }
  }
  return out;
}

export interface GroupRank {
  group: RankGroup;
  score: number;
  exerciseId?: string;
}

/** A muscle group's rank is its best-ranked exercise. */
export function groupRanks(ranks: Map<string, ExerciseRank>): GroupRank[] {
  return GROUPS.map(({ id }) => {
    let best: GroupRank = { group: id, score: 0 };
    for (const r of ranks.values()) if (STANDARDS[r.exerciseId].group === id && r.score > best.score) best = { group: id, score: r.score, exerciseId: r.exerciseId };
    return best;
  });
}

/** Overall rank: average of the muscle groups that are ranked (needs at least 3). */
export function overallScore(groups: GroupRank[]): number | null {
  const ranked = groups.filter((g) => g.score > 0);
  if (ranked.length < 3) return null;
  return Math.round(ranked.reduce((s, g) => s + g.score, 0) / ranked.length);
}

/** Builds a bodyweight-at-time lookup from measurement entries (kg), falling back to the latest. */
export function bodyweightTimeline(entries: { date: number; weight?: number | null }[]): ((t: number) => number) | null {
  const pts = entries.filter((m) => m.weight && m.weight > 0).sort((a, b) => a.date - b.date) as { date: number; weight: number }[];
  if (!pts.length) return null;
  return (t) => {
    let w = pts[0].weight;
    for (const p of pts) {
      if (p.date > t) break;
      w = p.weight;
    }
    return w;
  };
}
