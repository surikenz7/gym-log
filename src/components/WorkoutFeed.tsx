import { format, formatDistanceToNowStrict, isThisYear } from 'date-fns';
import { motion } from 'framer-motion';
import { Timer, Trophy, Weight } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../cloud/account';
import { openStory, useStoryRing } from '../cloud/storyStore';
import { primeAudio } from '../lib/music';
import { getExercise, typeOf } from '../lib/exercises';
import { prCounts, workoutVolume } from '../lib/stats';
import { fmtDurationLong, fmtVolume } from '../lib/units';
import { useSettings } from '../state/settings';
import { DecorationArt } from './Decorations';
import { RatingPill } from './WorkoutExtras';
import { RankChip } from './RankBadge';
import type { Workout } from '../types';
import { t } from '../i18n';

/** Profile picture (or initial). `ring` draws a coloured border, e.g. the overall rank's metal. */
/**
 * Profile picture (or initial) with the equipped decoration around it. `ring` draws a coloured
 * border (e.g. the overall rank's metal) when no decoration is worn; `deco` overrides the equipped one.
 */
/** Instagram-style story ring: colourful while there's an unwatched story, grey once watched. */
export function StoryRing({ size, state }: { size: number; state: 'new' | 'seen' }) {
  const th = Math.max(2, size * 0.045);
  const gap = Math.max(2, size * 0.045);
  return (
    <div
      className="pointer-events-none absolute rounded-full"
      style={{
        inset: -(gap + th),
        background: state === 'new' ? 'conic-gradient(from 210deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5, #feda75)' : 'rgb(var(--muted) / 0.55)',
        WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${th}px), #000 calc(100% - ${th}px))`,
        mask: `radial-gradient(farthest-side, transparent calc(100% - ${th}px), #000 calc(100% - ${th}px))`,
      }}
    />
  );
}

export function Avatar({ size = 40, ring, deco, src, initial, story }: { size?: number; ring?: string; deco?: string | null; src?: string | null; initial?: string; story?: 'new' | 'seen' | null }) {
  const myName = useSettings((s) => s.name);
  const myPhoto = useSettings((s) => s.avatar);
  const equipped = useSettings((s) => s.deco);
  const worn = deco !== undefined ? deco : equipped;
  // someone else's avatar (friends) when src / initial are given
  const photo = src !== undefined ? src : myPhoto;
  const name = initial ?? myName;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {story && <StoryRing size={size} state={story} />}
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-[#000] font-display font-bold text-[#fff]"
        style={{ fontSize: size * 0.42, boxShadow: ring && !worn && !story ? `0 0 0 ${Math.max(2, size / 22)}px rgb(var(--bg)), 0 0 0 ${Math.max(4, size / 11)}px ${ring}` : undefined }}
      >
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" draggable={false} /> : (name.trim()[0] ?? '🏋').toUpperCase()}
      </div>
      <DecorationArt id={worn} size={size} />
    </div>
  );
}

/** "Mon 27 Oct, 18:30 · 2 hours ago" (the "ago" part only for the last week). */
function when(w: Workout) {
  const date = format(w.start, isThisYear(w.start) ? 'EEE d MMM, p' : 'EEE d MMM yyyy, p');
  return Date.now() - w.end < 7 * 864e5 ? `${date} · ${formatDistanceToNowStrict(w.end, { addSuffix: true })}` : date;
}

/** `friend` = someone else's workout (no link into local history, no rank chips). */
export interface FeedAuthor {
  uid: string;
  nick: string;
  avatar?: string | null;
  deco?: string | null;
}

