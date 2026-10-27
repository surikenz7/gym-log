import type { PeriodStats, QuestAvg, QuestKind, QuestWeek } from '../lib/compete';
import type { Routine, Workout } from '../types';
import { firebase } from './firebase';

/*
 *  users/{uid}                        public profile summary + `following` + `private`
 *  users/{uid}/followers/{fid}        { nick, avatar, status: 'pending' | 'accepted', at }
 *  users/{uid}/inbox/{id}             activity: tagged in a workout, follow, request accepted
 *  chats/{a_b}                        { members, nicks, last, readAt }
 *  chats/{a_b}/messages/{id}          { from, kind: 'text' | 'snap', text?, image?, viewed?, at }
 *  posts/{owner}/w/{workoutId}        { likes: { uid: nick }, comments: count }
 *  posts/{owner}/w/{workoutId}/comments/{id}   { from, nick, avatar, text, at }
 *  quests/{week_a_b}                  weekly Friends Quest: { members, nicks, avatars, week, kind, goal, from, at }
 */

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
  private?: boolean;
  updatedAt?: number;
  /** league stats: this / last week, this / last month */
  wk?: PeriodStats;
  pw?: PeriodStats;
  mo?: PeriodStats;
  pm?: PeriodStats;
  /** bodyweight & sex handicap; `fair` = both were set */
  coef?: number;
  fair?: boolean;
  /** monthly leagues won */
  golds?: number;
  /** Friends Quest stats: this week, average week */
  qw?: QuestWeek;
  qa?: QuestAvg;
}

export type FollowStatus = 'none' | 'pending' | 'accepted';

export interface Follower {
  uid: string;
  nick: string;
  avatar?: string | null;
  status: 'pending' | 'accepted';
  at: number;
}

export interface InboxItem {
  id: string;
  kind: 'tag' | 'follow' | 'accepted' | 'like' | 'comment' | 'quest' | 'story';
  from: string;
  nick: string;
  avatar?: string | null;
  workoutId?: string;
  workoutName?: string;
  /** comment text */
  text?: string;
  at: number;
  read?: boolean;
}

export interface Chat {
  id: string;
  members: string[];
  nicks: Record<string, string>;
  avatars?: Record<string, string | null>;
  last?: { text: string; from: string; at: number; kind: string };
  readAt?: Record<string, number>;
  /** chat theme id (shared by both people) */
  theme?: string;
  /** custom background photo (data URL) when theme is 'photo' */
  bgPhoto?: string | null;
}

export interface Message {
  id: string;
  from: string;
  kind: 'text' | 'snap';
  text?: string;
  image?: string;
  viewed?: boolean;
  at: number;
}

export const chatId = (a: string, b: string) => [a, b].sort().join('_');

/* ---------------- profiles ---------------- */

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
  const all = await Promise.all([...new Set(uids)].map((u) => getProfile(u).catch(() => null)));
  return all.filter(Boolean) as PublicProfile[];
}

/* ---------------- following ---------------- */

export async function followStatus(me: string, them: string): Promise<FollowStatus> {
  const { db, fs } = await firebase();
  const d = await fs.getDoc(fs.doc(db, 'users', them, 'followers', me));
  return d.exists() ? (d.data().status as FollowStatus) : 'none';
}

/** Follow (public account) or send a request (private account). */
export async function follow(me: { uid: string; nick: string; avatar?: string | null }, them: string): Promise<FollowStatus> {
  const { db, fs } = await firebase();
  const target = await getProfile(them);
  const status = target?.private ? 'pending' : 'accepted';
  await fs.setDoc(fs.doc(db, 'users', them, 'followers', me.uid), { nick: me.nick, avatar: me.avatar ?? null, status, at: Date.now() });
  await fs.setDoc(fs.doc(db, 'users', me.uid), { following: fs.arrayUnion(them) }, { merge: true });
  if (status === 'accepted') await notify(them, { kind: 'follow', from: me.uid, nick: me.nick, avatar: me.avatar ?? null });
  return status;
}

export async function unfollow(me: string, them: string) {
  const { db, fs } = await firebase();
  await fs.deleteDoc(fs.doc(db, 'users', them, 'followers', me)).catch(() => {});
  await fs.setDoc(fs.doc(db, 'users', me), { following: fs.arrayRemove(them) }, { merge: true });
}

