import { addDays, format, isSameDay, isSameWeek, isToday, startOfWeek } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { t } from '../i18n';
import { Flame, Upload, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RankBadge, TierName } from '../components/RankBadge';
import { Avatar, WorkoutCard } from '../components/WorkoutFeed';
import { ReactionBar } from '../components/Reactions';
import { refreshFeed, useFeed } from '../cloud/socialStore';
import { useAccount } from '../cloud/account';
import { prCounts } from '../lib/stats';
import { useNavigate as useNav } from 'react-router-dom';
import type { Workout } from '../types';
import { Page } from '../components/ui';
import { typeOf } from '../lib/exercises';
import { useAllWorkouts } from '../lib/hooks';
import { levelFromXp, levelTitle } from '../lib/progress';
import { tierOf } from '../lib/ranks';
import { workoutVolume } from '../lib/stats';
import { fmtDurationLong, fmtVolume } from '../lib/units';
import { useJourney, useRanks } from '../lib/useProgress';
import { useSettings } from '../state/settings';

/** Your workouts and your friends' in one timeline, newest first (like Hevy's feed). */
function MixedFeed({ mine }: { mine: Workout[] }) {
  const nav = useNav();
  const following = useAccount((a) => a.following.join());
  const me = useAccount((a) => (a.status === 'signedIn' ? a.uid : null));
  const friends = useFeed((f) => f.items);
  const [limit, setLimit] = useState(20);
  const prs = useMemo(() => prCounts(mine, typeOf), [mine]);
  useEffect(() => void refreshFeed(true), [following]);
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && void refreshFeed();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);
  const items = useMemo(
    () =>
      [...mine.map((w) => ({ w, author: undefined as undefined | (typeof friends)[number]['author'] })), ...friends.map((f) => ({ w: f.w, author: f.author }))].sort(
        (a, b) => b.w.start - a.w.start,
      ),
    [mine, friends],
  );
  return (
    <div className="space-y-2">
      {items.slice(0, limit).map(({ w, author }, i) =>
        author ? (
          <WorkoutCard
            key={author.uid + w.id}
            w={w}
            prs={0}
            index={i}
            friend
            author={author}
            onOpen={() => nav(`/u/${author.uid}/w/${w.id}`)}
            footer={<ReactionBar owner={author.uid} w={w} author={author} />}
          />
        ) : (
          <WorkoutCard key={w.id} w={w} prs={prs.get(w.id) ?? 0} index={i} footer={me ? <ReactionBar owner={me} w={w} /> : undefined} />
        ),
      )}
      {items.length > limit && (
        <button onClick={() => setLimit((l) => l + 20)} className="w-full py-4 font-semibold text-accent">
          {t('Load more')}
        </button>
      )}
    </div>
  );
}

/** Phrases cycle every few seconds; after today's workout they switch to congratulations. */
const DONE_QUOTES = ['Good job', 'Gains secured', 'Rest up, champ', 'Workout done', 'Earned it', 'Proud of you', 'Recover & grow', 'One step closer'];
const GO_QUOTES = ['Time to grind', 'Let’s get it', 'No excuses', 'Show up today', 'Build the legend', 'Iron awaits'];

function RotatingGreeting({ done, name }: { done: boolean; name: string }) {
  const quotes = done ? DONE_QUOTES : [greeting(), ...GO_QUOTES];
  const [i, setI] = useState(() => (done ? Math.floor(Math.random() * DONE_QUOTES.length) : 0));
  useEffect(() => {
    setI(done ? Math.floor(Math.random() * DONE_QUOTES.length) : 0);
    const timer = setInterval(() => setI((x) => (x + 1) % quotes.length), 4500);
    return () => clearInterval(timer);
  }, [done]);
  return (
    <>
      <span className="relative block h-[1.9em] overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={`${done}${i}`}
            className="absolute inset-x-0 bottom-0"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            {t(quotes[i % quotes.length])}
            {done ? '!' : ','}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="text-grad">
        {name}
      </span>
    </>
  );
}

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
  const trainedToday = list.some((w) => isToday(w.start));

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
                <RotatingGreeting done={trainedToday} name={settings.name.trim() || t('Champ')} />
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
            <div className="label">{t('This week')}</div>
            {streak > 0 && (
              <div className="flex items-center gap-1 font-display text-sm font-bold uppercase tracking-wider text-orange-400">
                <Flame size={15} /> {t('{n} wk streak', { n: streak })}
              </div>
            )}
          </div>
          <WeekStrip days={days} />
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
            <div>
              <div className="font-display text-xl font-bold">{week.length}</div>
              <div className="label !text-[9px]">{t('Sessions')}</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold">{weekTime ? fmtDurationLong(Math.round(weekTime / 60) * 60) : '0'}</div>
              <div className="label !text-[9px]">{t('Time')}</div>
            </div>
            <div>
              <div className="font-display text-xl font-bold">{fmtVolume(weekVol, settings)}</div>
              <div className="label !text-[9px]">{t('Volume')}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => nav('/ranks')} className="press cut relative flex items-center gap-3 overflow-hidden bg-card p-3 text-left">
            {overall != null && <div className="absolute inset-0 opacity-25" style={{ background: `radial-gradient(circle at 20% 50%, ${tierOf(overall).c[1]}, transparent 70%)` }} />}
            <RankBadge score={ctx === null ? null : overall} size={44} />
            <div className="relative min-w-0">
              <div className="label !text-[9px]">{t('Rank')}</div>
              {ctx === null ? <div className="text-xs text-white/80">{t('Tap to unlock')}</div> : <TierName score={overall} className="block truncate text-lg leading-tight" />}
              {overall != null && <div className="font-display text-xs text-muted">{overall} pts</div>}
            </div>
          </button>
          <button onClick={() => nav('/levels')} className="press cut bg-card p-3 text-left">
            <div className="label !text-[9px]">{t('Level {n}', { n: lvl.level })}</div>
            <div className="truncate font-display text-lg font-bold uppercase leading-tight">{t(levelTitle(lvl.level))}</div>
            <div className="mt-2 h-1.5 overflow-hidden bg-white/10">
              <motion.div className="grad h-full" initial={{ width: 0 }} animate={{ width: `${(lvl.into / lvl.need) * 100}%` }} transition={{ duration: 0.9 }} />
            </div>
            <div className="mt-1 text-[10px] text-muted">{t('{n} XP to go', { n: lvl.need - lvl.into })}</div>
          </button>
        </div>

        {workouts && workouts.length === 0 ? (
          <div className="cut bg-card p-5 text-center">
            <div className="font-display text-xl font-bold uppercase">{t('No sessions yet')}</div>
            <div className="mt-1 text-sm text-muted">{t('Log your first workout — or bring your history over from Hevy.')}</div>
            <button onClick={() => nav('/import/hevy')} className="press cut-sm mx-auto mt-4 flex items-center gap-2 bg-card2 px-4 py-2.5 font-display font-semibold uppercase tracking-wider">
              <Upload size={16} /> {t('Import from Hevy')}
            </button>
          </div>
        ) : (
          <>
            <div className="label flex items-center gap-2 pt-3">
              <span className="h-3 w-1 bg-accent" /> {t('Recent sessions')}
            </div>
            <MixedFeed mine={list} />
          </>
        )}
      </div>
    </Page>
  );
}
