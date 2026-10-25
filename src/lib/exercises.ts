import { create } from 'zustand';
import builtin from '../data/exercises.json';
import { db } from '../db/db';
import type { Exercise } from '../types';

const IMG_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/';

export const BUILTIN = builtin as Exercise[];

export function imageUrl(img: string, frame: 0 | 1 = 0) {
  return `${IMG_BASE}${img}/${frame}.jpg`;
}

export const MUSCLES = [
  'Abs', 'Abductors', 'Adductors', 'Biceps', 'Calves', 'Cardio', 'Chest', 'Forearms', 'Glutes',
  'Hamstrings', 'Lats', 'Lower Back', 'Neck', 'Quadriceps', 'Shoulders', 'Traps', 'Triceps', 'Upper Back', 'Other',
];

export const EQUIPMENT = [
  'None', 'Barbell', 'Dumbbell', 'Kettlebell', 'Machine', 'Smith Machine', 'Cable', 'EZ Bar',
  'Resistance Band', 'Medicine Ball', 'Exercise Ball', 'Foam Roller', 'Other',
];

interface LibraryState {
  list: Exercise[];
  map: Record<string, Exercise>;
  reload: () => Promise<void>;
}

function build(custom: Exercise[]) {
  const map: Record<string, Exercise> = {};
  for (const e of BUILTIN) map[e.id] = e;
  for (const e of custom) map[e.id] = { ...map[e.id], ...e };
  const list = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  return { list, map };
}

export const useLibrary = create<LibraryState>((set) => ({
  ...build([]),
  reload: async () => set(build(await db.exercises.toArray())),
}));

const UNKNOWN: Exercise = { id: '?', name: 'Unknown exercise', muscle: 'Other', secondary: [], equipment: 'None', type: 'weight_reps' };

export function getExercise(id: string): Exercise {
  return useLibrary.getState().map[id] ?? { ...UNKNOWN, id };
}

export function useExercise(id: string): Exercise {
  return useLibrary((s) => s.map[id]) ?? { ...UNKNOWN, id };
}

export const typeOf = (id: string) => getExercise(id).type;

let instructions: Promise<Record<string, string[]>> | null = null;
export function getInstructions(id: string): Promise<string[]> {
  instructions ??= import('../data/instructions.json').then((m) => m.default as Record<string, string[]>);
  return instructions.then((all) => all[id] ?? []);
}

/** Lowercase, strip punctuation, for search & matching. */
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function searchExercises(list: Exercise[], q: string): Exercise[] {
  const terms = normalize(q).split(' ').filter(Boolean);
  // Without a query, the common gym exercises come first (like Hevy), then everything else A–Z.
  if (!terms.length) return [...list.filter((e) => e.popular || e.custom), ...list.filter((e) => !e.popular && !e.custom)];
  const scored: [Exercise, number][] = [];
  for (const e of list) {
    const hay = normalize(`${e.name} ${e.alt ?? ''} ${e.equipment} ${e.muscle}`);
    if (!terms.every((t) => hay.includes(t))) continue;
    const name = normalize(e.name);
    let score = 0;
    if (name.startsWith(terms[0])) score += 3;
    if (name.includes(terms.join(' '))) score += 2;
    if (e.popular) score += 2;
    if (e.stretch) score -= 2;
    scored.push([e, score]);
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name)).map((x) => x[0]);
}
