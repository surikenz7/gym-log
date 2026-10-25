import { format, startOfWeek, subWeeks } from 'date-fns';
import { motion } from 'framer-motion';
import { BarChart3, CalendarDays, Dumbbell, Ruler, Settings as SettingsIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarsChart, compact } from '../components/charts';
import { Avatar, WorkoutList } from '../components/WorkoutFeed';
import { Header, Page } from '../components/ui';
import { typeOf } from '../lib/exercises';
import { useAllWorkouts } from '../lib/hooks';
import { workoutVolume } from '../lib/stats';
import { fmtDurationLong, kgTo } from '../lib/units';
import { useSettings } from '../state/settings';

type WeekMetric = 'duration' | 'volume' | 'reps';

export function Profile() {
  const nav = useNavigate();
  const settings = useSettings();
  const workouts = useAllWorkouts() ?? [];
  const [metric, setMetric] = useState<WeekMetric>('duration');

  const weeks = useMemo(() => {
    const first = startOfWeek(subWeeks(new Date(), 11), { weekStartsOn: 1 }).getTime();
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      start: startOfWeek(subWeeks(new Date(), 11 - i), { weekStartsOn: 1 }),
      duration: 0,
      volume: 0,
      reps: 0,
    }));
    for (const w of workouts) {
      if (w.start < first) continue;
      const b = buckets[Math.min(11, Math.floor((w.start - first) / (7 * 864e5)))];
      b.duration += (w.end - w.start) / 60e3;
      b.volume += kgTo(workoutVolume(w, typeOf), settings.weightUnit);
      b.reps += w.exercises.reduce((n, e) => n + e.sets.reduce((m, s) => m + (s.reps ?? 0), 0), 0);
    }
    return buckets.map((b) => ({ label: format(b.start, 'd MMM'), title: `Week of ${format(b.start, 'd MMM yyyy')}`, value: Math.round(b[metric]) }));
  }, [workouts, metric, settings.weightUnit]);

  const thisWeek = weeks[weeks.length - 1]?.value ?? 0;
  const headline =
    metric === 'duration'
      ? `${fmtDurationLong(thisWeek * 60)} this week`
      : metric === 'volume'
        ? `${compact(thisWeek)} ${settings.weightUnit} this week`
        : `${thisWeek} reps this week`;
  // duration is bucketed in minutes
  const fmtMetric = (v: number) => (metric === 'duration' ? fmtDurationLong(v * 60) : metric === 'volume' ? `${compact(v)} ${settings.weightUnit}` : `${v} reps`);

  const dashboard = [
    { label: 'Statistics', icon: BarChart3, to: '/statistics' },
    { label: 'Exercises', icon: Dumbbell, to: '/exercises' },
    { label: 'Measures', icon: Ruler, to: '/measures' },
    { label: 'Calendar', icon: CalendarDays, to: '/calendar' },
  ];

  return (
    <Page>
      <Header
        title={settings.name || 'Profile'}
        right={
          <button onClick={() => nav('/settings')} className="press text-white">
            <SettingsIcon size={22} />
          </button>
        }
      />
      <div className="px-4 pb-10">
        <button onClick={() => nav('/settings')} className="flex w-full items-center gap-4 py-2 text-left">
          <Avatar size={64} />
          <div>
            <div className="text-lg font-semibold">{settings.name || 'Set your name'}</div>
            <div className="mt-0.5 text-sm text-muted">
              <span className="font-semibold text-white">{workouts.length}</span> workouts
            </div>
          </div>
        </button>

        <div className="mt-4 rounded-2xl bg-card p-4">
          <div className="font-semibold">{headline}</div>
          <div className="mb-3 text-xs text-muted">Last 12 weeks</div>
          <BarsChart key={metric} data={weeks} fmt={fmtMetric} height={170} />
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {(['duration', 'volume', 'reps'] as WeekMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`press rounded-full py-1.5 text-sm font-semibold capitalize ${metric === m ? 'bg-accent' : 'bg-card2 text-white/80'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 text-sm font-semibold text-muted">Dashboard</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {dashboard.map(({ label, icon: Icon, to }, i) => (
            <motion.button
              key={label}
              onClick={() => nav(to)}
              className="press flex items-center gap-3 rounded-xl bg-card px-4 py-3.5 font-semibold"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
            >
              <Icon size={20} className="text-accent" /> {label}
            </motion.button>
          ))}
        </div>

        <div className="mb-2 mt-6 text-sm font-semibold text-muted">Workouts</div>
        {workouts.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted">No workouts yet</div>
        ) : (
          <WorkoutList workouts={workouts} />
        )}
      </div>
    </Page>
  );
}
