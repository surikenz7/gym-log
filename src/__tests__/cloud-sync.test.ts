import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workout } from '../types';

/* An in-memory stand-in for Firestore, just enough for sync.ts. */
const store = new Map<string, Record<string, unknown>>();
type Cond = { field: string; op: string; v: number };
const fakeFs = {
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  collection: (_db: unknown, path: string) => ({ path }),
  where: (field: string, op: string, v: number): Cond => ({ field, op, v }),
  query: (col: { path: string }, ...conds: Cond[]) => ({ path: col.path, conds }),
  getDocs: async (q: { path: string; conds?: Cond[] }) => {
    const prefix = q.path + '/';
    const docs = [...store.entries()]
      .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .filter(([, v]) => (q.conds ?? []).every((c) => c.op !== '>' || (v[c.field] as number) > c.v))
      .map(([k, v]) => ({ id: k.slice(prefix.length), data: () => v }));
    return { docs };
  },
  getDoc: async (ref: { path: string }) => ({ exists: () => store.has(ref.path), data: () => store.get(ref.path) }),
  writeBatch: () => {
    const ops: [string, Record<string, unknown>, boolean][] = [];
    return {
      set: (ref: { path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => void ops.push([ref.path, data, !!opts?.merge]),
      commit: async () => {
        for (const [p, d, merge] of ops) store.set(p, merge ? { ...store.get(p), ...d } : d);
      },
    };
  },
};
vi.mock('../cloud/firebase', () => ({ firebase: async () => ({ db: {}, fs: fakeFs }) }));

const { db } = await import('../db/db');
const { syncNow, resetSyncState } = await import('../cloud/sync');

const w = (id: string, name: string): Workout => ({ id, name, start: 1000 + id.length, end: 5000, exerciseIds: [], exercises: [] });

/** A second phone: same account, empty local database. */
async function newDevice() {
  await Promise.all([db.workouts.clear(), db.routines.clear(), db.folders.clear(), db.exercises.clear(), db.measures.clear(), db.kv.clear()]);
  await resetSyncState();
}

describe('cloud sync', () => {
  beforeEach(async () => {
    store.clear();
    await newDevice();
  });

  it('backs up, restores on another device, and syncs edits and deletions', async () => {
    // phone A: two workouts → pushed
    await db.workouts.bulkPut([w('a', 'Push'), w('bb', 'Pull')]);
    const first = await syncNow('u1', { nick: 'erik' });
    expect(first.pushed).toBeGreaterThanOrEqual(3); // 2 workouts + bundle (+ profile)
    expect(store.get('users/u1')?.nick).toBe('erik');

    // nothing changed → nothing pushed again
    expect((await syncNow('u1', { nick: 'erik' })).pushed).toBe(0);

    // phone B starts empty and pulls everything
    await newDevice();
    await syncNow('u1', null);
    expect((await db.workouts.toArray()).map((x) => x.name).sort()).toEqual(['Pull', 'Push']);

    // phone B renames one and deletes the other
    await db.workouts.update('a', { name: 'Push Heavy' });
    await db.workouts.delete('bb');
    await syncNow('u1', null);
    expect(store.get('users/u1/workouts/bb')?.deleted).toBe(true);

    // phone A (fresh state again, same as reinstalling) sees the result
    await newDevice();
    await syncNow('u1', null);
    expect((await db.workouts.toArray()).map((x) => x.name)).toEqual(['Push Heavy']);
  });

  it('does not overwrite a local edit that has not been pushed yet', async () => {
    await db.workouts.put(w('a', 'Push'));
    await syncNow('u1', null);
    // local edit, then a sync whose pull window still contains our own older copy
    await db.workouts.update('a', { name: 'Push v2' });
    await syncNow('u1', null);
    expect((await db.workouts.get('a'))!.name).toBe('Push v2');
    expect(JSON.parse(store.get('users/u1/workouts/a')!.data as string).name).toBe('Push v2');
  });
});
