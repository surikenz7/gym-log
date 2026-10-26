import { db, getKv, KV_SETTINGS, setKv } from '../db/db';
import { useLibrary } from '../lib/exercises';
import { loadSettings } from '../state/settings';
import type { Folder, Exercise, Measure, Routine, Settings, Workout } from '../types';
import { firebase } from './firebase';

/**
 * Two-way sync between this device (IndexedDB) and Firestore.
 *
 *   users/{uid}                    public profile summary (see social.ts)
 *   users/{uid}/workouts/{id}      { start, data: JSON, updatedAt, deleted? }   readable by friends
 *   users/{uid}/routines/{id}      { name, data: JSON, updatedAt, deleted? }    readable by friends
 *   users/{uid}/private/bundle     { data: JSON(folders, exercises, measures, settings), updatedAt }  owner only
 *
 * Each record is pushed only when its content hash changed; deletions are pushed as tombstones so
 * other devices remove them too. Pulls fetch only what changed since the last sync.
 */

const KV_CLOUD = 'cloudSync';
/** devices' clocks are never perfectly in step, so each pull overlaps the previous one a little */
const CLOCK_SLACK = 10 * 60e3;

interface SyncState {
  uid: string;
  pulledAt: number;
  w: Record<string, string>;
  r: Record<string, string>;
  bundle?: string;
  profile?: string;
}

/** cyrb53 — a fast, well-mixed 53-bit string hash */
export function hash(s: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

interface Bundle {
  folders: Folder[];
  exercises: Exercise[];
  measures: Measure[];
  settings: Partial<Settings> | undefined;
}

async function localBundle(): Promise<Bundle> {
  return {
    folders: await db.folders.toArray(),
    exercises: await db.exercises.toArray(),
    measures: await db.measures.toArray(),
    settings: await getKv<Partial<Settings>>(KV_SETTINGS),
  };
}

async function loadState(uid: string): Promise<SyncState> {
  const s = await getKv<SyncState>(KV_CLOUD);
  return s && s.uid === uid ? s : { uid, pulledAt: 0, w: {}, r: {} };
}

export async function resetSyncState() {
  await db.kv.delete(KV_CLOUD);
}

export interface SyncResult {
  pulled: number;
  pushed: number;
}

export async function syncNow(uid: string, profile: Record<string, unknown> | null): Promise<SyncResult> {
  const { db: fdb, fs } = await firebase();
  const st = await loadState(uid);
  const base = `users/${uid}`;
  const started = Date.now();
  let pulled = 0;
  let pushed = 0;

  // ---------- pull: anything another device changed since our last sync ----------
  for (const [name, table, key] of [
    ['workouts', db.workouts, 'w'],
    ['routines', db.routines, 'r'],
  ] as const) {
    const snap = await fs.getDocs(fs.query(fs.collection(fdb, `${base}/${name}`), fs.where('updatedAt', '>', st.pulledAt ? st.pulledAt - CLOCK_SLACK : 0)));
    for (const d of snap.docs) {
      const v = d.data() as { data?: string; deleted?: boolean };
      if (v.deleted) {
        if (!(d.id in st[key])) continue; // already gone here
        await table.delete(d.id);
        delete st[key][d.id];
      } else if (v.data) {
        const h = hash(v.data);
        // same version we last synced → keep the local copy (it may have newer, unpushed edits)
        if (st[key][d.id] === h) continue;
        await (table as typeof db.workouts).put(JSON.parse(v.data));
        st[key][d.id] = h;
      }
      pulled++;
    }
  }
  const bundleSnap = await fs.getDoc(fs.doc(fdb, `${base}/private/bundle`));
  if (bundleSnap.exists()) {
    const v = bundleSnap.data() as { data: string; updatedAt: number };
    if (v.updatedAt > st.pulledAt && hash(v.data) !== st.bundle) {
      const b = JSON.parse(v.data) as Bundle;
      await db.transaction('rw', db.folders, db.exercises, db.measures, db.kv, async () => {
        await db.folders.bulkPut(b.folders ?? []);
        await db.exercises.bulkPut(b.exercises ?? []);
        await db.measures.bulkPut(b.measures ?? []);
        if (b.settings) await setKv(KV_SETTINGS, { ...(await getKv<object>(KV_SETTINGS)), ...b.settings });
      });
      await loadSettings();
      await useLibrary.getState().reload();
      pulled++;
    }
  }

  // ---------- push: new / changed / deleted records ----------
  let batch = fs.writeBatch(fdb);
  let ops = 0;
  const queue = async (path: string, data: Record<string, unknown>) => {
    batch.set(fs.doc(fdb, path), data);
    pushed++;
    if (++ops >= 400) {
      await batch.commit();
      batch = fs.writeBatch(fdb);
      ops = 0;
    }
  };
  const now = Date.now();
  for (const [name, rows, key] of [
    ['workouts', (await db.workouts.toArray()) as (Workout | Routine)[], 'w'],
    ['routines', (await db.routines.toArray()) as (Workout | Routine)[], 'r'],
  ] as const) {
    const seen = new Set<string>();
    for (const row of rows) {
      seen.add(row.id);
      const data = JSON.stringify(row);
      const h = hash(data);
      if (st[key][row.id] === h) continue;
      const extra = 'start' in row ? { start: row.start } : { name: row.name };
      await queue(`${base}/${name}/${row.id}`, { ...extra, data, updatedAt: now });
      st[key][row.id] = h;
    }
    for (const id of Object.keys(st[key])) {
      if (seen.has(id)) continue;
      await queue(`${base}/${name}/${id}`, { deleted: true, updatedAt: now });
      delete st[key][id];
    }
  }
  const bundle = JSON.stringify(await localBundle());
  if (hash(bundle) !== st.bundle) {
    await queue(`${base}/private/bundle`, { data: bundle, updatedAt: now });
    st.bundle = hash(bundle);
  }
  if (profile) {
    const ph = hash(JSON.stringify(profile));
    if (ph !== st.profile) {
      batch.set(fs.doc(fdb, base), { ...profile, updatedAt: now }, { merge: true });
      ops++;
      pushed++;
      st.profile = ph;
    }
  }
  if (ops) await batch.commit();

  // next time, pull everything written since just before this sync began
  st.pulledAt = Math.max(st.pulledAt, started - 1);
  await setKv(KV_CLOUD, st);
  return { pulled, pushed };
}
