import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Check, ChevronRight, Lock } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LevelBadge } from '../components/LevelBadge';
import { Rays } from '../components/RankBadge';
import { Header, Page } from '../components/ui';
import { t } from '../i18n';
import { useAllWorkouts } from '../lib/hooks';
import { LEVEL_TITLES, levelFromXp, titleIndex, xpToReach } from '../lib/progress';
import { useJourney } from '../lib/useProgress';

const EARN: [string, string][] = [
  ['Workout complete', '+100'],
  ['Each working set (up to 40 per workout)', '+10'],
  ['Each personal record', '+25'],
  ['First workout this week', '+50'],
  ['Week streak bonus, per week in a row (up to 10)', '+10'],
  ['Each new trophy', '+75'],
];

/** Level, title ladder and where your XP came from: the XP counterpart of the Ranks page. */
export function Levels() {
  const nav = useNavigate();
  const journey = useJourney();
  const workouts = useAllWorkouts();
  const xp = journey?.xp ?? 0;
  const lvl = levelFromXp(xp);
  const ti = titleIndex(lvl.level);
  const [light] = LEVEL_TITLES[ti][2];
  const recent = useMemo(
    () =>
      [...(workouts ?? [])]
        .sort((a, b) => b.start - a.start)
        .slice(0, 12)
        .flatMap((w) => {
          const r = journey?.byWorkout.get(w.id);
          return r ? [{ w, r, up: levelFromXp(r.xpBefore + r.xp).level > levelFromXp(r.xpBefore).level ? levelFromXp(r.xpBefore + r.xp).level : 0 }] : [];
        }),
    [workouts, journey],
  );

  return (
    <Page pushed>
      <Header large back title={t('Level')} />
      <div className="px-4 pb-12">
        <div className="relative flex flex-col items-center overflow-hidden pb-2 pt-4">
          <Rays color={light} size={340} />
          <motion.div initial={{ scale: 0.3, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 13 }}>
            <LevelBadge level={lvl.level} size={150} />
          </motion.div>
          <div className="label mt-3">{t('Level {n}', { n: lvl.level })}</div>
          <div className="font-display text-5xl font-bold uppercase leading-tight" style={{ color: light }}>
            {t(LEVEL_TITLES[ti][1])}
          </div>
          <div className="font-display text-lg text-muted">
            <span className="text-white">{xp.toLocaleString()}</span> XP
          </div>
          <div className="mt-2 h-2 w-56 overflow-hidden rounded-full bg-white/10">
            <motion.div className="grad h-full" initial={{ width: 0 }} animate={{ width: `${(lvl.into / lvl.need) * 100}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
          </div>
          <div className="mt-1.5 text-xs text-muted">
            {lvl.into.toLocaleString()} / {lvl.need.toLocaleString()} {t('XP to level {n}', { n: lvl.level + 1 })}
          </div>
        </div>

        <div className="label mb-2 mt-6">{t('Titles')}</div>
        <div className="space-y-1.5">
          {LEVEL_TITLES.map(([from, name, [c]], i) => {
            const to = LEVEL_TITLES[i + 1]?.[0];
            const reached = lvl.level >= from;
            const current = i === ti;
            const need = xpToReach(from) - xp;
            const span = to ? xpToReach(to) - xpToReach(from) : 0;
            return (
              <motion.div
                key={name}
                className="cut-sm flex items-center gap-3 bg-card px-3 py-2.5"
                style={current ? { boxShadow: `inset 0 0 0 1px ${c}`, backgroundImage: `linear-gradient(90deg, ${c}22, transparent 70%)` } : undefined}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.03 }}
              >
                <LevelBadge level={from} size={44} locked={!reached} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg font-bold uppercase leading-tight" style={reached ? { color: c } : undefined}>
                    {t(name)}
                  </div>
                  <div className="text-xs text-muted">{to ? t('Levels {a}–{b}', { a: from, b: to - 1 }) : t('Level {n}+', { n: from })}</div>
                  {current && to && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div className="h-full" style={{ background: c }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((xp - xpToReach(from)) / span) * 100)}%` }} transition={{ duration: 0.9 }} />
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs">
                  {current ? (
                    <span className="font-display font-bold uppercase" style={{ color: c }}>
                      {t('You')}
                    </span>
                  ) : reached ? (
                    <Check size={18} className="text-done" />
                  ) : (
                    <span className="flex items-center gap-1 text-muted">
                      <Lock size={12} /> {t('{n} XP to go', { n: need.toLocaleString() })}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="label mb-2 mt-6">{t('How to earn XP')}</div>
        <div className="cut divide-y divide-line/60 bg-card">
          {EARN.map(([what, n]) => (
            <div key={what} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="text-white/85">{t(what)}</span>
              <span className="shrink-0 font-display font-bold text-accent">{n} XP</span>
            </div>
          ))}
        </div>

        {recent.length > 0 && (
          <>
            <div className="label mb-2 mt-6">{t('Recent XP')}</div>
            <div className="space-y-1.5">
              {recent.map(({ w, r, up }) => (
                <button key={w.id} onClick={() => nav(`/history/${w.id}`)} className="press cut-sm flex w-full items-center gap-3 bg-card px-3 py-2.5 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{w.name}</div>
                    <div className="text-xs text-muted">{format(w.start, 'EEE d MMM')}</div>
                  </div>
                  {up > 0 && <span className="grad shrink-0 rounded-full px-2 py-0.5 font-display text-[11px] font-bold">LVL {up}</span>}
                  <span className="shrink-0 font-display font-bold text-accent">+{r.xp} XP</span>
                  <ChevronRight size={16} className="shrink-0 text-muted" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
