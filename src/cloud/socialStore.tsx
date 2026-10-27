import { useEffect } from 'react';
import { create } from 'zustand';
import { useSettings } from '../state/settings';
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
    if (status !== 'signedIn' || !uid) {
      useSocial.setState({ chats: [], followers: [], inbox: [] });
      return;
    }
    let stops: (() => void)[] = [];
    let dead = false;
    void import('./social').then((s) => {
      if (dead) return;
      stops = [
        s.watchChats(uid, (chats) => useSocial.setState({ chats })),
        s.watchCollection<Omit<Follower, 'uid'>>(['users', uid, 'followers'], (rows) =>
          useSocial.setState({ followers: rows.map(({ id, ...r }) => ({ uid: id, ...r })).sort((a, b) => b.at - a.at) }),
        ),
        s.watchCollection<Omit<InboxItem, 'id'>>(['users', uid, 'inbox'], (rows) => useSocial.setState({ inbox: rows.sort((a, b) => b.at - a.at).slice(0, 60) })),
      ];
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
