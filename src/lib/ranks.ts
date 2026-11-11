import type { Exercise, LoadSetup, WSet, Workout } from '../types';
import { epley1RM } from './stats';

/**
 * Liftoff-style strength ranks.
 *
 * Every working set gets a score from 0 to 1000 from its estimated 1RM, your current bodyweight
 * and sex, like Liftoff; an exercise's rank is its best set. Liftoff's curves are private, so the
 * standards are public crowd-sourced ones (see STANDARDS). Each level is worth 150 points:
 *
 *   untrained 0 · beginner 150 · novice 300 · intermediate 450 · advanced 600 · elite 750 · Olympian 900
 *
 * where Olympian sits LEGEND_STEP of an advanced→elite step above elite.
 */

export type Sex = 'male' | 'female';
export type RankGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';
/**
 * kg:      estimated 1RM in kg (dumbbells per hand), compared with tables for your bodyweight
 * bw:      (bodyweight + added weight) 1RM ÷ bodyweight, for pull-ups/dips
 * reps:    max reps in one set
 * seconds: longest hold
 */
export type RankMetric = 'kg' | 'bw' | 'reps' | 'seconds';

interface Std {
  group: RankGroup;
  metric: RankMetric;
  /** kg: 1RM tables [beginner … elite] for men at 60 / 80 / 100 kg and women at 60 kg bodyweight */
  kg?: [number[], number[], number[], number[]];
  /** other metrics: male [beginner, novice, intermediate, advanced, elite] */
  m?: number[];
  /** female levels (rep standards default to 65 % of the male ones) */
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

/** Bodyweight used when none is given (rep and time standards don't depend on it). */
const REF_BW: Record<Sex, number> = { male: 80, female: 62 };

/** Olympian sits this many advanced -> elite steps above elite. */
const LEGEND_STEP = 0.8;

const L = (s: string) => s.split('/').map(Number);
/**
 * A weight standard: estimated 1RM in kg for [beginner, novice, intermediate, advanced, elite]
 * for men at 60 / 80 / 100 kg and women at 60 kg bodyweight. `x` scales a table borrowed from a
 * close variation.
 */
const w = (group: RankGroup, m60: string, m80: string, m100: string, f60: string, iso = false, x = 1): Std => ({
  group,
  metric: 'kg',
  iso,
  kg: [m60, m80, m100, f60].map((s) => L(s).map((v) => v * x)) as Std['kg'],
});

/*
 * Weight standards are Strength Level's bodyweight tables (lifts logged by millions of gym-goers,
 * the same kind of tracking crowd Liftoff ranks against; Liftoff's own published medians, such as
 * a 45 kg pushdown or a 79 kg lat pulldown for men, land in the same place). Their levels mean
 * stronger than about 5 / 20 / 50 / 80 / 95 % of lifters.
 */
type Table = [string, string, string, string];
const SMITH_BENCH: Table = ['36/52/72/94/119', '53/72/95/120/148', '68/89/115/143/173', '16/28/43/62/83'];
const CHEST_PRESS: Table = ['27/45/70/100/134', '39/61/89/123/160', '50/74/105/142/181', '11/21/36/54/75'];
const CABLE_ROW: Table = ['33/49/68/90/115', '47/65/87/112/140', '59/79/104/131/160', '21/32/45/62/79'];
const LATERAL: Table = ['3/7/13/20/29', '5/10/16/25/34', '7/12/19/28/39', '3/6/9/13/17'];
const HIP_THRUST: Table = ['32/63/107/163/227', '56/96/149/213/285', '80/126/186/257/335', '35/63/100/147/199'];
const CABLE_CRUNCH: Table = ['19/34/56/83/113', '26/44/68/97/130', '32/51/77/108/143', '15/29/47/70/95'];

export const STANDARDS: Record<string, Std> = {
  // Chest
  'Barbell_Bench_Press_-_Medium_Grip': w('chest', '37/53/72/95/119', '56/75/98/124/151', '73/95/120/149/179', '19/31/47/66/88'),
  Dumbbell_Bench_Press: w('chest', '13/20/30/42/55', '19/28/40/53/68', '25/36/48/63/79', '7/12/19/28/38'),
  'Barbell_Incline_Bench_Press_-_Medium_Grip': w('chest', '32/45/62/82/103', '50/66/87/109/134', '66/86/108/134/160', '14/25/39/56/76'),
  Incline_Dumbbell_Press: w('chest', '14/21/29/39/49', '22/29/39/50/62', '28/37/48/60/73', '7/12/19/26/35'),
  Decline_Barbell_Bench_Press: w('chest', '36/53/75/99/127', '58/79/104/133/164', '77/101/130/162/197', '19/32/50/71/95'),
  Smith_Machine_Bench_Press: w('chest', ...SMITH_BENCH),
  Smith_Machine_Incline_Bench_Press: w('chest', ...SMITH_BENCH, false, 0.88),
  Machine_Bench_Press: w('chest', ...CHEST_PRESS),
  Leverage_Incline_Chest_Press: w('chest', ...CHEST_PRESS, false, 0.9),
  Butterfly: w('chest', '29/46/68/95/124', '42/63/89/119/152', '55/78/107/140/175', '13/23/37/54/74', true),
  Dumbbell_Flyes: w('chest', '5/10/18/28/39', '8/15/24/35/47', '11/19/29/41/54', '4/7/11/17/23', true),
  // Strength Level logs both handles together; ranked per handle here
  Cable_Crossover: w('chest', '4/12/26/46/69', '8/19/36/58/84', '13/26/45/69/98', '3/9/19/29/43', true, 0.5),
  Pushups: { group: 'chest', metric: 'reps', m: [5, 15, 30, 45, 60], f: [2, 8, 18, 28, 40] },
  // (bodyweight + added weight) ÷ bodyweight, from Liftoff's weighted-dip standards
  'Dips_-_Chest_Version': { group: 'chest', metric: 'bw', m: [0.95, 1.22, 1.6, 2.0, 2.45], f: [0.75, 0.97, 1.3, 1.68, 2.1] },

  // Back
  Barbell_Deadlift: w('back', '61/86/117/153/191', '89/119/155/196/239', '114/148/188/232/279', '40/60/86/116/149'),
  Sumo_Deadlift: w('back', '72/100/134/174/216', '102/135/174/218/265', '128/165/208/256/307', '47/68/93/122/154'),
  Bent_Over_Barbell_Row: w('back', '31/46/65/87/111', '48/66/88/114/141', '63/84/108/136/166', '18/29/43/59/78'),
  x_pendlay_row: w('back', '36/50/67/87/109', '53/70/91/114/138', '69/88/111/137/164', '25/36/49/65/82'),
  'One-Arm_Dumbbell_Row': w('back', '12/21/32/46/61', '19/30/43/59/76', '26/38/53/70/89', '9/14/21/29/38'),
  'T-Bar_Row_with_Handle': w('back', '24/39/60/85/114', '38/58/82/111/143', '52/74/102/134/169', '15/26/42/62/84'),
  'Wide-Grip_Lat_Pulldown': w('back', '35/50/69/90/113', '47/64/85/108/133', '57/76/98/123/150', '23/33/46/60/76'),
  'Close-Grip_Front_Lat_Pulldown': w('back', '41/57/75/96/119', '54/71/92/115/139', '65/84/106/131/157', '27/37/51/66/82'),
  Seated_Cable_Rows: w('back', ...CABLE_ROW),
  x_cable_row_wide: w('back', ...CABLE_ROW, false, 0.95),
  Leverage_Iso_Row: w('back', '31/52/80/113/151', '47/72/104/142/184', '62/90/125/167/211', '21/34/51/72/96'),
  // from Liftoff's weighted pull-up standards
  Pullups: { group: 'back', metric: 'bw', m: [1.0, 1.12, 1.4, 1.75, 2.1], f: [0.66, 0.88, 1.15, 1.45, 1.78] },
  'Chin-Up': { group: 'back', metric: 'bw', m: [1.02, 1.15, 1.43, 1.78, 2.13], f: [0.68, 0.9, 1.17, 1.47, 1.8] },
  Barbell_Shrug: w('back', '30/55/89/130/178', '53/85/126/175/230', '76/113/159/214/274', '17/35/61/95/134', true),
  Dumbbell_Shrug: w('back', '10/20/33/50/69', '17/28/44/63/84', '23/36/54/74/97', '6/14/24/37/52', true),

  // Shoulders
  Standing_Military_Press: w('shoulders', '23/33/46/61/77', '35/47/63/80/98', '46/61/78/97/117', '15/22/31/42/54'),
  Seated_Barbell_Military_Press: w('shoulders', '21/34/49/68/89', '36/51/71/93/117', '50/68/90/115/142', '9/18/30/45/62'),
  Dumbbell_Shoulder_Press: w('shoulders', '10/15/23/32/43', '15/22/31/42/54', '20/28/39/50/63', '6/10/15/20/27'),
  Machine_Shoulder_Military_Press: w('shoulders', '17/33/56/84/116', '29/50/76/109/145', '41/64/94/130/170', '8/17/30/47/66'),
  Arnold_Dumbbell_Press: w('shoulders', '7/12/19/27/37', '10/16/24/34/44', '13/20/29/39/50', '6/8/12/16/21'),
  Side_Lateral_Raise: w('shoulders', ...LATERAL, true),
  // one handle; Strength Level's cable numbers mix in two-handed raises and light pulleys
  Cable_Seated_Lateral_Raise: w('shoulders', '2/6/13/22/34', '3/8/16/27/39', '4/10/19/30/44', '2/5/10/17/25', true, 0.6),
  Face_Pull: w('shoulders', '10/21/37/57/80', '15/29/47/69/95', '21/35/55/80/107', '10/19/32/47/65', true, 0.85),
  Upright_Barbell_Row: w('shoulders', '15/27/45/66/91', '23/39/59/84/111', '31/49/71/98/128', '11/19/30/42/57'),
  Front_Dumbbell_Raise: w('shoulders', '2/7/13/22/32', '4/10/17/27/38', '6/12/21/31/44', '3/5/9/14/19', true),
  Reverse_Flyes: w('shoulders', ...LATERAL, true, 0.9),

  // Arms
  Barbell_Curl: w('arms', '15/24/36/50/66', '22/33/46/63/80', '28/40/55/73/92', '8/14/23/34/47', true),
  'EZ-Bar_Curl': w('arms', '18/26/37/49/62', '25/35/46/60/75', '31/42/55/70/85', '11/17/25/35/45', true),
  Dumbbell_Bicep_Curl: w('arms', '6/11/18/26/36', '8/14/22/32/42', '11/17/26/36/48', '4/7/12/18/24', true),
  Hammer_Curls: w('arms', '7/12/18/26/34', '11/16/24/33/42', '14/21/29/39/49', '5/8/12/17/22', true),
  Standing_Biceps_Cable_Curl: w('arms', '13/25/41/61/83', '20/33/51/73/98', '25/41/60/84/110', '7/15/24/37/51', true),
  Preacher_Curl: w('arms', '14/23/35/50/66', '20/31/45/61/78', '26/38/53/70/89', '8/15/23/34/46', true),
  Concentration_Curls: w('arms', '6/11/17/25/33', '9/14/22/30/40', '12/18/25/35/45', '4/7/12/17/22', true),
  Incline_Dumbbell_Curl: w('arms', '7/10/15/21/27', '10/14/20/26/33', '12/17/23/30/38', '5/8/11/15/19', true),
  'Close-Grip_Barbell_Bench_Press': w('arms', '35/49/66/86/107', '55/72/93/116/140', '73/93/116/142/169', '20/31/46/63/82'),
  'EZ-Bar_Skullcrusher': w('arms', '12/20/31/45/60', '20/30/43/59/76', '27/39/54/71/90', '7/12/20/29/40', true),
  Triceps_Pushdown: w('arms', '14/26/43/64/89', '22/36/56/80/107', '29/46/67/93/122', '9/17/28/42/59', true),
  'Triceps_Pushdown_-_Rope_Attachment': w('arms', '11/21/35/53/74', '17/30/46/66/89', '23/37/56/78/102', '8/15/24/35/49', true),
  Cable_Rope_Overhead_Triceps_Extension: w('arms', '8/18/31/49/70', '14/26/43/64/87', '21/35/53/76/101', '6/12/20/32/45', true),
  Standing_Dumbbell_Triceps_Extension: w('arms', '3/8/16/26/38', '6/12/22/33/47', '9/16/27/40/54', '3/7/12/17/24', true),
  'Dips_-_Triceps_Version': { group: 'arms', metric: 'bw', m: [0.95, 1.22, 1.6, 2.0, 2.45], f: [0.75, 0.97, 1.3, 1.68, 2.1] },

  // Legs
  Barbell_Squat: w('legs', '49/71/98/129/162', '75/101/132/168/206', '98/128/163/203/244', '32/49/72/99/129'),
  Front_Barbell_Squat: w('legs', '40/57/79/104/130', '59/79/104/133/163', '76/99/127/158/190', '31/44/60/79/99'),
  Trap_Bar_Deadlift: w('legs', '72/98/130/167/206', '99/130/166/207/251', '123/157/197/242/288', '48/68/93/121/152'),
  Leg_Press: w('legs', '71/115/173/242/319', '109/162/230/309/395', '144/205/280/366/460', '49/87/140/204/277'),
  Hack_Squat: w('legs', '41/73/117/171/231', '63/102/152/213/280', '84/127/183/249/321', '24/50/87/135/190'),
  Smith_Machine_Squat: w('legs', '37/60/89/124/163', '57/84/118/158/202', '75/106/144/187/234', '22/38/61/88/119'),
  Goblet_Squat: w('legs', '11/21/34/51/70', '15/26/41/59/80', '19/31/47/66/88', '10/17/26/37/49'),
  x_bulgarian_split_squat: w('legs', '8/15/25/38/52', '13/22/33/47/63', '18/28/40/56/72', '7/12/20/30/41'),
  Barbell_Lunge: w('legs', '20/37/61/89/122', '34/55/82/116/153', '47/71/102/138/179', '19/32/49/69/92'),
  Dumbbell_Lunges: w('legs', '6/13/23/37/52', '10/18/30/45/62', '13/23/36/52/70', '6/11/19/28/39'),
  Romanian_Deadlift: w('legs', '43/65/93/127/163', '65/92/125/163/203', '85/115/152/194/238', '31/47/67/90/116'),
  'Stiff-Legged_Dumbbell_Deadlift': w('legs', '12/21/33/48/65', '19/30/44/61/79', '25/37/53/71/91', '10/17/27/39/52'),
  Leg_Extensions: w('legs', '36/57/85/119/156', '48/72/103/140/180', '58/85/119/158/201', '22/38/59/86/115', true),
  Lying_Leg_Curls: w('legs', '21/34/52/73/96', '30/46/66/90/116', '39/57/79/105/133', '15/24/36/51/67', true),
  Seated_Leg_Curl: w('legs', '29/45/67/94/123', '39/58/83/112/144', '48/69/96/127/161', '19/31/47/67/88', true),
  Barbell_Hip_Thrust: w('legs', ...HIP_THRUST),
  Barbell_Glute_Bridge: w('legs', ...HIP_THRUST, false, 0.85),
  Standing_Calf_Raises: w('legs', '31/63/110/168/236', '49/88/141/207/282', '65/110/169/240/320', '21/47/84/133/190', true),
  Seated_Calf_Raise: w('legs', '20/41/73/112/158', '31/57/93/138/188', '42/71/111/159/213', '14/34/63/102/147', true),
  x_wall_sit: { group: 'legs', metric: 'seconds', m: [30, 60, 100, 150, 220] },

  // Core
  Plank: { group: 'core', metric: 'seconds', m: [20, 45, 90, 150, 240] },
  x_side_plank: { group: 'core', metric: 'seconds', m: [15, 30, 60, 100, 150] },
  Crunches: { group: 'core', metric: 'reps', m: [10, 25, 45, 70, 100] },
  x_leg_raise_lying: { group: 'core', metric: 'reps', m: [8, 18, 30, 45, 65] },
  Hanging_Leg_Raise: { group: 'core', metric: 'reps', m: [3, 8, 14, 20, 28], f: [2, 6, 11, 16, 22] },
  Cable_Crunch: w('core', ...CABLE_CRUNCH, true),
  Ab_Crunch_Machine: w('core', ...CABLE_CRUNCH, true),
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
  if (!STANDARDS[ex.id] || STANDARDS[ex.id].metric !== 'kg') return 1;
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

/** Standard levels [beginner … elite] for this sex at this bodyweight. */
function levels(std: Std, sex: Sex, bw: number): number[] {
  if (std.metric !== 'kg') {
    if (sex === 'male') return std.m!;
    if (std.f) return std.f;
    return std.metric === 'reps' ? std.m!.map((x) => x * 0.65) : std.m!;
  }
  const [m60, m80, m100, f60] = std.kg!;
  const b = Math.min(160, Math.max(40, bw));
  // men: power curve through the 60/80 or 80/100 kg points, extended past the ends
  const male = (i: number, x: number) => {
    const [lo, hi] = x <= 80 ? [m60[i], m80[i]] : [m80[i], m100[i]];
    const e = Math.log(hi / lo) / Math.log(x <= 80 ? 80 / 60 : 100 / 80);
    return m80[i] * (x / 80) ** e;
  };
  // women: the 60 kg table, following the men's curve (60 kg woman ~ 80 kg man)
  const lv = m60.map((_, i) => (sex === 'male' ? male(i, b) : (f60[i] * male(i, (b * 80) / 60)) / m80[i]));
  for (let i = 1; i < lv.length; i++) lv[i] = Math.max(lv[i], lv[i - 1] * 1.05);
  return lv;
}

/** Metric values at each scoring anchor (0, beginner … elite, Olympian) for this sex and bodyweight. */
export function anchors(std: Std, sex: Sex, bw = REF_BW[sex]): number[] {
  const lv = levels(std, sex, bw);
  const zero = std.metric === 'bw' ? Math.min(0.85, lv[0] - 0.1) : 0;
  return [zero, ...lv, lv[4] + LEGEND_STEP * (lv[4] - lv[3])];
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

/** The metric value one set reaches, or null if it can't be ranked. */
export function setValue(set: Pick<WSet, 'weight' | 'reps' | 'duration'>, std: Std, bw: number): number | null {
  const reps = set.reps ?? 0;
  const kg = set.weight ?? 0;
  switch (std.metric) {
    case 'kg':
      if (kg <= 0 || reps < 1 || reps > 30) return null;
      return epley1RM(kg, reps);
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
  const v = valueForScore(score, anchors(std, sex, bw));
  const f = reps === 1 ? 1 : 1 + reps / 30;
  if (std.metric === 'kg') return v / f / factor;
  if (std.metric === 'bw') return (v * bw) / f - bw;
  return null;
}

/** Reps or seconds needed for a rep/time standard. */
export function targetForScore(exerciseId: string, score: number, sex: Sex) {
  const std = STANDARDS[exerciseId];
  return std ? valueForScore(score, anchors(std, sex)) : 0;
}

const cache = new WeakMap<Std, Map<string, number[]>>();
function anchorsCached(std: Std, sex: Sex, bw: number) {
  let m = cache.get(std);
  if (!m) cache.set(std, (m = new Map()));
  const k = sex + bw;
  let a = m.get(k);
  if (!a) m.set(k, (a = anchors(std, sex, bw)));
  return a;
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
  const v = setValue(factor === 1 ? set : { ...set, weight: (set.weight ?? 0) * factor }, std, bw);
  return v == null ? 0 : Math.round(scoreFor(v, anchorsCached(std, sex, bw)));
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
