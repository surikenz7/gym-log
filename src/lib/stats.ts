import type { ExerciseType, WExercise, WSet, Workout } from '../types';

export function epley1RM(weight: number, reps: number) {
  if (reps <= 0 || weight <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

const LOAD_TYPES: ExerciseType[] = ['weight_reps', 'weighted_bodyweight'];

export function setVolume(set: WSet, type: ExerciseType) {
  if (!LOAD_TYPES.includes(type)) return 0;
  return (set.weight ?? 0) * (set.reps ?? 0);
}

export function doneSets(wex: WExercise) {
  return wex.sets.filter((s) => s.done);
}

export function workoutVolume(w: Pick<Workout, 'exercises'>, typeOf: (id: string) => ExerciseType) {
  let v = 0;
  for (const e of w.exercises) {
    const t = typeOf(e.exerciseId);
    for (const s of doneSets(e)) v += setVolume(s, t);
  }
  return v;
}

export function workoutSetCount(w: Pick<Workout, 'exercises'>) {
  return w.exercises.reduce((n, e) => n + doneSets(e).length, 0);
}

export type PRKind = 'weight' | '1rm' | 'volume' | 'reps' | 'duration' | 'distance';

export const PR_LABELS: Record<PRKind, string> = {
  weight: 'Heaviest weight',
  '1rm': 'Best 1RM',
  volume: 'Best set volume',
  reps: 'Most reps',
  duration: 'Longest time',
  distance: 'Longest distance',
};

export type Bests = Partial<Record<PRKind, number>>;

/** Metric values a single set contributes, keyed by PR kind, depending on exercise type. */
export function setMetrics(set: WSet, type: ExerciseType): Bests {
  const m: Bests = {};
  const w = set.weight ?? 0;
  const r = set.reps ?? 0;
  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      if (w > 0) m.weight = w;
      if (w > 0 && r > 0) {
        m['1rm'] = epley1RM(w, r);
        m.volume = w * r;
      }
      if (r > 0 && type === 'weighted_bodyweight') m.reps = r;
      break;
    case 'assisted_bodyweight':
    case 'bodyweight_reps':
      if (r > 0) m.reps = r;
      break;
    case 'duration':
    case 'weight_duration':
      if (set.duration) m.duration = set.duration;
      if (type === 'weight_duration' && w > 0) m.weight = w;
      break;
    case 'distance_duration':
      if (set.distance) m.distance = set.distance;
      if (set.duration) m.duration = set.duration;
      break;
    case 'weight_distance':
      if (w > 0) m.weight = w;
      if (set.distance) m.distance = set.distance;
      break;
  }
  return m;
}

function merge(into: Bests, from: Bests) {
  for (const k of Object.keys(from) as PRKind[]) {
    if ((from[k] ?? 0) > (into[k] ?? 0)) into[k] = from[k];
  }
}

/** All-time bests for one exercise across the given workouts (warm-ups excluded). */
export function exerciseBests(workouts: Workout[], exerciseId: string, type: ExerciseType): Bests {
  const b: Bests = {};
  for (const w of workouts)
    for (const e of w.exercises)
      if (e.exerciseId === exerciseId)
        for (const s of e.sets) if (s.done && s.type !== 'warmup') merge(b, setMetrics(s, type));
  return b;
}

export interface PR {
  exerciseId: string;
  setId: string;
  kind: PRKind;
  value: number;
}

/**
 * PRs set in `workout` compared to `history` (which must not include `workout`).
 * Only the best set per exercise+kind is reported. No PRs on an exercise's first ever session.
 */
export function findPRs(workout: Pick<Workout, 'exercises'>, history: Workout[], typeOf: (id: string) => ExerciseType): PR[] {
  const prs: PR[] = [];
  const seen = new Map<string, Bests>();
  for (const e of workout.exercises) {
    const type = typeOf(e.exerciseId);
    if (!seen.has(e.exerciseId)) seen.set(e.exerciseId, exerciseBests(history, e.exerciseId, type));
    const prev = seen.get(e.exerciseId)!;
    if (Object.keys(prev).length === 0) continue;
    for (const s of e.sets) {
      if (!s.done || s.type === 'warmup') continue;
      const m = setMetrics(s, type);
      for (const k of Object.keys(m) as PRKind[]) {
        const v = m[k]!;
        if (v > (prev[k] ?? 0) + 1e-9) {
          const i = prs.findIndex((p) => p.exerciseId === e.exerciseId && p.kind === k);
          if (i >= 0) prs.splice(i, 1);
          prs.push({ exerciseId: e.exerciseId, setId: s.id, kind: k, value: v });
          prev[k] = v;
        }
      }
    }
  }
  return prs;
}

export interface SessionPoint {
  date: number;
  workoutId: string;
  heaviest: number;
  oneRM: number;
  bestSetVolume: number;
  sessionVolume: number;
  totalReps: number;
  bestReps: number;
  bestDuration: number;
  bestDistance: number;
}

/** One data point per workout that contains the exercise, oldest first. */
export function exerciseSessions(workouts: Workout[], exerciseId: string, type: ExerciseType): SessionPoint[] {
  const pts: SessionPoint[] = [];
  for (const w of [...workouts].sort((a, b) => a.start - b.start)) {
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets.filter((s) => s.done));
    if (!sets.length) continue;
    const p: SessionPoint = {
      date: w.start, workoutId: w.id, heaviest: 0, oneRM: 0, bestSetVolume: 0,
      sessionVolume: 0, totalReps: 0, bestReps: 0, bestDuration: 0, bestDistance: 0,
    };
    for (const s of sets) {
      p.totalReps += s.reps ?? 0;
      p.sessionVolume += setVolume(s, type);
      if (s.type === 'warmup') continue;
      p.bestReps = Math.max(p.bestReps, s.reps ?? 0);
      const m = setMetrics(s, type);
      p.heaviest = Math.max(p.heaviest, m.weight ?? 0);
      p.oneRM = Math.max(p.oneRM, m['1rm'] ?? 0);
      p.bestSetVolume = Math.max(p.bestSetVolume, m.volume ?? 0);
      p.bestDuration = Math.max(p.bestDuration, m.duration ?? 0);
      p.bestDistance = Math.max(p.bestDistance, m.distance ?? 0);
    }
    pts.push(p);
  }
  return pts;
}

