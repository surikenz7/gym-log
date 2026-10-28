import { formatDistanceToNowStrict } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { CirclePlus, Heart, MessageCircle, Send, Share2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useAccount } from '../cloud/account';
import type { Comment, Post } from '../cloud/social';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { shareWorkout, workoutImage } from '../lib/shareWorkout';
import { openStoryEditor } from '../cloud/storyStore';
import { toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import type { Workout } from '../types';
import { Sheet } from './ui';
import { Avatar } from './WorkoutFeed';

const social = () => import('../cloud/social');

/** Likes / comment counts, cached for the session so the feed doesn't refetch on every scroll. */
const usePosts = create<{ posts: Record<string, Post & { at: number }> }>(() => ({ posts: {} }));
const keyOf = (owner: string, wid: string) => `${owner}/${wid}`;
const patch = (k: string, p: Partial<Post>) => usePosts.setState((s) => ({ posts: { ...s.posts, [k]: Object.assign({ likes: {}, comments: 0, at: Date.now() }, s.posts[k], p) } }));

function usePost(owner: string | null, wid: string) {
  const k = owner ? keyOf(owner, wid) : '';
  const post = usePosts((s) => (k ? s.posts[k] : undefined));
  useEffect(() => {
    if (!owner) return;
    const cur = usePosts.getState().posts[k];
    if (cur && Date.now() - cur.at < 60_000) return;
    void social()
      .then((s) => s.getPost(owner, wid))
      .then((p) => patch(k, { ...p, at: Date.now() } as Post))
      .catch(() => {});
  }, [k]);
  return post;
}

const meRef = () => {
  const a = useAccount.getState();
  return { uid: a.uid!, nick: a.nick ?? '', avatar: useSettings.getState().avatar ?? null };
};

/**
 * Like · comment · share row under a workout. `owner` is whose workout it is (null = this phone's
 * own workout while signed out: only sharing works then).
 */
export function ReactionBar({ owner, w, author, full }: { owner: string | null; w: Workout; author?: { nick: string; avatar?: string | null }; full?: boolean }) {
  const me = useAccount((a) => (a.status === 'signedIn' ? a.uid : null));
  const settings = useSettings();
  const social_ = !!(owner && me);
  const post = usePost(social_ ? owner : null, w.id);
  const [comments, setComments] = useState(false);
  const liked = !!(me && post?.likes[me]);
  const likes = post ? Object.keys(post.likes).length : 0;
  const nav = useNavigate();

  const like = async () => {
    if (!social_) return;
    haptic(liked ? 'light' : 'success');
    const k = keyOf(owner!, w.id);
    const before = post?.likes ?? {};
    const next = { ...before };
    if (liked) delete next[me!];
    else next[me!] = meRef().nick;
    patch(k, { likes: next });
    try {
      await (await social()).setLike(owner!, w, meRef(), !liked);
    } catch {
      patch(k, { likes: before });
      toast(t('No internet connection'));
    }
  };
  const share = async () => {
    haptic();
    await shareWorkout(w, settings, author?.nick ?? useAccount.getState().nick ?? undefined, author ? author.avatar : settings.avatar).catch(() => toast(t('Something went wrong')));
  };

  const toStory = async () => {
    haptic();
    const img = await workoutImage(w, settings, author?.nick ?? useAccount.getState().nick ?? undefined, author ? author.avatar : settings.avatar).catch(() => null);
    if (!img) return toast(t('Something went wrong'));
    openStoryEditor(img);
  };

  const names = post ? Object.entries(post.likes).filter(([u]) => u !== me) : [];
  // signed out: no likes or comments, just a share button on the workout page
  if (!social_)
    return full ? (
      <button onClick={share} className="press flex w-full items-center justify-center gap-2 py-3 font-display font-semibold uppercase tracking-wider text-accent">
        <Share2 size={18} /> {t('Share workout')}
      </button>
    ) : null;
  return (
    <>
      <div className="flex items-center gap-1 px-1.5 py-1" onClick={(e) => e.stopPropagation()}>
        {social_ && (
          <>
            <button onClick={like} className="press flex items-center gap-1.5 rounded-full px-2.5 py-1.5" aria-label={t('Like')}>
              <motion.span key={String(liked)} initial={{ scale: liked ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 12 }}>
                <Heart size={21} className={liked ? 'text-danger' : 'text-white/75'} fill={liked ? 'currentColor' : 'none'} />
              </motion.span>
              {likes > 0 && <span className="text-sm font-semibold">{likes}</span>}
            </button>
            <button onClick={() => setComments(true)} className="press flex items-center gap-1.5 rounded-full px-2.5 py-1.5" aria-label={t('Comments')}>
              <MessageCircle size={21} className="text-white/75" />
              {(post?.comments ?? 0) > 0 && <span className="text-sm font-semibold">{post!.comments}</span>}
            </button>
          </>
        )}
        {full && (
          <button onClick={toStory} className="press ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold" aria-label={t('Add to story')}>
            <CirclePlus size={20} className="text-white/75" /> {t('Story')}
          </button>
        )}
        <button onClick={share} className={`press ${full ? '' : 'ml-auto'} flex items-center gap-1.5 rounded-full px-2.5 py-1.5`} aria-label={t('Share')}>
          <Share2 size={20} className="text-white/75" />
        </button>
      </div>
      {full && likes > 0 && (
        <div className="px-4 pb-2 text-sm text-muted">
          {liked && t('You')}
          {liked && names.length > 0 && ', '}
          {names.slice(0, 3).map(([u, n], i) => (
            <span key={u}>
              {i > 0 && ', '}
              <button className="font-semibold text-white/85" onClick={() => nav(`/u/${u}`)}>
                @{n}
              </button>
            </span>
          ))}
          {names.length > 3 && ` ${t('+{n} more', { n: names.length - 3 })}`} {t('liked this')}
        </div>
      )}
      {social_ && <CommentsSheet open={comments} onClose={() => setComments(false)} owner={owner!} w={w} />}
    </>
  );
}

export function CommentsSheet({ open, onClose, owner, w }: { open: boolean; onClose: () => void; owner: string; w: Workout }) {
  const me = useAccount((a) => a.uid);
  const nav = useNavigate();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    let stop = () => {};
    void social().then((s) => {
      stop = s.watchComments(owner, w.id, (c) => {
        setList(c);
        patch(keyOf(owner, w.id), { comments: c.length });
      });
    });
    return () => stop();
  }, [open, owner, w.id]);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [list?.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await (await social()).addComment(owner, w, meRef(), body);
      setText('');
      haptic('success');
    } catch {
      toast(t('No internet connection'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('Comments')} tall>
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-3 px-4 pt-2">
          {list === null && <div className="py-8 text-center text-sm text-muted">{t('Loading…')}</div>}
          {list?.length === 0 && <div className="py-8 text-center text-sm text-muted">{t('No comments yet. Say something nice 💪')}</div>}
          <AnimatePresence initial={false}>
            {list?.map((c) => (
              <motion.div key={c.id} className="flex items-start gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                <button onClick={() => (onClose(), nav(`/u/${c.from}`))} className="mt-0.5">
                  <Avatar size={36} src={c.avatar ?? null} initial={c.nick} deco={null} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <b>@{c.nick}</b> <span className="text-xs text-muted">{formatDistanceToNowStrict(c.at, { addSuffix: true })}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words text-[15px] text-white/90">{c.text}</div>
                </div>
                {(c.from === me || owner === me) && (
                  <button onClick={() => void social().then((s) => s.deleteComment(owner, w.id, c.id))} className="press p-1 text-muted" aria-label={t('Delete')}>
                    <Trash2 size={16} />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={end} />
        </div>
        <div className="sticky bottom-0 flex items-end gap-2 bg-card px-3 pb-2 pt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            maxLength={500}
            placeholder={t('Add a comment…')}
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl bg-card2 px-4 py-2.5 text-base outline-none"
          />
          <button onClick={send} disabled={!text.trim() || busy} className="press grad flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40" aria-label={t('Send')}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </Sheet>
  );
}
