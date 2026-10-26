import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { compact } from '../lib/units';
import { ExerciseThumb, muscleColor } from '../components/ExerciseImage';
import { formatMetric } from '../components/ExerciseInfo';
import { Header, Page } from '../components/ui';
import { getExercise, typeOf } from '../lib/exercises';
import { useAllWorkouts } from '../lib/hooks';
import { exerciseBests, prCounts, workoutSetCount, workoutVolume } from '../lib/stats';
import { fmtDurationLong, kgTo } from '../lib/units';
import { useSettings } from '../state/settings';

const PERIODS = [
  { label: '30 days', days: 30 },
  { label: '3 months', days: 91 },
  { label: 'Year', days: 365 },
  { label: 'All time', days: 0 },
];

export function Statistics() {
  const nav = useNavigate();
  const settings = useSettings();
  const all = useAllWorkouts() ?? [];
  const [period, setPeriod] = useState(0);
  const since = PERIODS[period].days ? Date.now() - PERIODS[period].days * 864e5 : 0;
  const ws = useMemo(() => all.filter((w) => w.start >= since), [all, since]);

  const totals = useMemo(() => {
    const prs = prCounts(all, typeOf);
    return {
      time: ws.reduce((t, w) => t + (w.end - w.start) / 1000, 0),
      volume: ws.reduce((v, w) => v + workoutVolume(w, typeOf), 0),
      sets: ws.reduce((n, w) => n + workoutSetCount(w), 0),
      records: ws.reduce((n, w) => n + (prs.get(w.id) ?? 0), 0),
    };
  }, [ws, all]);

  const muscles = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of ws)
      for (const e of w.exercises) {
        const mus = getExercise(e.exerciseId).muscle;
        m.set(mus, (m.get(mus) ?? 0) + e.sets.filter((s) => s.type !== 'warmup').length);
      }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ws]);
  const maxSets = muscles[0]?.[1] ?? 1;

  const main = useMemo(() => {
    const count = new Map<string, number>();
    for (const w of ws) for (const id of w.exerciseIds) count.set(id, (count.get(id) ?? 0) + 1);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, n]) => {
        const ex = getExercise(id);
        const b = exerciseBests(all, id, ex.type);
        const best = b['1rm'] ? formatMetric('1rm', b['1rm'], ex.type, settings) + ' 1RM' : b.weight ? formatMetric('weight', b.weight, ex.type, settings) : b.reps ? `${b.reps} reps` : b.duration ? formatMetric('duration', b.duration, ex.type, settings) : '';
        return { ex, n, best };
      });
  }, [ws, all, settings]);

  return (
    <Page pushed>
      <Header back title="Statistics" />
      <div className="space-y-4 px-4 pb-12">
        <div className="grid grid-cols-4 gap-1 cut-sm bg-card p-1">
          {PERIODS.map((p, i) => (
            <button key={p.label} onClick={() => setPeriod(i)} className="relative rounded-lg py-1.5 text-sm font-semibold">
              {period === i && <motion.span layoutId="period" className="absolute inset-0 rounded-lg bg-accent" />}
              <span className={`relative ${period === i ? 'text-ink' : ''}`}>{p.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            ['Workouts', String(ws.length)],
            ['Time', fmtDurationLong(totals.time)],
            ['Volume', `${compact(kgTo(totals.volume, settings.weightUnit))} ${settings.weightUnit}`],
            ['Sets', String(totals.sets)],
            ['Records', `${totals.records} 🏆`],
            ['Avg. workout', ws.length ? fmtDurationLong(totals.time / ws.length) : '–'],
          ].map(([l, v]) => (
            <div key={l} className="cut bg-card p-4">
              <div className="label">{l}</div>
              <div className="mt-0.5 font-display text-2xl font-bold">{v}</div>
            </div>
          ))}
        </div>

        <div className="cut bg-card p-4">
          <div className="label !text-white">Muscle distribution</div>
          <div className="mb-3 text-xs text-muted">Working sets per muscle group</div>
          {muscles.length === 0 && <div className="py-4 text-center text-sm text-muted">No workouts in this period</div>}
          <div className="space-y-2.5">
            {muscles.map(([m, n], i) => (
              <div key={m}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: muscleColor(m) }} />
                    {m}
                  </span>
                  <span className="tabular-nums text-muted">{n} sets</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-card2">
                  <motion.div
                    key={`${m}-${period}`}
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${(n / maxSets) * 100}%` }}
                    transition={{ delay: 0.05 + i * 0.03, duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {main.length > 0 && (
          <div>
            <div className="label mb-2">Main exercises</div>
            <div className="divide-y divide-line overflow-hidden cut bg-card">
              {main.map(({ ex, n, best }) => (
                <button key={ex.id} onClick={() => nav(`/exercises/${ex.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-card2">
                  <ExerciseThumb ex={ex} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{ex.name}</div>
                    <div className="text-sm text-muted">
                      {n} workout{n === 1 ? '' : 's'}
                      {best && ` · best ${best}`}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
