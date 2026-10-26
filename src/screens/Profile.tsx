import { format, startOfWeek, subWeeks } from 'date-fns';
import { motion } from 'framer-motion';
import { BarChart3, CalendarDays, Camera, Sparkles, Users, ChevronRight, Dumbbell, Flame, Medal, Ruler, Settings as SettingsIcon, Shield, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarsChart } from '../components/LazyCharts';
import { compact } from '../lib/units';
import { RankBadge, TierBar, TierName } from '../components/RankBadge';
import { Avatar, WorkoutList } from '../components/WorkoutFeed';
import { Header, Page, Sheet, SheetItem } from '../components/ui';
import { fileToAvatar } from '../lib/avatar';
import { typeOf } from '../lib/exercises';
import { useAllWorkouts } from '../lib/hooks';
import { ACHIEVEMENTS, levelFromXp, levelTitle } from '../lib/progress';
import { GROUPS, tierOf } from '../lib/ranks';
import { workoutVolume } from '../lib/stats';
import { fmtDurationLong, kgTo } from '../lib/units';
import { useJourney, useRanks } from '../lib/useProgress';
import { toast } from '../state/dialog';
import { useSettings } from '../state/settings';

/** Tap-to-change profile picture: choose from Photos / camera, or remove. */
export function AvatarPicker({ size, ring }: { size: number; ring?: string }) {
  const photo = useSettings((s) => s.avatar);
  const update = useSettings((s) => s.update);
  const input = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      update({ avatar: await fileToAvatar(f) });
      toast('Profile picture updated');
    } catch {
      toast('Couldn’t read that image');
    }
  };
  return (
    <>
      <button onClick={() => setMenu(true)} className="press relative shrink-0">
        <Avatar size={size} ring={ring} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg bg-accent">
          <Camera size={14} />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Profile picture">
        <SheetItem icon={<Camera size={20} />} label={photo ? 'Choose new photo' : 'Choose photo'} onClick={() => (setMenu(false), input.current?.click())} />
        <SheetItem icon={<Sparkles size={20} />} label="Decoration" onClick={() => (setMenu(false), nav('/decorations'))} />
        {photo && <SheetItem danger icon={<Trash2 size={20} />} label="Remove photo" onClick={() => (setMenu(false), update({ avatar: null }))} />}
      </Sheet>
    </>
  );
}

type WeekMetric = 'duration' | 'volume' | 'reps';

export function Profile() {
  const nav = useNavigate();
  const settings = useSettings();
  const workouts = useAllWorkouts() ?? [];
  const [metric, setMetric] = useState<WeekMetric>('duration');
  const journey = useJourney();
  const { ctx, data: ranks } = useRanks();
  const lvl = levelFromXp(journey?.xp ?? 0);
  const overall = ranks?.overall ?? null;

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
    { label: 'Ranks', icon: Shield, to: '/ranks' },
    { label: 'Trophies', icon: Medal, to: '/trophies' },
    { label: 'Friends', icon: Users, to: '/friends' },
    { label: 'Decorations', icon: Sparkles, to: '/decorations' },
  ];
  const trophies = journey ? journey.unlocked.size : 0;

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
        <div className="flex items-center gap-4 pt-2">
          <AvatarPicker size={88} ring={overall != null ? tierOf(overall).c[1] : undefined} />
          <div className="min-w-0 flex-1">
            <button onClick={() => nav('/settings')} className="block max-w-full truncate font-display text-3xl font-bold leading-tight">
              {settings.name || 'Set your name'}
            </button>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="rounded bg-accent px-1.5 py-0.5 font-display text-xs font-bold tracking-wider">LVL {lvl.level}</span>
              <span className="font-display text-sm uppercase tracking-wider text-white/70">{levelTitle(lvl.level)}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(lvl.into / lvl.need) * 100}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
            </div>
            <div className="tabular mt-1 text-[11px] text-muted">
              {lvl.into.toLocaleString('en-US')} / {lvl.need.toLocaleString('en-US')} XP to level {lvl.level + 1}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-line cut bg-card py-3 text-center">
          <div>
            <div className="font-display text-2xl font-bold">{workouts.length}</div>
            <div className="label !text-[10px]">Workouts</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold">
              <Flame size={20} className={journey?.totals.streak ? 'text-orange-500' : 'text-muted'} />
              {journey?.totals.streak ?? 0}
            </div>
            <div className="label !text-[10px]">Week streak</div>
          </div>
          <button onClick={() => nav('/trophies')}>
            <div className="font-display text-2xl font-bold">
              {trophies}
              <span className="text-sm text-muted">/{ACHIEVEMENTS.length}</span>
            </div>
            <div className="label !text-[10px]">Trophies</div>
          </button>
        </div>

        <motion.button
          onClick={() => nav('/ranks')}
          className="press relative mt-3 flex w-full items-center gap-4 overflow-hidden cut bg-card p-4 text-left"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {overall != null && <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 15% 50%, ${tierOf(overall).c[1]}, transparent 60%)` }} />}
          <RankBadge score={ctx === null ? null : overall} size={68} />
          <div className="relative min-w-0 flex-1">
            <div className="label">Overall rank</div>
            {ctx === null ? (
              <div className="text-sm text-white/80">Set your bodyweight to unlock strength ranks</div>
            ) : (
              <>
                <TierName score={overall} className="text-3xl leading-none" />
                {overall != null && <TierBar score={overall} className="mt-2" />}
                <div className="mt-2 flex gap-1.5">
                  {ranks?.groups.map((g) => (
                    <div key={g.group} className="flex flex-col items-center">
                      <RankBadge score={g.score || null} size={24} shine={false} />
                      <span className="text-[8px] uppercase text-muted">{GROUPS.find((x) => x.id === g.group)!.label.slice(0, 5)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <ChevronRight size={18} className="relative text-muted" />
        </motion.button>

        <div className="mt-3 cut bg-card p-4">
          <div className="font-display text-lg font-semibold">{headline}</div>
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

        <div className="label mt-6">Dashboard</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {dashboard.map(({ label, icon: Icon, to }, i) => (
            <motion.button
              key={label}
              onClick={() => nav(to)}
              className="press flex items-center gap-3 cut-sm bg-card px-4 py-3.5 font-display font-semibold uppercase tracking-wide"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
            >
              <Icon size={20} className="text-accent" /> {label}
            </motion.button>
          ))}
        </div>

        <div className="label mb-2 mt-6">Workouts</div>
        {workouts.length === 0 ? (
          <div className="cut bg-card p-6 text-center text-sm text-muted">No workouts yet</div>
        ) : (
          <WorkoutList workouts={workouts} />
        )}
      </div>
    </Page>
  );
}
