import { useEffect } from 'react';
import { create } from 'zustand';
import { useSettings } from '../state/settings';
import type { Workout } from '../types';
import { useAccount } from './account';
import { unread, type Chat, type Follower, type InboxItem } from './social';

interface SocialState {
  chats: Chat[];
  followers: Follower[];
  inbox: InboxItem[];
}

/** Live friends / requests / messages / activity for the signed-in user. */
export const useSocial = create<SocialState>(() => ({ chats: [], followers: [], inbox: [] }));

export function useBadges() {
  const uid = useAccount((a) => a.uid);
  const s = useSocial();
  const messages = uid ? s.chats.filter((c) => unread(c, uid)).length : 0;
  const requests = s.followers.filter((f) => f.status === 'pending').length;
  const activity = s.inbox.filter((i) => !i.read).length;
  return { messages, requests, activity, total: messages + requests + activity };
}

export function SocialSync() {
  const uid = useAccount((a) => a.uid);
  const status = useAccount((a) => a.status);
  useEffect(() => {
    resetBannerState();
    if (status !== 'signedIn' || !uid) {
      useSocial.setState({ chats: [], followers: [], inbox: [] });
      return;
    }
    let stops: (() => void)[] = [];
    let dead = false;
    void import('./social').then((s) => {
      if (dead) return;
      stops = [
        s.watchChats(uid, (chats) => {
          useSocial.setState({ chats });
          noticeNewMessages(uid, chats);
        }),
        s.watchCollection<Omit<Follower, 'uid'>>(['users', uid, 'followers'], (rows) =>
          useSocial.setState({ followers: rows.map(({ id, ...r }) => ({ uid: id, ...r })).sort((a, b) => b.at - a.at) }),
        ),
        s.watchCollection<Omit<InboxItem, 'id'>>(['users', uid, 'inbox'], (rows) => useSocial.setState({ inbox: rows.sort((a, b) => b.at - a.at).slice(0, 60) })),
      ];
      void import('./push').then((p) => p.refreshPush(uid));
      // follows made before requests existed
      const me = { uid, nick: useAccount.getState().nick ?? '', avatar: useSettings.getState().avatar };
      void s.getProfile(uid).then((p) => {
        if (p?.following?.length) void s.repairFollowing(me, p.following);
      });
    });
    return () => {
      dead = true;
      stops.forEach((f) => f());
    };
  }, [uid, status]);
  return null;
}

export interface FeedItem {
  author: { uid: string; nick: string; avatar?: string | null; deco?: string | null };
  w: Workout;
}

/** Recent workouts of people you follow, for the Home feed (refreshed at most once a minute). */
export const useFeed = create<{ items: FeedItem[]; at: number; loading: boolean }>(() => ({ items: [], at: 0, loading: false }));

export async function refreshFeed(force = false) {
  const { uid, following, status } = useAccount.getState();
  const st = useFeed.getState();
  if (status !== 'signedIn' || !uid || st.loading || (!force && Date.now() - st.at < 60_000)) return;
  useFeed.setState({ loading: true });
  try {
    const s = await import('./social');
    const profiles = await s.getProfiles(following);
    const lists = await Promise.all(
      profiles.map(async (p) => {
        // private accounts that haven't approved you simply return nothing
        const ws = await s.getWorkouts(p.uid, 8).catch(() => [] as Workout[]);
        return ws.map((w) => ({ author: { uid: p.uid, nick: p.nick, avatar: p.avatar, deco: p.deco }, w }));
      }),
    );
    useFeed.setState({ items: lists.flat(), at: Date.now() });
  } finally {
    useFeed.setState({ loading: false });
  }
}

/* ---------------- in-app banner for new messages ---------------- */

export interface Banner {
  key: number;
  uid: string;
  nick: string;
  avatar?: string | null;
  text: string;
}
export const useBanner = create<{ banner: Banner | null }>(() => ({ banner: null }));

let seen = new Map<string, number>();
let primed = false;

/** Called with every chat-list update: pops a banner for messages that arrived just now. */
export function noticeNewMessages(me: string, chats: Chat[]) {
  if (!primed) {
    seen = new Map(chats.map((c) => [c.id, c.last?.at ?? 0]));
    primed = true;
    return;
  }
  for (const c of chats) {
    const at = c.last?.at ?? 0;
    if (at <= (seen.get(c.id) ?? 0)) continue;
    seen.set(c.id, at);
    if (!c.last || c.last.from === me) continue;
    const other = c.members.find((m) => m !== me)!;
    // already looking at this chat
    if (location.hash.startsWith(`#/chat/${other}`)) continue;
    useBanner.setState({ banner: { key: at, uid: other, nick: c.nicks[other], avatar: c.avatars?.[other], text: c.last.kind === 'snap' ? '📸 Snap' : c.last.text } });
  }
}

export function resetBannerState() {
  primed = false;
  seen = new Map();
}
