import { formatDistanceToNowStrict } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Heart, Music, Send, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from '../cloud/account';
import type { Story, StoryView } from '../cloud/stories';
import { markSeen, refreshStories, storyQueue, useStories } from '../cloud/storyStore';
import { meRef, replyInChat } from '../components/StoryTray';
import { Portal, Sheet } from '../components/ui';
import { Avatar } from '../components/WorkoutFeed';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { pauseSong, playSong, stopSong } from '../lib/music';
import { confirmDialog, toast } from '../state/dialog';
import { useSettings } from '../state/settings';

const stories = () => import('../cloud/stories');
const viewed = new Set<string>();

async function load(uid: string): Promise<Story[]> {
  const c = useStories.getState().cache[uid];
  if (c && Date.now() - c.at < 60_000) return c.list;
  const list = await (await stories()).getStories(uid);
  useStories.setState((s) => ({ cache: { ...s.cache, [uid]: { at: Date.now(), list } } }));
  return list;
}

export function StoryViewer() {
  const { uid } = useParams();
  const nav = useNavigate();
  const me = useAccount((a) => a.uid);
  const myNick = useAccount((a) => a.nick);
  const myAvatar = useSettings((s) => s.avatar);
  const friends = useStories((s) => s.friends);
  const [queue] = useState(() => storyQueue(uid!));
  const [qi, setQi] = useState(0);
  const [si, setSi] = useState(0);
  const [list, setList] = useState<Story[] | null>(null);
  const [held, setHeld] = useState(false);
  const [typing, setTyping] = useState(false);
  const [muted, setMuted] = useState(false);
  const [views, setViews] = useState<StoryView[] | null>(null);
  const [reply, setReply] = useState('');
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);
  const prog = useRef(0);
  const owner = queue[qi];
  const mine = owner === me;
  const info = mine ? { uid: owner, nick: myNick ?? '', avatar: myAvatar ?? null } : (friends.find((f) => f.uid === owner) ?? { uid: owner, nick: '', avatar: null });
  const story = list?.[si];
  const paused = held || typing || views !== null;

  const close = () => {
    stopSong();
    nav(-1);
  };
  const next = () => {
    if (list && si < list.length - 1) setSi(si + 1);
    else if (qi < queue.length - 1) setQi(qi + 1);
    else close();
  };
  const prev = () => {
    if (si > 0) setSi(si - 1);
    else if (qi > 0) setQi(qi - 1);
    else {
      prog.current = 0;
      setProgress(0);
    }
  };

  // stories of the current person (and the next one, preloaded)
  useEffect(() => {
    let dead = false;
    setList(null);
    setSi(0);
    load(owner)
      .then((l) => {
        if (dead) return;
        if (!l.length) return next();
        // start at the first one you haven't watched
        const seen = useStories.getState().seen[owner] ?? 0;
        const first = l.findIndex((s) => s.at > seen);
        setSi(first > 0 && !mine ? first : 0);
        setList(l);
      })
      .catch(() => {
        toast(t('No internet connection'));
        close();
      });
    if (queue[qi + 1]) void load(queue[qi + 1]).catch(() => {});
    return () => {
      dead = true;
    };
  }, [owner]);

  // timer
  useEffect(() => {
    prog.current = 0;
    setProgress(0);
  }, [story?.id]);
  useEffect(() => {
    if (!story || paused) return;
    const dur = story.song ? 15000 : 6000;
    const start = performance.now() - prog.current * dur;
    let raf = 0;
    const tick = (now: number) => {
      const p = (now - start) / dur;
      prog.current = p;
      setProgress(Math.min(1, p));
      if (p >= 1) next();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story?.id, paused]);

  // seen, view receipt, music
  useEffect(() => {
    if (!story) return;
    markSeen(owner, story.at);
    if (!mine && me && !viewed.has(story.id)) {
      viewed.add(story.id);
      void stories().then((s) => s.markViewed(owner, story.id, meRef()).catch(() => {}));
    }
    if (story.song && !muted) playSong(story.song);
    else stopSong();
  }, [story?.id]);
  useEffect(() => pauseSong(paused || muted), [paused, muted]);
  useEffect(() => () => stopSong(), []);

  /* tap left / right, hold to pause, swipe down to close */
  const holdTimer = useRef(0);
  const wasHeld = useRef(false);
  const dragged = useRef(false);
  const down = () => {
    wasHeld.current = false;
    holdTimer.current = window.setTimeout(() => {
      wasHeld.current = true;
      setHeld(true);
    }, 220);
  };
  const up = (e: React.PointerEvent) => {
    clearTimeout(holdTimer.current);
    setHeld(false);
    if (wasHeld.current || dragged.current) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.3) prev();
    else next();
  };

  const like = () => {
    if (!story || !me) return;
    const on = !liked[story.id];
    setLiked((l) => ({ ...l, [story.id]: on }));
    haptic(on ? 'success' : 'light');
    void stories().then((s) => s.markViewed(owner, story.id, meRef(), on).catch(() => {}));
  };
  const send = async () => {
    if (!reply.trim()) return;
    const text = reply.trim();
    setReply('');
    (document.activeElement as HTMLElement | null)?.blur();
    try {
      await replyInChat(info, `${t('Replied to your story')}: ${text}`);
      haptic('success');
      toast(t('Sent'));
    } catch {
      toast(t('No internet connection'));
    }
  };
  const openViews = async () => {
    if (!story) return;
    setViews([]);
    try {
      setViews(await (await stories()).getViews(owner, story.id));
    } catch {
      setViews(null);
    }
  };
  const remove = async () => {
    if (!story || !(await confirmDialog(t('Delete this story?'), '', t('Delete'), true))) return;
    setViews(null);
    try {
      await (await stories()).deleteStory(owner, story.id);
      const rest = list!.filter((s) => s.id !== story.id);
      useStories.setState((s) => ({ cache: { ...s.cache, [owner]: { at: Date.now(), list: rest } }, me: { ...(s.me ?? {}), last: rest.length ? rest[rest.length - 1].at : 0 } }));
      void refreshStories(true);
      if (!rest.length) return close();
      setList(rest);
      setSi(Math.min(si, rest.length - 1));
    } catch {
      toast(t('No internet connection'));
    }
  };

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-[45] flex flex-col items-center bg-black text-[#fff]"
        style={{ paddingTop: 'var(--sat)' }}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragStart={() => {
          dragged.current = true;
          clearTimeout(holdTimer.current);
        }}
        onDragEnd={(_, i) => {
          setTimeout(() => (dragged.current = false), 50);
          setHeld(false);
          if (i.offset.y > 120) close();
        }}
      >
        <div className="relative w-full flex-1 overflow-hidden rounded-xl" style={{ maxWidth: 'calc((100dvh - var(--sat) - 64px) * 9 / 16)' }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {story && <motion.img key={story.id} src={story.img} alt="" className="absolute inset-0 h-full w-full select-none object-cover" draggable={false} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />}
          </AnimatePresence>
          {!story && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#fff]/60">{t('Loading…')}</div>}
          <div className="absolute inset-0" onPointerDown={down} onPointerUp={up} onPointerCancel={() => (clearTimeout(holdTimer.current), setHeld(false))} onContextMenu={(e) => e.preventDefault()} />

          {/* progress + header */}
          <div className={`pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-2.5 pb-8 pt-2 transition-opacity ${held ? 'opacity-0' : ''}`}>
            <div className="flex gap-1">
              {(list ?? [null]).map((s, i) => (
                <div key={s?.id ?? i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#fff]/35">
                  <div className="h-full bg-[#fff]" style={{ width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }} />
                </div>
              ))}
            </div>
            <div className="pointer-events-auto mt-2.5 flex items-center gap-2.5">
              <button onClick={() => !mine && (stopSong(), nav(`/u/${owner}`))}>
                <Avatar size={34} src={mine ? undefined : (info.avatar ?? null)} initial={mine ? undefined : info.nick} deco={null} />
              </button>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-sm font-semibold">
                  {mine ? t('Your story') : info.nick} {story && <span className="font-normal text-[#fff]/70">{formatDistanceToNowStrict(story.at)}</span>}
                </div>
                {story?.song && (
                  <div className="flex items-center gap-1 truncate text-xs text-[#fff]/85">
                    <Music size={11} className="shrink-0" /> <span className="truncate">{story.song.title} · {story.song.artist}</span>
                  </div>
                )}
              </div>
              {story?.song && (
                <button onClick={() => setMuted((m) => !m)} className="p-1.5" aria-label={t('Sound')}>
                  {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                </button>
              )}
              <button onClick={close} className="p-1.5" aria-label={t('Close')}>
                <X size={26} />
              </button>
            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="flex h-16 w-full max-w-[520px] items-center gap-2 px-3" style={{ paddingBottom: 'max(0px, calc(var(--sab, 0px) - 12px))' }}>
          {mine ? (
            <>
              <button onClick={openViews} className="press flex items-center gap-2 rounded-full px-2 py-2 text-sm font-semibold">
                <Eye size={20} /> {t('Seen by')}
              </button>
              <div className="flex-1" />
              <button onClick={remove} className="press p-2" aria-label={t('Delete')}>
                <Trash2 size={21} />
              </button>
            </>
          ) : (
            <>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                onKeyDown={(e) => e.key === 'Enter' && void send()}
                placeholder={t('Reply to @{nick}…', { nick: info.nick })}
                className="h-11 min-w-0 flex-1 rounded-full border border-[#fff]/40 bg-transparent px-4 text-base text-[#fff] outline-none placeholder:text-[#fff]/60"
              />
              {reply.trim() ? (
                <button onPointerDown={(e) => e.preventDefault()} onClick={send} className="press p-2" aria-label={t('Send')}>
                  <Send size={24} />
                </button>
              ) : (
                <button onClick={like} className="press p-2" aria-label={t('Like')}>
                  <motion.span key={String(!!(story && liked[story.id]))} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 12 }} className="block">
                    <Heart size={26} className={story && liked[story.id] ? 'text-danger' : ''} fill={story && liked[story.id] ? 'currentColor' : 'none'} />
                  </motion.span>
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>

      <Sheet open={views !== null} onClose={() => setViews(null)} title={t('Seen by')}>
        <div className="space-y-1 px-4 pb-6 pt-1">
          {views?.length === 0 && <div className="py-8 text-center text-sm text-muted">{t('Nobody has seen it yet.')}</div>}
          {views?.map((v) => (
            <button key={v.uid} onClick={() => (stopSong(), nav(`/u/${v.uid}`))} className="press flex w-full items-center gap-3 rounded-xl p-2 text-left">
              <Avatar size={40} src={v.avatar ?? null} initial={v.nick} deco={null} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">@{v.nick}</div>
                <div className="text-xs text-muted">{formatDistanceToNowStrict(v.at, { addSuffix: true })}</div>
              </div>
              {v.like && <Heart size={18} className="text-danger" fill="currentColor" />}
            </button>
          ))}
        </div>
      </Sheet>
    </Portal>
  );
}
