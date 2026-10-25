import { db } from '../db/db';
import { useWorkout } from '../state/workout';

/** How many saved workouts and routines use an exercise. */
export async function exerciseUsage(id: string) {
  const workouts = await db.workouts.where('exerciseIds').equals(id).count();
  const routines = (await db.routines.toArray()).filter((r) => r.exercises.some((e) => e.exerciseId === id)).length;
  return { workouts, routines };
}

/**
 * Re-labels every logged set of `fromId` as `toId` — in history, routines and the running workout.
 * Used to fix exercises that were matched wrongly (e.g. on Hevy import).
 */
export async function moveExerciseHistory(fromId: string, toId: string) {
  if (fromId === toId) return 0;
  let n = 0;
  await db.transaction('rw', db.workouts, db.routines, async () => {
    const ws = await db.workouts.where('exerciseIds').equals(fromId).toArray();
    for (const w of ws) {
      for (const e of w.exercises) if (e.exerciseId === fromId) e.exerciseId = toId;
      w.exerciseIds = [...new Set(w.exercises.map((e) => e.exerciseId))];
      await db.workouts.put(w);
      n++;
    }
    for (const r of await db.routines.toArray()) {
      if (!r.exercises.some((e) => e.exerciseId === fromId)) continue;
      for (const e of r.exercises) if (e.exerciseId === fromId) e.exerciseId = toId;
      await db.routines.put({ ...r, updatedAt: Date.now() });
    }
  });
  const active = useWorkout.getState().active;
  if (active?.workout.exercises.some((e) => e.exerciseId === fromId))
    useWorkout.getState().mutate((w) => w.exercises.forEach((e) => e.exerciseId === fromId && (e.exerciseId = toId)));
  return n;
}
