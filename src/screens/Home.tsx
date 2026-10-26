import { addDays, format, isSameDay, isSameWeek, startOfWeek } from 'date-fns';
import { motion } from 'framer-motion';
import { Flame, Upload, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RankBadge, TierName } from '../components/RankBadge';
import { Avatar, WorkoutList } from '../components/WorkoutFeed';
import { Page } from '../components/ui';
import { typeOf } from '../lib/exercises';
import { useAllWorkouts } from '../lib/hooks';
import { levelFromXp, levelTitle } from '../lib/progress';
import { tierOf } from '../lib/ranks';
import { workoutVolume } from '../lib/stats';
import { fmtDurationLong, fmtVolume } from '../lib/units';
import { useJourney, useRanks } from '../lib/useProgress';
import { useSettings } from '../state/settings';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Night shift';
  if (h < 11) return 'Rise & grind';
  if (h < 17) return 'Let’s work';
  if (h < 22) return 'Evening session';
  return 'Night shift';
}

/** Mon–Sun strip: a filled block for every day you trained. */
function WeekStrip({ days }: { days: Set<number> }) {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(monday, i);
        const on = days.has(i);
        const today = isSameDay(d, new Date());
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <motion.div
              className={`cut-sm flex h-9 w-full items-center justify-center ${on ? 'grad' : today ? 'bg-card2 ring-1 ring-inset ring-accent' : 'bg-card2'}`}
              initial={{ scaleY: 0.3, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: 0.05 * i, type: 'spring', stiffness: 400, damping: 20 }}
            >
              {on && <Zap size={15} fill="currentColor" />}
            </motion.div>
            <span className={`font-display text-[10px] font-semibold uppercase ${today ? 'text-white' : 'text-muted'}`}>{format(d, 'EEEEE')}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Home() {
  const workouts = useAllWorkouts();
  const nav = useNavigate();
  const settings = useSettings();
  const journey = useJourney();
  const { ctx, data: ranks } = useRanks();
  const list = workouts ?? [];
  const week = list.filter((w) => isSameWeek(w.start, new Date(), { weekStartsOn: 1 }));
  const days = new Set(week.map((w) => (new Date(w.start).getDay() + 6) % 7));
  const weekTime = week.reduce((t, w) => t + (w.end - w.start) / 1000, 0);
  const weekVol = week.reduce((t, w) => t + workoutVolume(w, typeOf), 0);
  const streak = journey?.totals.streak ?? 0;
  const lvl = levelFromXp(journey?.xp ?? 0);
  const overall = ranks?.overall ?? null;

  return (
    <Page>
      <div className="space-y-3 px-4 pb-8 pt-safe">
        <div className="flex items-center justify-between gap-5 pt-5">
          <div className="min-w-0 flex-1">
            <div className="label">{settings.headline === 'date' ? `Week ${format(new Date(), 'w')}` : format(new Date(), 'EEEE · d MMMM')}</div>
            <h1 className="mt-0.5 break-words font-display text-[38px] font-bold uppercase leading-[0.95] tracking-tight">
              {settings.headline === 'motto' ? (
                <span className={`text-grad ${(settings.motto?.length ?? 0) > 14 ? 'text-[30px]' : ''}`}>{settings.motto?.trim() || 'No days off'}</span>
              ) : settings.headline === 'date' ? (
                <>
                  {format(new Date(), 'EEEE')}
                  <br />
                  <span className="text-grad">{format(new Date(), 'd MMMM')}</span>
                </>
              ) : (
                <>
                  {greeting()},
                  <br />
                  <span className="text-grad">{settings.name.trim() || 'Lifter'}</span>
                </>
              )}
            </h1>
          </div>
          {/* big profile picture filling the right side of the greeting, decoration included */}
          <button onClick={() => nav('/profile')} className="press relative mr-3 mt-7 shrink-0">
            <Avatar size={122} ring={overall != null ? tierOf(overall).c[1] : undefined} />
            <span className="grad absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 font-display text-xs font-bold shadow-lg">
              LVL {lvl.level}
            </span>
          </button>
        </div>

        <div className="cut bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="label">This week</div>
            {streak > 0 && (
              <div className="flex items-center gap-1 font-display text-sm font-bold uppercase tracking-wider text-orange-400">
                <Flame size={15} /> {streak} wk streak
              </div>
            )}
          </div>
          <WeekStrip days={days} />
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
            <div>
              <div className="font-display text-xl font-bold">{week.length}</div>
              <div className="label !text-[9px]">Sessions</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold">{weekTime ? fmtDurationLong(Math.round(weekTime / 60) * 60) : '0'}</div>
              <div className="label !text-[9px]">Time</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold">{fmtVolume(weekVol, settings)}</div>
              <div className="label !text-[9px]">Volume</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => nav('/ranks')} className="press cut relative flex items-center gap-3 overflow-hidden bg-card p-3 text-left">
            {overall != null && <div className="absolute inset-0 opacity-25" style={{ background: `radial-gradient(circle at 20% 50%, ${tierOf(overall).c[1]}, transparent 70%)` }} />}
            <RankBadge score={ctx === null ? null : overall} size={44} />
            <div className="relative min-w-0">
              <div className="label !text-[9px]">Rank</div>
              {ctx === null ? <div className="text-xs text-white/80">Tap to unlock</div> : <TierName score={overall} className="block truncate text-lg leading-tight" />}
              {overall != null && <div className="font-display text-xs text-muted">{overall} pts</div>}
            </div>
          </button>
          <button onClick={() => nav('/profile')} className="press cut bg-card p-3 text-left">
            <div className="label !text-[9px]">Level {lvl.level}</div>
            <div className="truncate font-display text-lg font-bold uppercase leading-tight">{levelTitle(lvl.level)}</div>
            <div className="mt-2 h-1.5 overflow-hidden bg-white/10">
              <motion.div className="grad h-full" initial={{ width: 0 }} animate={{ width: `${(lvl.into / lvl.need) * 100}%` }} transition={{ duration: 0.9 }} />
            </div>
            <div className="mt-1 text-[10px] text-muted">{lvl.need - lvl.into} XP to go</div>
          </button>
        </div>

        {workouts && workouts.length === 0 ? (
          <div className="cut bg-card p-5 text-center">
            <div className="font-display text-xl font-bold uppercase">No sessions yet</div>
            <div className="mt-1 text-sm text-muted">Log your first workout — or bring your history over from Hevy.</div>
            <button onClick={() => nav('/import/hevy')} className="press cut-sm mx-auto mt-4 flex items-center gap-2 bg-card2 px-4 py-2.5 font-display font-semibold uppercase tracking-wider">
              <Upload size={16} /> Import from Hevy
            </button>
          </div>
        ) : (
          <>
            <div className="label flex items-center gap-2 pt-3">
              <span className="h-3 w-1 bg-accent" /> Recent sessions
            </div>
            <WorkoutList workouts={list} />
          </>
        )}
      </div>
    </Page>
  );
}
