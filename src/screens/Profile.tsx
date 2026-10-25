import { differenceInCalendarWeeks, format, startOfWeek, subWeeks } from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronRight, Settings as SettingsIcon, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarsChart, compact } from '../components/charts';
import { muscleColor } from '../components/ExerciseImage';
import { Header, Page } from '../components/ui';
import { getExercise, typeOf } from '../lib/exercises';
import { useAllWorkouts } from '../lib/hooks';
import { workoutVolume } from '../lib/stats';
import { fmtDurationLong, kgTo } from '../lib/units';
import { useSettings } from '../state/settings';
import type { Workout } from '../types';

type WeekMetric = 'workouts' | 'duration' | 'volume' | 'reps';

function weekStreak(ws: Workout[]) {
  if (!ws.length) return 0;
  const weeks = new Set(ws.map((w) => differenceInCalendarWeeks(new Date(), w.start, { weekStartsOn: 1 })));
  let n = 0;
  // The current week doesn't break the streak until it's over.
  let i = weeks.has(0) ? 0 : 1;
  while (weeks.has(i)) {
    n++;
    i++;
  }
  return n;
}

export function Profile() {
  const nav = useNavigate();
  const settings = useSettings();
  const workouts = useAllWorkouts() ?? [];
  const [metric, setMetric] = useState<WeekMetric>('workouts');

  const totals = useMemo(() => {
    let volume = 0;
    let time = 0;
    for (const w of workouts) {
      volume += workoutVolume(w, typeOf);
      time += (w.end - w.start) / 1000;
    }
    return { volume, time };
  }, [workouts]);

  const weeks = useMemo(() => {
    const start = startOfWeek(subWeeks(new Date(), 11), { weekStartsOn: 1 });
    const buckets = Array.from({ length: 12 }, (_, i) => ({ start: startOfWeek(subWeeks(new Date(), 11 - i), { weekStartsOn: 1 }), workouts: 0, duration: 0, volume: 0, reps: 0 }));
    for (const w of workouts) {
      if (w.start < start.getTime()) continue;
      const i = Math.floor((w.start - start.getTime()) / (7 * 864e5));
      const b = buckets[Math.min(11, i)];
      b.workouts++;
      b.duration += (w.end - w.start) / 3600e3;
      b.volume += kgTo(workoutVolume(w, typeOf), settings.weightUnit);
      b.reps += w.exercises.reduce((n, e) => n + e.sets.reduce((m, s) => m + (s.reps ?? 0), 0), 0);
    }
    return buckets.map((b) => ({ label: format(b.start, 'd MMM'), title: `Week of ${format(b.start, 'd MMM yyyy')}`, value: Math.round(b[metric] * 10) / 10 }));
  }, [workouts, metric, settings.weightUnit]);

  const muscles = useMemo(() => {
    const since = Date.now() - 30 * 864e5;
    const m = new Map<string, number>();
    for (const w of workouts) {
      if (w.start < since) continue;
      for (const e of w.exercises) {
        const mus = getExercise(e.exerciseId).muscle;
        const n = e.sets.filter((s) => s.type !== 'warmup').length;
        m.set(mus, (m.get(mus) ?? 0) + n);
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [workouts]);
  const maxSets = muscles[0]?.[1] ?? 1;

  const fmtMetric = (v: number) =>
    metric === 'duration' ? `${v} h` : metric === 'volume' ? `${compact(v)} ${settings.weightUnit}` : metric === 'reps' ? `${v} reps` : `${v} workouts`;

  return (
    <Page>
      <Header
        title="Profile"
        large
        right={
          <button onClick={() => nav('/settings')} className="press text-accent">
            <SettingsIcon size={22} />
          </button>
        }
      />
      <div className="space-y-4 px-4 pb-10">
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Workouts', String(workouts.length)],
            ['Week streak', `${weekStreak(workouts)} 🔥`],
            ['Total time', fmtDurationLong(totals.time)],
            ['Total volume', `${compact(kgTo(totals.volume, settings.weightUnit))} ${settings.weightUnit}`],
          ].map(([l, v], i) => (
            <motion.div key={l} className="rounded-2xl bg-card p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="text-xs text-muted">{l}</div>
              <div className="mt-0.5 text-xl font-semibold">{v}</div>
            </motion.div>
          ))}
        </div>

        <div className="rounded-2xl bg-card p-4">
          <div className="mb-1 font-semibold">Last 12 weeks</div>
          <div className="mb-3 text-xs text-muted">{metric === 'workouts' ? 'Workouts' : metric === 'duration' ? 'Hours trained' : metric === 'volume' ? 'Volume lifted' : 'Reps'} per week</div>
          <BarsChart key={metric} data={weeks} fmt={fmtMetric} />
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {(['workouts', 'duration', 'volume', 'reps'] as WeekMetric[]).map((m) => (
              <button key={m} onClick={() => setMetric(m)} className={`press rounded-full py-1.5 text-xs font-semibold capitalize ${metric === m ? 'bg-accent' : 'bg-card2 text-white/80'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4">
          <div className="font-semibold">Muscle distribution</div>
          <div className="mb-3 text-xs text-muted">Working sets per muscle group · last 30 days</div>
          {muscles.length === 0 && <div className="py-4 text-center text-sm text-muted">No workouts in the last 30 days</div>}
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
                    className="h-full rounded-full bg-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${(n / maxSets) * 100}%` }}
                    transition={{ delay: 0.1 + i * 0.04, duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
          <button onClick={() => nav('/import/hevy')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-card2">
            <Upload size={20} className="text-accent" />
            <span className="flex-1">Import from Hevy</span>
            <ChevronRight size={18} className="text-muted" />
          </button>
          <button onClick={() => nav('/settings')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-card2">
            <SettingsIcon size={20} className="text-accent" />
            <span className="flex-1">Settings & Backup</span>
            <ChevronRight size={18} className="text-muted" />
          </button>
        </div>
      </div>
    </Page>
  );
}
