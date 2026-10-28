import { create } from 'zustand';
import { useAccount } from './account';
import { hasStory, liveNote, type Story, type StoryMeta } from './stories';

/** Someone you follow who has a story or a note up right now. */
export interface StoryEntry {
  uid: string;
  nick: string;
  avatar?: string | null;
  meta: StoryMeta;
}

interface StoryState {
  me: StoryMeta | null;
  friends: StoryEntry[];
  at: number;
  loading: boolean;
  /** uid → time of the newest story you've watched */
  seen: Record<string, number>;
  /** loaded stories per person (images), for the viewer */
  cache: Record<string, { at: number; list: Story[] }>;
}

const SEEN_KEY = 'storySeen';
const loadSeen = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
  } catch {
    return {};
  }
};

export const useStories = create<StoryState>(() => ({ me: null, friends: [], at: 0, loading: false, seen: loadSeen(), cache: {} }));

/** Friends' stories and notes for the tray (refreshed at most once a minute unless forced). */
export async function refreshStories(force = false) {
  const { uid, following, status } = useAccount.getState();
  const st = useStories.getState();
  if (status !== 'signedIn' || !uid || st.loading || (!force && Date.now() - st.at < 60_000)) return;
  useStories.setState({ loading: true });
  try {
    const [s, social] = await Promise.all([import('./stories'), import('./social')]);
    const [me, profiles] = await Promise.all([s.getStoryMeta(uid), social.getProfiles(following)]);
    const metas = await Promise.all(profiles.map((p) => s.getStoryMeta(p.uid)));
    const friends = profiles.flatMap((p, i) => (metas[i] && (hasStory(metas[i]) || liveNote(metas[i])) ? [{ uid: p.uid, nick: p.nick, avatar: p.avatar, meta: metas[i]! }] : []));
    useStories.setState({ me, friends, at: Date.now() });
  } finally {
    useStories.setState({ loading: false });
  }
}

export function markSeen(uid: string, at: number) {
  const seen = { ...useStories.getState().seen, [uid]: Math.max(at, useStories.getState().seen[uid] ?? 0) };
  useStories.setState({ seen });
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* private mode */
  }
}

/** Ring around someone's picture: 'new' (unwatched story), 'seen', or null (no story). */
export function useStoryRing(uid: string | null | undefined): 'new' | 'seen' | null {
  return useStories((s) => {
    if (!uid) return null;
    const meta = uid === useAccount.getState().uid ? s.me : s.friends.find((f) => f.uid === uid)?.meta;
    if (!hasStory(meta)) return null;
    return (s.seen[uid] ?? 0) >= meta!.last! ? 'seen' : 'new';
  });
}

/** Viewer queue: the people whose stories play one after another (tray order). */
export function storyQueue(start: string): string[] {
  const { friends, seen } = useStories.getState();
  const myUid = useAccount.getState().uid;
  if (start === myUid) return [start];
  const withStory = friends.filter((f) => hasStory(f.meta));
  const ordered = [...withStory.filter((f) => (seen[f.uid] ?? 0) < f.meta.last!), ...withStory.filter((f) => (seen[f.uid] ?? 0) >= f.meta.last!)].map((f) => f.uid);
  const i = ordered.indexOf(start);
  return i < 0 ? [start] : ordered.slice(i);
}

/** Picture to start the next story with (e.g. "Add to story" on a workout). */
export const useStoryDraft = create<{ img: Blob | null }>(() => ({ img: null }));

/*
 * The story editor and viewer are overlays, not routes: as pages they stayed in the browser history,
 * and iOS's swipe from the right edge ("forward") reopened them after you'd closed them.
 */
export const useStoryUI = create<{ editor: boolean; viewer: string | null }>(() => ({ editor: false, viewer: null }));
export const openStoryEditor = (img?: Blob) => {
  if (img) useStoryDraft.setState({ img });
  useStoryUI.setState({ editor: true, viewer: null });
};
export const openStory = (uid: string) => useStoryUI.setState({ viewer: uid, editor: false });
export const closeStoryUI = () => useStoryUI.setState({ editor: false, viewer: null });
