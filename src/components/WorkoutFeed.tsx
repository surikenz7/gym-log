import { format, isThisYear } from 'date-fns';
import { motion } from 'framer-motion';
import { Heart, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExercise, typeOf } from '../lib/exercises';
import { prCounts, workoutVolume } from '../lib/stats';
import { fmtDurationLong, fmtVolume } from '../lib/units';
import { useSettings } from '../state/settings';
import type { Workout } from '../types';
import { ExerciseThumb } from './ExerciseImage';

export function Avatar({ size = 40 }: { size?: number }) {
  const name = useSettings((s) => s.name);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-800 font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {(name.trim()[0] ?? '🏋').toUpperCase()}
    </div>
  );
}

export function WorkoutCard({ w, prs, index = 0 }: { w: Workout; prs: number; index?: number }) {
  const settings = useSettings();
  const nav = useNavigate();
  const shown = w.exercises.slice(0, 3);
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.04 }}
      onClick={() => nav(`/history/${w.id}`)}
      className="press block w-full rounded-2xl bg-card p-4 text-left"
    >
      <div className="flex items-center gap-3">
        <Avatar size={38} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{settings.name || 'You'}</div>
          <div className="text-xs text-muted">{format(w.start, isThisYear(w.start) ? 'EEEE, d MMM · HH:mm' : 'd MMM yyyy · HH:mm')}</div>
        </div>
      </div>
      <div className="mt-3 text-lg font-semibold">{w.name}</div>
      <div className="mt-2 flex gap-6 text-sm">
        <div>
          <div className="text-xs text-muted">Time</div>
          {fmtDurationLong((w.end - w.start) / 1000)}
        </div>
        <div>
          <div className="text-xs text-muted">Volume</div>
          {fmtVolume(workoutVolume(w, typeOf), settings)}
        </div>
        {prs > 0 && (
          <div>
            <div className="text-xs text-muted">Records</div>
            <span className="flex items-center gap-1 text-warn">
              <Trophy size={14} /> {prs}
            </span>
          </div>
        )}
        {w.health?.avgHr && (
          <div>
            <div className="text-xs text-muted">Avg HR</div>
            <span className="flex items-center gap-1">
              <Heart size={13} className="text-rose-500" /> {w.health.avgHr}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 space-y-2 border-t border-line pt-3">
        {shown.map((e) => {
          const ex = getExercise(e.exerciseId);
          return (
            <div key={e.id} className="flex items-center gap-3 text-sm">
              <ExerciseThumb ex={ex} size={30} />
              <span className="truncate">
                {e.sets.length} set{e.sets.length === 1 ? '' : 's'} {ex.name}
              </span>
            </div>
          );
        })}
        {w.exercises.length > shown.length && (
          <div className="pt-1 text-center text-sm text-muted">
            See {w.exercises.length - shown.length} more exercise{w.exercises.length - shown.length === 1 ? '' : 's'}
          </div>
        )}
      </div>
    </motion.button>
  );
}

/** Newest-first workout cards with PR counts and "load more" paging. */
export function WorkoutList({ workouts }: { workouts: Workout[] }) {
  const [limit, setLimit] = useState(20);
  const prs = useMemo(() => prCounts(workouts, typeOf), [workouts]);
  return (
    <div className="space-y-3">
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