export async function getFollowers(uid: string): Promise<Follower[]> {
  const { db, fs } = await firebase();
  const snap = await fs.getDocs(fs.collection(db, 'users', uid, 'followers'));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Follower, 'uid'>) })).sort((a, b) => b.at - a.at);
}

export async function acceptRequest(me: { uid: string; nick: string; avatar?: string | null }, fid: string) {
  const { db, fs } = await firebase();
  await fs.updateDoc(fs.doc(db, 'users', me.uid, 'followers', fid), { status: 'accepted' });
  await notify(fid, { kind: 'accepted', from: me.uid, nick: me.nick, avatar: me.avatar ?? null });
}

/** Decline a request or remove a follower. */
export async function removeFollower(me: string, fid: string) {
  const { db, fs } = await firebase();
  await fs.deleteDoc(fs.doc(db, 'users', me, 'followers', fid));
}

/** Going public accepts everyone who was waiting (like Instagram). */
export async function setPrivate(me: { uid: string; nick: string; avatar?: string | null }, on: boolean) {
  const { db, fs } = await firebase();
  await fs.setDoc(fs.doc(db, 'users', me.uid), { private: on }, { merge: true });
  if (!on) for (const f of await getFollowers(me.uid)) if (f.status === 'pending') await acceptRequest(me, f.uid);
}

/** Accounts followed before follow requests existed get their follower entry created once. */
export async function repairFollowing(me: { uid: string; nick: string; avatar?: string | null }, following: string[]) {
  const { db, fs } = await firebase();
  for (const them of following) {
    const d = await fs.getDoc(fs.doc(db, 'users', them, 'followers', me.uid)).catch(() => null);
    if (d && !d.exists()) await follow(me, them).catch(() => {});
  }
}

/* ---------------- activity inbox ---------------- */

export async function notify(to: string, item: Omit<InboxItem, 'id' | 'at'>) {
  const { db, fs } = await firebase();
  await fs.addDoc(fs.collection(db, 'users', to, 'inbox'), { ...item, at: Date.now(), read: false });
}

export async function getInbox(uid: string): Promise<InboxItem[]> {
  const { db, fs } = await firebase();
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'users', uid, 'inbox'), fs.orderBy('at', 'desc'), fs.limit(50)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InboxItem, 'id'>) }));
}

export async function markInboxRead(uid: string, items: InboxItem[]) {
  const { db, fs } = await firebase();
  await Promise.all(items.filter((i) => !i.read).map((i) => fs.updateDoc(fs.doc(db, 'users', uid, 'inbox', i.id), { read: true })));
}

/* ---------------- workouts & routines of others ---------------- */

export async function getWorkouts(uid: string, n = 15): Promise<Workout[]> {
  const { db, fs } = await firebase();
  const snap = await fs.getDocs(fs.query(fs.collection(db, `users/${uid}/workouts`), fs.orderBy('start', 'desc'), fs.limit(n + 10)));
  return snap.docs
    .map((d) => d.data() as { data?: string; deleted?: boolean })
    .filter((v) => !v.deleted && v.data)
    .map((v) => JSON.parse(v.data!) as Workout)
    .slice(0, n);
}

