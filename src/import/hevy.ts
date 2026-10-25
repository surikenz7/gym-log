import Papa from 'papaparse';
import { normalize } from '../lib/exercises';
import { uid } from '../lib/id';
import { FIELDS, KG_PER_LB, type Field } from '../lib/units';
import type { Exercise, ExerciseType, SetType, WExercise, Workout } from '../types';

export interface ParsedSet {
  type: SetType;
  weight: number | null;
  reps: number | null;
  distance: number | null;
  duration: number | null;
  rpe: number | null;
}

export interface ParsedExercise {
  name: string;
  notes: string;
  superset: string | null;
  sets: ParsedSet[];
}

export interface ParsedWorkout {
  title: string;
  start: number;
  end: number;
  description: string;
  exercises: ParsedExercise[];
}

export interface HevyParse {
  workouts: ParsedWorkout[];
  /** distinct exercise names with which value fields appear in the data */
  exercises: { name: string; sets: number; fields: Field[] }[];
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Hevy writes local times like "6 Feb 2024, 17:58"; newer exports may use ISO-ish strings. */
export function parseHevyDate(s: string): number | null {
  s = s?.trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()] != null) {
    return new Date(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function setType(v: string): SetType {
  const t = (v ?? '').toLowerCase();
  if (t.startsWith('warm')) return 'warmup';
  if (t.startsWith('fail')) return 'failure';
  if (t.startsWith('drop')) return 'drop';
  return 'normal';
}

export function parseHevyCsv(text: string): HevyParse {
  const { data, meta } = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true });
  const cols = meta.fields ?? [];
  if (!cols.includes('exercise_title') || !cols.includes('start_time')) {
    throw new Error('This doesn’t look like a Hevy workout export (missing exercise_title / start_time columns).');
  }
  const lbs = cols.includes('weight_lbs') && !cols.includes('weight_kg');
  const miles = cols.includes('distance_miles') && !cols.includes('distance_km');

  const workouts: ParsedWorkout[] = [];
  const byKey = new Map<string, ParsedWorkout>();
  const exStats = new Map<string, { sets: number; fields: Set<Field> }>();
  let lastEx: ParsedExercise | null = null;
  let lastSetIndex = -1;

  for (const r of data) {
    const start = parseHevyDate(r.start_time);
    const name = r.exercise_title?.trim();
    if (!start || !name) continue;
    const key = `${r.title}|${r.start_time}`;
    let w = byKey.get(key);
    if (!w) {
      w = { title: r.title?.trim() || 'Workout', start, end: parseHevyDate(r.end_time) ?? start + 3600_000, description: r.description ?? '', exercises: [] };
      byKey.set(key, w);
      workouts.push(w);
      lastEx = null;
    }
    const setIndex = num(r.set_index) ?? lastSetIndex + 1;
    const superset = r.superset_id?.trim() || null;
    // A new exercise block starts when the title changes or set numbering restarts.
    if (!lastEx || lastEx.name !== name || setIndex <= lastSetIndex || !w.exercises.includes(lastEx)) {
      lastEx = { name, notes: r.exercise_notes ?? '', superset, sets: [] };
      w.exercises.push(lastEx);
    }
    lastSetIndex = setIndex;

    const wRaw = num(lbs ? r.weight_lbs : r.weight_kg);
    const dRaw = num(miles ? r.distance_miles : r.distance_km);
    const s: ParsedSet = {
      type: setType(r.set_type),
      weight: wRaw == null ? null : lbs ? wRaw * KG_PER_LB : wRaw,
      reps: num(r.reps),
      distance: dRaw == null ? null : dRaw * (miles ? 1609.344 : 1000),
      duration: num(r.duration_seconds),
      rpe: num(r.rpe),
    };
    lastEx.sets.push(s);

    const st = exStats.get(name) ?? { sets: 0, fields: new Set<Field>() };
    st.sets++;
    for (const f of ['weight', 'reps', 'distance', 'duration'] as Field[]) if (s[f]) st.fields.add(f);
    exStats.set(name, st);
  }
  workouts.sort((a, b) => a.start - b.start);
  return {
    workouts,
    exercises: [...exStats.entries()].map(([name, v]) => ({ name, sets: v.sets, fields: [...v.fields] })).sort((a, b) => b.sets - a.sets),
  };
}

/** Exercise type that fits the logged fields (plus Hevy's "(Weighted)" / "(Assisted)" naming hints). */
export function inferType(name: string, fields: Field[]): ExerciseType {
  const has = (f: Field) => fields.includes(f);
  if (/\(assisted\)/i.test(name)) return 'assisted_bodyweight';
  if (/\(weighted\)/i.test(name)) return 'weighted_bodyweight';
  if (has('distance') && has('weight')) return 'weight_distance';
  if (has('distance')) return 'distance_duration';
  if (has('duration') && has('weight')) return 'weight_duration';
  if (has('duration') && !has('reps')) return 'duration';
  if (has('weight')) return 'weight_reps';
  if (has('reps')) return 'bodyweight_reps';
  return 'weight_reps';
}

export function compatible(type: ExerciseType, fields: Field[]) {
  return fields.every((f) => FIELDS[type].includes(f));
}

const SYNONYMS: Record<string, string> = { db: 'dumbbell', bb: 'barbell', kb: 'kettlebell', ez: 'ez', flye: 'fly' };
// Light stemming so "Fly"/"Flyes" and "Curl"/"Curls" compare equal.
const stem = (t: string) => {
  const s = t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t;
  return SYNONYMS[s] ?? s;
};
const tokens = (s: string) => new Set(normalize(s).split(' ').filter(Boolean).map(stem));

/** Best library match for a Hevy exercise name, or null. */
export function matchExercise(hevyName: string, fields: Field[], list: Exercise[]): { id: string; exact: boolean } | null {
  const n = normalize(hevyName);
  for (const e of list) {
    if ((normalize(e.name) === n || (e.alt && normalize(e.alt) === n)) && compatible(e.type, fields)) return { id: e.id, exact: true };
  }
  const m = hevyName.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const want = tokens(m ? `${m[1]} ${m[2]}` : hevyName);
  let best: { id: string; score: number } | null = null;
  for (const e of list) {
    if (e.stretch || !compatible(e.type, fields)) continue;
    const have = tokens(`${e.name} ${e.equipment}`);
    let inter = 0;
    want.forEach((t) => have.has(t) && inter++);
    const score = inter / (want.size + have.size - inter);
    if (score > (best?.score ?? 0)) best = { id: e.id, score };
  }
  return best && best.score >= 0.5 ? { id: best.id, exact: false } : null;
}

export type Mapping = Record<string, string | { custom: ExerciseType }>;

/** Turns parsed workouts into app workouts; `resolve` maps a Hevy name to an exercise id. */
export function toWorkouts(parsed: ParsedWorkout[], resolve: (name: string) => string): Workout[] {
  return parsed.map((p) => {
    const ss = new Map<string, string>();
    const exercises: WExercise[] = p.exercises.map((e) => ({
      id: uid(),
      exerciseId: resolve(e.name),
      supersetId: e.superset ? (ss.get(e.superset) ?? ss.set(e.superset, uid()).get(e.superset)!) : null,
      notes: e.notes,
      restSec: null,
      sets: e.sets.map((s) => ({ id: uid(), ...s, done: true })),
    }));
    return {
      id: uid(),
      name: p.title,
      start: p.start,
      end: Math.max(p.end, p.start),
      notes: p.description,
      routineId: null,
      exercises,
      exerciseIds: [...new Set(exercises.map((e) => e.exerciseId))],
      source: 'hevy',
    };
  });
}
