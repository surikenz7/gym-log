import type { Song } from '../lib/music';
import { firebase } from './firebase';
import { notify } from './social';

/*
 * Stories and notes, like Instagram: both disappear after 24 hours and are visible to whoever may
 * see your workouts (everyone for public accounts, approved followers for private ones).
 *
 *  stories/{uid}                          { last: newest story time, note?: Note }
 *  stories/{uid}/items/{id}               { img: JPEG data URL (1080×1920), at, song? }
 *  stories/{uid}/items/{id}/views/{viewer} { nick, avatar, at, like? }
 */

export const DAY = 24 * 3600e3;

export interface Note {
  text: string;
  song?: Song | null;
  at: number;
}
export interface StoryMeta {
  last?: number;
  note?: Note | null;
}
export interface Story {
  id: string;
  img: string;
  at: number;
  song?: Song | null;
}
export interface StoryView {
  uid: string;
  nick: string;
  avatar?: string | null;
  at: number;
  like?: boolean;
}
type Me = { uid: string; nick: string; avatar?: string | null };

export const liveNote = (m: StoryMeta | null | undefined) => (m?.note && Date.now() - m.note.at < DAY ? m.note : null);
export const hasStory = (m: StoryMeta | null | undefined) => !!m?.last && Date.now() - m.last < DAY;

/** Story / note summary of one person (null when you may not see it). */
export async function getStoryMeta(uid: string): Promise<StoryMeta | null> {
  const { db, fs } = await firebase();
  try {
    const d = await fs.getDoc(fs.doc(db, 'stories', uid));
    return d.exists() ? (d.data() as StoryMeta) : {};
  } catch {
    return null;
  }
}

/** Someone's stories from the last 24 hours, oldest first. */
export async function getStories(uid: string): Promise<Story[]> {
  const { db, fs } = await firebase();
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'stories', uid, 'items'), fs.where('at', '>', Date.now() - DAY), fs.orderBy('at')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Story, 'id'>) }));
}

async function removeItem(uid: string, id: string) {
  const { db, fs } = await firebase();
  const views = await fs.getDocs(fs.collection(db, 'stories', uid, 'items', id, 'views'));
  await Promise.all(views.docs.map((v) => fs.deleteDoc(v.ref)));
  await fs.deleteDoc(fs.doc(db, 'stories', uid, 'items', id));
}

/** Expired stories are deleted by their owner's app (Firestore has no free TTL). */
async function sweep(uid: string) {
  const { db, fs } = await firebase();
  const old = await fs.getDocs(fs.query(fs.collection(db, 'stories', uid, 'items'), fs.where('at', '<=', Date.now() - DAY)));
  for (const d of old.docs) await removeItem(uid, d.id).catch(() => {});
}

export async function postStory(uid: string, img: string, song: Song | null) {
  const { db, fs } = await firebase();
  const at = Date.now();
  await fs.addDoc(fs.collection(db, 'stories', uid, 'items'), { img, at, ...(song ? { song } : {}) });
  await fs.setDoc(fs.doc(db, 'stories', uid), { last: at }, { merge: true });
  void sweep(uid);
}

export async function deleteStory(uid: string, id: string) {
  const { db, fs } = await firebase();
  await removeItem(uid, id);
  const rest = await getStories(uid);
  await fs.setDoc(fs.doc(db, 'stories', uid), { last: rest.length ? rest[rest.length - 1].at : 0 }, { merge: true });
}

export async function setNote(uid: string, note: Note | null) {
  const { db, fs } = await firebase();
  await fs.setDoc(fs.doc(db, 'stories', uid), { note }, { merge: true });
}

/** Marks a story as seen (and optionally liked); the owner sees it in "Seen by". */
export async function markViewed(owner: string, id: string, me: Me, like?: boolean) {
  const { db, fs } = await firebase();
  await fs.setDoc(fs.doc(db, 'stories', owner, 'items', id, 'views', me.uid), { nick: me.nick, avatar: me.avatar ?? null, at: Date.now(), ...(like !== undefined ? { like } : {}) }, { merge: true });
  if (like) await notify(owner, { kind: 'story', from: me.uid, nick: me.nick, avatar: me.avatar ?? null }).catch(() => {});
}

export async function getViews(owner: string, id: string): Promise<StoryView[]> {
  const { db, fs } = await firebase();
  const snap = await fs.getDocs(fs.collection(db, 'stories', owner, 'items', id, 'views'));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<StoryView, 'uid'>) })).sort((a, b) => b.at - a.at);
}
