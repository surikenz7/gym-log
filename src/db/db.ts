import Dexie, { type Table } from 'dexie';
import type { ActiveWorkout, Exercise, Folder, Routine, Settings, Workout } from '../types';

class GymDB extends Dexie {
  workouts!: Table<Workout, string>;
  routines!: Table<Routine, string>;
  folders!: Table<Folder, string>;
  /** custom exercises + overrides of built-in ones (same id) */
  exercises!: Table<Exercise, string>;
  kv!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('gym-log');
    this.version(1).stores({
      workouts: 'id, start, *exerciseIds, routineId',
      routines: 'id, order, folderId',
      folders: 'id, order',
      exercises: 'id, name',
      kv: 'key',
    });
  }
}

export const db = new GymDB();

export async function getKv<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

export function setKv(key: string, value: unknown) {
  return db.kv.put({ key, value });
}

export const KV_ACTIVE = 'activeWorkout';
export const KV_SETTINGS = 'settings';

export type { ActiveWorkout, Settings };
