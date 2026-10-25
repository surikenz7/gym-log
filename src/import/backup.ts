import { db, getKv, KV_SETTINGS, setKv } from '../db/db';
import { useLibrary } from '../lib/exercises';
import { loadSettings } from '../state/settings';

export async function exportBackup() {
  const data = {
    app: 'gym-log',
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: await db.workouts.toArray(),
    routines: await db.routines.toArray(),
    folders: await db.folders.toArray(),
    exercises: await db.exercises.toArray(),
    settings: await getKv(KV_SETTINGS),
  };
  const name = `gym-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  // iOS: the share sheet lets you "Save to Files" / Google Drive etc.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Merges a backup into the current data (same ids are overwritten). Returns counts. */
export async function importBackup(text: string) {
  const d = JSON.parse(text);
  if (d?.app !== 'gym-log') throw new Error('Not a Gym Log backup file.');
  await db.transaction('rw', [db.workouts, db.routines, db.folders, db.exercises, db.kv], async () => {
    await db.workouts.bulkPut(d.workouts ?? []);
    await db.routines.bulkPut(d.routines ?? []);
    await db.folders.bulkPut(d.folders ?? []);
    await db.exercises.bulkPut(d.exercises ?? []);
    if (d.settings) await setKv(KV_SETTINGS, d.settings);
  });
  await loadSettings();
  await useLibrary.getState().reload();
  return { workouts: d.workouts?.length ?? 0, routines: d.routines?.length ?? 0 };
}