export function WorkoutCard({ w, prs, index = 0, friend, onOpen, author, footer }: { w: Workout; prs: number; index?: number; friend?: boolean; onOpen?: () => void; author?: FeedAuthor; footer?: ReactNode }) {
  const settings = useSettings();
  const myNick = useAccount((a) => a.nick);
  const myUid = useAccount((a) => (a.status === 'signedIn' ? a.uid : null));
  const ring = useStoryRing(author ? author.uid : myUid);
  const nav = useNavigate();
  const shown = w.exercises.slice(0, 4);
  const sets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.type !== 'warmup').length, 0);
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.04 }}
      className={`cut w-full bg-card ${author ? 'ring-1 ring-inset ring-sky-400/40' : ''}`}
      style={author ? { backgroundImage: 'linear-gradient(135deg, rgb(56 189 248 / 0.16), transparent 60%)' } : undefined}
    >
    <button onClick={() => (onOpen ? onOpen() : !friend && nav(`/history/${w.id}`))} className="press flex w-full flex-col text-left">
      <div className="flex items-center gap-3 px-3 pt-3">
        <span
          onClick={(e) => {
            if (!ring) return;
            e.stopPropagation();
            primeAudio();
            openStory((author?.uid ?? myUid)!);
          }}
        >
          {author ? <Avatar size={44} src={author.avatar ?? null} initial={author.nick} deco={ring ? null : (author.deco ?? null)} story={ring} /> : <Avatar size={44} story={ring} deco={ring ? null : undefined} />}
        </span>
        <div className="min-w-0">
          <div className="truncate text-base font-bold normal-case">{author ? '@' + author.nick : myNick ? '@' + myNick : settings.name || t('You')}</div>
          <div className="truncate text-xs text-muted">{when(w)}</div>
        </div>
      </div>
      <div className="flex w-full">
      <div className="min-w-0 flex-1 px-3 pb-3 pt-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 truncate font-display text-xl font-bold uppercase leading-tight">{w.name}</div>
          {prs > 0 && (
            <span className="cut-sm flex shrink-0 items-center gap-1 bg-warn px-1.5 py-0.5 font-display text-xs font-bold text-black">
              <Trophy size={12} strokeWidth={2.5} /> {prs} {t('PR')}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-display text-xs uppercase tracking-wide text-muted">
          <span className="flex items-center gap-1">
            <Timer size={12} /> {fmtDurationLong((w.end - w.start) / 1000)}
          </span>
          <span className="flex items-center gap-1">
            <Weight size={12} /> {fmtVolume(workoutVolume(w, typeOf), settings)}
          </span>
          <span>{sets} {t('sets')}</span>
        </div>
        <div className="mt-2 space-y-0.5">
          {shown.map((e) => (
            <div key={e.id} className="flex items-baseline gap-2 text-sm">
              <span className="w-6 shrink-0 text-right font-display font-bold text-accent">{e.sets.length}×</span>
              <span className="truncate text-white/85">{getExercise(e.exerciseId).name}</span>
              {!friend && <RankChip exerciseId={e.exerciseId} size={22} inline />}
            </div>
          ))}
          {w.exercises.length > shown.length && <div className="pl-8 text-xs text-muted">{t('+{n} more', { n: w.exercises.length - shown.length })}</div>}
        </div>
        {(w.rating || w.tagged?.length || w.photos?.length) && (
          <div className="mt-2 flex items-center gap-2">
            {w.photos?.[0] && <img src={w.photos[0]} alt="" className="h-10 w-10 rounded-lg object-cover" />}
            {w.photos && w.photos.length > 1 && <span className="text-xs text-muted">+{w.photos.length - 1}</span>}
            <RatingPill rating={w.rating} />
            {w.tagged?.length ? <span className="truncate text-xs text-muted">👥 {w.tagged.map((f) => '@' + f.nick).join(', ')}</span> : null}
          </div>
        )}
      </div>
      </div>
    </button>
    {footer && <div className="border-t border-line/60">{footer}</div>}
    </motion.div>
  );
}

/** Newest-first workout cards with PR counts and "load more" paging. */
export function WorkoutList({ workouts }: { workouts: Workout[] }) {
  const [limit, setLimit] = useState(20);
  const prs = useMemo(() => prCounts(workouts, typeOf), [workouts]);
  return (
    <div className="space-y-2">
      {workouts.slice(0, limit).map((w, i) => (
        <WorkoutCard key={w.id} w={w} prs={prs.get(w.id) ?? 0} index={i} />
      ))}
      {workouts.length > limit && (
        <button onClick={() => setLimit((l) => l + 20)} className="w-full py-4 font-semibold text-accent">
          {t('Load more')}
        </button>
      )}
    </div>
  );
}