export async function getWorkout(uid: string, id: string): Promise<Workout | null> {
  const { db, fs } = await firebase();
  const d = await fs.getDoc(fs.doc(db, 'users', uid, 'workouts', id));
  const v = d.data() as { data?: string; deleted?: boolean } | undefined;
  return v?.data && !v.deleted ? (JSON.parse(v.data) as Workout) : null;
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

/* ---------------- chats ---------------- */

export async function openChat(me: { uid: string; nick: string; avatar?: string | null }, them: PublicProfile): Promise<string> {
  const { db, fs } = await firebase();
  const id = chatId(me.uid, them.uid);
  const ref = fs.doc(db, 'chats', id);
  const d = await fs.getDoc(ref);
  if (!d.exists())
    await fs.setDoc(ref, {
      members: [me.uid, them.uid].sort(),
      nicks: { [me.uid]: me.nick, [them.uid]: them.nick },
      avatars: { [me.uid]: me.avatar ?? null, [them.uid]: them.avatar ?? null },
      readAt: { [me.uid]: Date.now() },
    });
  return id;
}

export async function sendMessage(chat: string, me: string, msg: { kind: 'text'; text: string } | { kind: 'snap'; image: string }) {
  const { db, fs } = await firebase();
  const at = Date.now();
  await fs.addDoc(fs.collection(db, 'chats', chat, 'messages'), { ...msg, from: me, at, ...(msg.kind === 'snap' ? { viewed: false } : {}) });
  await fs.updateDoc(fs.doc(db, 'chats', chat), {
    last: { text: msg.kind === 'text' ? msg.text.slice(0, 120) : '📸 Snap', from: me, at, kind: msg.kind },
    [`readAt.${me}`]: at,
  });
  void import('./push').then((p) => p.pingChat(chat));
}

/** A snap disappears after it's been opened once. */
export async function markSnapViewed(chat: string, id: string) {
  const { db, fs } = await firebase();
  await fs.updateDoc(fs.doc(db, 'chats', chat, 'messages', id), { viewed: true, image: fs.deleteField() });
}

export async function markChatRead(chat: string, me: string) {
  const { db, fs } = await firebase();
  await fs.updateDoc(fs.doc(db, 'chats', chat), { [`readAt.${me}`]: Date.now() }).catch(() => {});
}

export function watchChat(chat: string, cb: (m: Message[]) => void) {
  let stop = () => {};
  let dead = false;
  void firebase().then(({ db, fs }) => {
    if (dead) return;
    stop = fs.onSnapshot(fs.query(fs.collection(db, 'chats', chat, 'messages'), fs.orderBy('at', 'asc'), fs.limitToLast(150)), (s) =>
      cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }))),
    );
  });
  return () => {
    dead = true;
    stop();
  };
}

export async function setChatTheme(chat: string, theme: string, bgPhoto: string | null = null) {
  const { db, fs } = await firebase();
  await fs.updateDoc(fs.doc(db, 'chats', chat), { theme, bgPhoto });
}

export function watchChatDoc(chat: string, cb: (c: Chat | null) => void) {
  let stop = () => {};
  let dead = false;
  void firebase().then(({ db, fs }) => {
    if (dead) return;
    stop = fs.onSnapshot(fs.doc(db, 'chats', chat), (d) => cb(d.exists() ? ({ id: d.id, ...d.data() } as Chat) : null), () => cb(null));
  });
  return () => {
    dead = true;
    stop();
  };
}

export function watchChats(me: string, cb: (c: Chat[]) => void) {
  let stop = () => {};
  let dead = false;
  void firebase().then(({ db, fs }) => {
    if (dead) return;
    stop = fs.onSnapshot(
      fs.query(fs.collection(db, 'chats'), fs.where('members', 'array-contains', me)),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Chat, 'id'>) })).sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0))),
      () => cb([]),
    );
  });
  return () => {
    dead = true;
    stop();
  };
}

export function watchCollection<T>(path: string[], cb: (rows: (T & { id: string })[]) => void) {
  let stop = () => {};
  let dead = false;
  void firebase().then(({ db, fs }) => {
    if (dead) return;
    stop = fs.onSnapshot(
      fs.collection(db, path[0], ...path.slice(1)),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))),
      () => cb([]),
    );
  });
  return () => {
    dead = true;
    stop();
  };
}

export const unread = (c: Chat, me: string) => !!c.last && c.last.from !== me && (c.readAt?.[me] ?? 0) < c.last.at;

/* ---------------- likes & comments ---------------- */

export interface Post {
  likes: Record<string, string>;
  comments: number;
}

export interface Comment {
  id: string;
  from: string;
  nick: string;
  avatar?: string | null;
  text: string;
  at: number;
}

export async function getPost(owner: string, wid: string): Promise<Post> {
  const { db, fs } = await firebase();
  const d = await fs.getDoc(fs.doc(db, 'posts', owner, 'w', wid));
  const v = d.data() as Partial<Post> | undefined;
  return { likes: v?.likes ?? {}, comments: Math.max(0, v?.comments ?? 0) };
}

