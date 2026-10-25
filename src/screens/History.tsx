import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, Dumbbell, History as HistoryIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Empty, Header, Page } from '../components/ui';
import { getExercise, typeOf } from '../lib/exercises';
import { useAllWorkouts } from '../lib/hooks';
import { workoutVolume } from '../lib/stats';
import { fmtDurationLong, fmtVolume } from '../lib/units';
import { useSettings } from '../state/settings';
import type { Workout } from '../types';

function Calendar({ workouts }: { workouts: Workout[] }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dir, setDir] = useState(0);
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const dayset = useMemo(() => new Set(workouts.map((w) => format(w.start, 'yyyy-MM-dd'))), [workouts]);
  const count = workouts.filter((w) => isSameMonth(w.start, month)).length;
  const go = (d: number) => {
    setDir(d);
    setMonth((m) => addMonths(m, d));
  };
  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="mb-3 flex items-center">
        <button onClick={() => go(-1)} className="press p-1 text-muted">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          <div className="font-semibold">{format(month, 'MMMM yyyy')}</div>
          <div className="text-xs text-muted">
            {count} workout{count === 1 ? '' : 's'}
          </div>
        </div>
        <button onClick={() => go(1)} className="press p-1 text-muted">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={month.toISOString()}
          className="mt-1 grid grid-cols-7 gap-y-1 text-center text-sm"
          initial={{ x: dir * 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: dir * -60, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {days.map((d) => {
            const has = dayset.has(format(d, 'yyyy-MM-dd'));
            const today = isSameDay(d, new Date());
            return (
              <div key={d.toISOString()} className="flex justify-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${has ? 'bg-accent font-semibold' : ''} ${
                    !isSameMonth(d, month) ? 'opacity-25' : ''
                  } ${today && !has ? 'ring-1 ring-accent' : ''}`}
                >
                  {format(d, 'd')}
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function WorkoutCard({ w, onClick }: { w: Workout; onClick: () => void }) {
  const settings = useSettings();
  const shown = w.exercises.slice(0, 4);
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="press block w-full rounded-2xl bg-card p-4 text-left"
    >
      <div className="text-[17px] font-semibold">{w.name}</div>
      <div className="text-sm text-muted">{format(w.start, 'EEEE, d MMM yyyy · HH:mm')}</div>
      <div className="mt-3 flex gap-5 text-sm">
        <span className="flex items-center gap-1.5">
          <Clock size={15} className="text-muted" />
          {fmtDurationLong((w.end - w.start) / 1000)}
        </span>
        <span className="flex items-center gap-1.5">
          <Dumbbell size={15} className="text-muted" />
          {fmtVolume(workoutVolume(w, typeOf), settings)}
        </span>
      </div>
      <div className="mt-3 space-y-1 border-t border-line pt-3">
        {shown.map((e) => (
          <div key={e.id} className="truncate text-sm text-white/85">
            <span className="text-muted">{e.sets.length} ×</span> {getExercise(e.exerciseId).name}
          </div>
        ))}
        {w.exercises.length > shown.length && <div className="text-sm text-muted">+ {w.exercises.length - shown.length} more exercises</div>}
      </div>
    </motion.button>
  );
}

export function History() {
  const workouts = useAllWorkouts();
  const nav = useNavigate();
  const [limit, setLimit] = useState(30);
  const groups = useMemo(() => {
    const g: { key: string; items: Workout[] }[] = [];
    for (const w of (workouts ?? []).slice(0, limit)) {
      const key = format(w.start, 'MMMM yyyy');
      if (g[g.length - 1]?.key !== key) g.push({ key, items: [] });
      g[g.length - 1].items.push(w);
    }
    return g;
  }, [workouts, limit]);

  return (
    <Page>
      <Header title="History" large />
      <div className="space-y-3 px-4 pb-8">
        {workouts && workouts.length === 0 ? (
          <Empty icon={<HistoryIcon size={48} />} title="No workouts yet" text="Finished workouts will show up here." />
        ) : (
          <>
            <Calendar workouts={workouts ?? []} />
            {groups.map((g) => (
              <div key={g.key} className="space-y-2">
                <div className="pt-3 text-sm font-semibold text-muted">{g.key}</div>
                {g.items.map((w) => (
                  <WorkoutCard key={w.id} w={w} onClick={() => nav(`/history/${w.id}`)} />
                ))}
              </div>
            ))}
            {(workouts?.length ?? 0) > limit && (
              <button onClick={() => setLimit((l) => l + 30)} className="w-full py-4 font-semibold text-accent">
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </Page>
  );
}