export interface RepRecord {
  reps: number;
  weight: number;
  date: number;
  workoutId: string;
}

/** Hevy-style "Set Records": the heaviest weight lifted for each rep count (1..maxReps). */
export function repRecords(workouts: Workout[], exerciseId: string): RepRecord[] {
  const best = new Map<number, RepRecord>();
  for (const w of workouts)
    for (const e of w.exercises)
      if (e.exerciseId === exerciseId)
        for (const s of e.sets) {
          const r = s.reps ?? 0;
          const kg = s.weight ?? 0;
          if (!s.done || s.type === 'warmup' || r <= 0 || kg <= 0) continue;
          const cur = best.get(r);
          if (!cur || kg > cur.weight || (kg === cur.weight && w.start < cur.date)) best.set(r, { reps: r, weight: kg, date: w.start, workoutId: w.id });
        }
  return [...best.values()].sort((a, b) => a.reps - b.reps);
}

export function bestSessionVolume(workouts: Workout[], exerciseId: string, type: ExerciseType) {
  let best = 0;
  for (const w of workouts) {
    let v = 0;
    for (const e of w.exercises) if (e.exerciseId === exerciseId) for (const s of e.sets) if (s.done) v += setVolume(s, type);
    best = Math.max(best, v);
  }
  return best;
}

/** Number of PR sets in every workout, computed in one chronological pass. */
export function prCounts(workouts: Workout[], typeOf: (id: string) => ExerciseType): Map<string, number> {
  const out = new Map<string, number>();
  const bests = new Map<string, Bests>();
  for (const w of [...workouts].sort((a, b) => a.start - b.start)) {
    let n = 0;
    const seenBefore = new Set([...bests.keys()]);
    for (const e of w.exercises) {
      const type = typeOf(e.exerciseId);
      const b = bests.get(e.exerciseId) ?? {};
      for (const s of e.sets) {
        if (!s.done || s.type === 'warmup') continue;
        const m = setMetrics(s, type);
        let pr = false;
        for (const k of Object.keys(m) as PRKind[]) {
          if (m[k]! > (b[k] ?? 0) + 1e-9) {
            if (seenBefore.has(e.exerciseId)) pr = true;
            b[k] = m[k];
          }
        }
        if (pr) n++;
      }
      bests.set(e.exerciseId, b);
    }
    out.set(w.id, n);
  }
  return out;
}

/** PR kinds hit by each set of one exercise block, given all-time bests from earlier workouts. */
export function livePRs(sets: WSet[], history: Bests, type: ExerciseType): Map<string, PRKind[]> {
  const out = new Map<string, PRKind[]>();
  if (Object.keys(history).length === 0) return out;
  const b = { ...history };
  for (const s of sets) {
    if (!s.done || s.type === 'warmup') continue;
    const m = setMetrics(s, type);
    const kinds = (Object.keys(m) as PRKind[]).filter((k) => m[k]! > (b[k] ?? 0) + 1e-9);
    for (const k of kinds) b[k] = m[k];
    if (kinds.length) out.set(s.id, kinds);
  }
  return out;
}