export async function setLike(owner: string, w: Pick<Workout, 'id' | 'name'>, me: { uid: string; nick: string; avatar?: string | null }, on: boolean) {
  const { db, fs } = await firebase();
  await fs.setDoc(fs.doc(db, 'posts', owner, 'w', w.id), { likes: { [me.uid]: on ? me.nick : fs.deleteField() } }, { merge: true });
  if (on && owner !== me.uid) await notify(owner, { kind: 'like', from: me.uid, nick: me.nick, avatar: me.avatar ?? null, workoutId: w.id, workoutName: w.name }).catch(() => {});
}

export async function addComment(owner: string, w: Pick<Workout, 'id' | 'name'>, me: { uid: string; nick: string; avatar?: string | null }, text: string) {
  const { db, fs } = await firebase();
  const body = text.trim().slice(0, 500);
  await fs.addDoc(fs.collection(db, 'posts', owner, 'w', w.id, 'comments'), { from: me.uid, nick: me.nick, avatar: me.avatar ?? null, text: body, at: Date.now() });
  await fs.setDoc(fs.doc(db, 'posts', owner, 'w', w.id), { comments: fs.increment(1) }, { merge: true });
  if (owner !== me.uid) await notify(owner, { kind: 'comment', from: me.uid, nick: me.nick, avatar: me.avatar ?? null, workoutId: w.id, workoutName: w.name, text: body.slice(0, 120) }).catch(() => {});
}

export async function deleteComment(owner: string, wid: string, id: string) {
  const { db, fs } = await firebase();
  await fs.deleteDoc(fs.doc(db, 'posts', owner, 'w', wid, 'comments', id));
  await fs.setDoc(fs.doc(db, 'posts', owner, 'w', wid), { comments: fs.increment(-1) }, { merge: true });
}

export function watchComments(owner: string, wid: string, cb: (c: Comment[]) => void) {
  let stop = () => {};
  let dead = false;
  void firebase().then(({ db, fs }) => {
    if (dead) return;
    stop = fs.onSnapshot(
      fs.query(fs.collection(db, 'posts', owner, 'w', wid, 'comments'), fs.orderBy('at', 'asc'), fs.limitToLast(200)),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) }))),
      () => cb([]),
    );
  });
  return () => {
    dead = true;
    stop();
  };
}

/* ---------------- friends quests ---------------- */

export interface Quest {
  id: string;
  members: string[];
  nicks: Record<string, string>;
  avatars?: Record<string, string | null>;
  week: string;
  kind: QuestKind;
  goal: number;
  from: string;
  at: number;
  done?: boolean;
}

export async function startQuest(me: { uid: string; nick: string; avatar?: string | null }, them: PublicProfile, week: string, kind: QuestKind, goal: number) {
  const { db, fs } = await firebase();
  const members = [me.uid, them.uid].sort();
  const id = `${week}_${members.join('_')}`;
  await fs.setDoc(fs.doc(db, 'quests', id), {
    members,
    nicks: { [me.uid]: me.nick, [them.uid]: them.nick },
    avatars: { [me.uid]: me.avatar ?? null, [them.uid]: them.avatar ?? null },
    week,
    kind,
    goal,
    from: me.uid,
    at: Date.now(),
  });
  await notify(them.uid, { kind: 'quest', from: me.uid, nick: me.nick, avatar: me.avatar ?? null }).catch(() => {});
  return id;
}

export async function finishQuest(id: string) {
  const { db, fs } = await firebase();
  await fs.updateDoc(fs.doc(db, 'quests', id), { done: true }).catch(() => {});
}

export async function leaveQuest(id: string) {
  const { db, fs } = await firebase();
  await fs.deleteDoc(fs.doc(db, 'quests', id));
}

export function watchQuests(me: string, cb: (q: Quest[]) => void) {
  let stop = () => {};
  let dead = false;
  void firebase().then(({ db, fs }) => {
    if (dead) return;
    stop = fs.onSnapshot(
      fs.query(fs.collection(db, 'quests'), fs.where('members', 'array-contains', me)),
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Quest, 'id'>) })).sort((a, b) => b.at - a.at)),
      () => cb([]),
    );
  });
  return () => {
    dead = true;
    stop();
  };
}
