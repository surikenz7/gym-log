import { db } from '../db/db';
import type { Exercise, Folder, Measure, Routine, Workout } from '../types';

/**
 * Removes copies of the same data that were created separately — e.g. history imported once in
 * Safari and once in the Home Screen app (different ids), then merged when logging in.
 * The surviving copy is chosen deterministically, so every device keeps the same one and the
 * deletions sync cleanly as tombstones.
 */

export interface DedupeResult {
  workouts: number;
  routines: number;
  folders: number;
  exercises: number;
  measures: number;
}

function groups<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k);
    if (g) g.push(r);
    else m.set(k, [r]);
  }
  return [...m.values()].filter((g) => g.length > 1);
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();
const doneSets = (w: Workout) => w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

export function workoutKey(w: Workout) {
  return `${Math.round(w.start / 60000)}|${norm(w.name)}`;
}

export function routineKey(r: Routine) {
  return `${norm(r.name)}|${r.exercises.map((e) => `${e.exerciseId}:${e.sets.length}`).join(',')}`;
}

/** Pure part, easy to test: which rows to drop and how ids map onto the survivors. */
export function planDedupe(data: { workouts: Workout[]; routines: Routine[]; folders: Folder[]; exercises: Exercise[]; measures: Measure[] }) {
  // custom exercises with the same name → one
  const exMap = new Map<string, string>();
  for (const g of groups(
    data.exercises.filter((e) => e.custom),
    (e) => norm(e.name),
  )) {
    const [keep, ...rest] = [...g].sort(byId);
    for (const r of rest) exMap.set(r.id, keep.id);
  }
  // folders with the same name → one
  const folderMap = new Map<string, string>();
  for (const g of groups(data.folders, (f) => norm(f.name))) {
    const [keep, ...rest] = [...g].sort(byId);
    for (const r of rest) folderMap.set(r.id, keep.id);
  }
  const remapEx = <T extends { exercises: { exerciseId: string }[] }>(x: T) =>
    exMap.size && x.exercises.some((e) => exMap.has(e.exerciseId)) ? { ...x, exercises: x.exercises.map((e) => ({ ...e, exerciseId: exMap.get(e.exerciseId) ?? e.exerciseId })) } : null;

  const workouts = data.workouts.map((w) => {
    const r = remapEx(w);
    return r ? { ...r, exerciseIds: [...new Set(r.exercises.map((e) => e.exerciseId))] } : w;
  });
  const routines = data.routines.map((r) => {
    let x = remapEx(r) ?? r;
    if (x.folderId && folderMap.has(x.folderId)) x = { ...x, folderId: folderMap.get(x.folderId)! };
    return x;
  });

  // same start minute + same name → keep the fullest copy (then the smallest id)
  const dropWorkouts = new Set<string>();
  for (const g of groups(workouts, workoutKey)) {
    const [, ...rest] = [...g].sort((a, b) => doneSets(b) - doneSets(a) || byId(a, b));
    rest.forEach((w) => dropWorkouts.add(w.id));
  }
  const dropRoutines = new Set<string>();
  for (const g of groups(routines, routineKey)) {
    const [, ...rest] = [...g].sort(byId);
    rest.forEach((r) => dropRoutines.add(r.id));
  }
  const dropMeasures = new Set<string>();
  for (const g of groups(data.measures, (m) => `${Math.round(m.date / 60000)}|${m.weight ?? ''}|${m.bodyFat ?? ''}|${m.waist ?? ''}`)) {
    const [, ...rest] = [...g].sort(byId);
    rest.forEach((m) => dropMeasures.add(m.id));
  }

  return {
    changedWorkouts: workouts.filter((w, i) => w !== data.workouts[i] && !dropWorkouts.has(w.id)),
    changedRoutines: routines.filter((r, i) => r !== data.routines[i] && !dropRoutines.has(r.id)),
    dropWorkouts,
    dropRoutines,
    dropMeasures,
    dropFolders: new Set(folderMap.keys()),
    dropExercises: new Set(exMap.keys()),
  };
}

export async function dedupeLocal(): Promise<DedupeResult> {
  return db.transaction('rw', [db.workouts, db.routines, db.folders, db.exercises, db.measures], async () => {
    const plan = planDedupe({
      workouts: await db.workouts.toArray(),
      routines: await db.routines.toArray(),
      folders: await db.folders.toArray(),
      exercises: await db.exercises.toArray(),
      measures: await db.measures.toArray(),
    });
    if (plan.changedWorkouts.length) await db.workouts.bulkPut(plan.changedWorkouts);
    if (plan.changedRoutines.length) await db.routines.bulkPut(plan.changedRoutines);
    await db.workouts.bulkDelete([...plan.dropWorkouts]);
    await db.routines.bulkDelete([...plan.dropRoutines]);
    await db.folders.bulkDelete([...plan.dropFolders]);
    await db.exercises.bulkDelete([...plan.dropExercises]);
    await db.measures.bulkDelete([...plan.dropMeasures]);
    return {
      workouts: plan.dropWorkouts.size,
      routines: plan.dropRoutines.size,
      folders: plan.dropFolders.size,
      exercises: plan.dropExercises.size,
      measures: plan.dropMeasures.size,
    };
  });
}

export const dedupeTotal = (r: DedupeResult) => r.workouts + r.routines + r.folders + r.exercises + r.measures;

export function describeDedupe(r: DedupeResult) {
  const parts = [
    r.workouts && `${r.workouts} workout${r.workouts === 1 ? '' : 's'}`,
    r.routines && `${r.routines} routine${r.routines === 1 ? '' : 's'}`,
    r.measures && `${r.measures} measurement${r.measures === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return parts.length ? `Removed duplicate ${parts.join(', ')}` : 'Removed duplicates';
}
