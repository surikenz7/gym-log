import { format, isThisYear } from 'date-fns';
import { motion } from 'framer-motion';
import { Timer, Trophy, Weight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExercise, typeOf } from '../lib/exercises';
import { prCounts, workoutVolume } from '../lib/stats';
import { fmtDurationLong, fmtVolume } from '../lib/units';
import { useSettings } from '../state/settings';
import { DecorationArt } from './Decorations';
import { RankChip } from './RankBadge';
import type { Workout } from '../types';

/** Profile picture (or initial). `ring` draws a coloured border, e.g. the overall rank's metal. */
/**
 * Profile picture (or initial) with the equipped decoration around it. `ring` draws a coloured
 * border (e.g. the overall rank's metal) when no decoration is worn; `deco` overrides the equipped one.
 */
export function Avatar({ size = 40, ring, deco }: { size?: number; ring?: string; deco?: string | null }) {
  const name = useSettings((s) => s.name);
  const photo = useSettings((s) => s.avatar);
  const equipped = useSettings((s) => s.deco);
  const worn = deco !== undefined ? deco : equipped;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-[#000] font-display font-bold text-[#fff]"
        style={{ fontSize: size * 0.42, boxShadow: ring && !worn ? `0 0 0 ${Math.max(2, size / 22)}px rgb(var(--bg)), 0 0 0 ${Math.max(4, size / 11)}px ${ring}` : undefined }}
      >
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" draggable={false} /> : (name.trim()[0] ?? '🏋').toUpperCase()}
      </div>
      <DecorationArt id={worn} size={size} />
    </div>
  );
}

export function WorkoutCard({ w, prs, index = 0 }: { w: Workout; prs: number; index?: number }) {
  const settings = useSettings();
  const nav = useNavigate();
  const shown = w.exercises.slice(0, 4);
  const sets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.type !== 'warmup').length, 0);
  return (
    <motion.button
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.04 }}
      onClick={() => nav(`/history/${w.id}`)}
      className="press cut flex w-full bg-card text-left"
    >
      <div className="flex w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 bg-card2 py-3" style={{ boxShadow: 'inset -2px 0 0 rgb(var(--accent))' }}>
        <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted">{format(w.start, 'EEE')}</span>
        <span className="font-display text-[28px] font-bold leading-none">{format(w.start, 'd')}</span>
        <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-accent">{format(w.start, isThisYear(w.start) ? 'MMM' : 'MMM yy')}</span>
      </div>
      <div className="min-w-0 flex-1 px-3 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 truncate font-display text-xl font-bold uppercase leading-tight">{w.name}</div>
          {prs > 0 && (
            <span className="cut-sm flex shrink-0 items-center gap-1 bg-warn px-1.5 py-0.5 font-display text-xs font-bold text-black">
              <Trophy size={12} strokeWidth={2.5} /> {prs} PR{prs === 1 ? '' : 's'}
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
          <span>{sets} set{sets === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-2 space-y-0.5">
          {shown.map((e) => (
            <div key={e.id} className="flex items-baseline gap-2 text-sm">
              <span className="w-6 shrink-0 text-right font-display font-bold text-accent">{e.sets.length}×</span>
              <span className="truncate text-white/85">{getExercise(e.exerciseId).name}</span>
              <RankChip exerciseId={e.exerciseId} size={22} inline />
            </div>
          ))}
          {w.exercises.length > shown.length && <div className="pl-8 text-xs text-muted">+{w.exercises.length - shown.length} more</div>}
        </div>
      </div>
    </motion.button>
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
          Load more
        </button>
      )}
    </div>
  );
}
