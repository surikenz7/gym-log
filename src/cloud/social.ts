import type { Routine, Workout } from '../types';
import { firebase } from './firebase';

/** What everyone you follow can see on your profile (users/{uid}). */
export interface PublicProfile {
  uid: string;
  nick: string;
  nickLower: string;
  avatar?: string | null;
  deco?: string | null;
  theme?: string;
  level?: number;
  title?: string;
  overall?: number | null;
  workouts?: number;
  streak?: number;
  trophies?: number;
  volume?: number;
  decos?: number;
  following?: string[];
  updatedAt?: number;
}

export async function findUser(nick: string): Promise<PublicProfile | null> {
  const { db, fs } = await firebase();
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'users'), fs.where('nickLower', '==', nick.trim().toLowerCase()), fs.limit(1)));
  const d = snap.docs[0];
  return d ? ({ uid: d.id, ...d.data() } as PublicProfile) : null;
}

export async function getProfile(uid: string): Promise<PublicProfile | null> {
  const { db, fs } = await firebase();
  const d = await fs.getDoc(fs.doc(db, 'users', uid));
  return d.exists() ? ({ uid: d.id, ...d.data() } as PublicProfile) : null;
}

export async function getProfiles(uids: string[]): Promise<PublicProfile[]> {
  const all = await Promise.all(uids.map((u) => getProfile(u).catch(() => null)));
  return all.filter(Boolean) as PublicProfile[];
}

export async function follow(me: string, them: string, on: boolean) {
  const { db, fs } = await firebase();
  await fs.setDoc(fs.doc(db, 'users', me), { following: on ? fs.arrayUnion(them) : fs.arrayRemove(them) }, { merge: true });
}

export async function getWorkouts(uid: string, n = 15): Promise<Workout[]> {
  const { db, fs } = await firebase();
  const snap = await fs.getDocs(fs.query(fs.collection(db, `users/${uid}/workouts`), fs.orderBy('start', 'desc'), fs.limit(n + 10)));
  return snap.docs
    .map((d) => d.data() as { data?: string; deleted?: boolean })
    .filter((v) => !v.deleted && v.data)
    .map((v) => JSON.parse(v.data!) as Workout)
    .slice(0, n);
}

export async function getRoutines(uid: string): Promise<Routine[]> {
  const { db, fs } = await firebase();
  const snap = await fs.getDocs(fs.collection(db, `users/${uid}/routines`));
  return snap.docs
    .map((d) => d.data() as { data?: string; deleted?: boolean })
    .filter((v) => !v.deleted && v.data)
    .map((v) => JSON.parse(v.data!) as Routine)
    .sort((a, b) => a.order - b.order);
}
