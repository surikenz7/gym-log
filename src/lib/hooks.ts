import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { ExerciseType, WSet, Workout } from '../types';
import { exerciseBests, type Bests } from './stats';

/** Sets from the most recent workout containing `exerciseId` (excluding `excludeId`). */
export function usePreviousSets(exerciseId: string, excludeId?: string): WSet[] {
  return (
    useLiveQuery(async () => {
      const ws = await db.workouts.where('exerciseIds').equals(exerciseId).toArray();
      let last: Workout | undefined;
      for (const w of ws) if (w.id !== excludeId && (!last || w.start > last.start)) last = w;
      return last ? last.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets) : [];
    }, [exerciseId, excludeId]) ?? []
  );
}

export async function previousSets(exerciseId: string): Promise<WSet[]> {
  const ws = await db.workouts.where('exerciseIds').equals(exerciseId).toArray();
  const last = ws.sort((a, b) => b.start - a.start)[0];
  return last ? last.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets) : [];
}

export function useAllWorkouts(): Workout[] | undefined {
  return useLiveQuery(() => db.workouts.orderBy('start').reverse().toArray(), []);
}

/** All-time bests for an exercise from saved workouts (excluding the running one). */
export function useHistoryBests(exerciseId: string, type: ExerciseType, excludeId?: string): Bests | undefined {
  return useLiveQuery(async () => {
    if (!excludeId) return undefined;
    const ws = await db.workouts.where('exerciseIds').equals(exerciseId).toArray();
    return exerciseBests(ws.filter((w) => w.id !== excludeId), exerciseId, type);
  }, [exerciseId, type, excludeId]);
}
