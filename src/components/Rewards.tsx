import { AnimatePresence, animate, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getExercise } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { levelFromXp, levelTitle, type Achievement, type WorkoutReward } from '../lib/progress';
import { tierIndex, TIERS } from '../lib/ranks';
import { fanfare } from '../lib/sound';
import { themeOf } from '../lib/theme';
import { useSettings } from '../state/settings';
import { RankBadge, Rays, TierName } from './RankBadge';
import { Portal } from './ui';

/** Number that counts up from `from` to `value`. */
export function CountUp({ value, from = 0, fmt = (v) => Math.round(v).toLocaleString('en-US'), delay = 0, duration = 1.1 }: { value: number; from?: number; fmt?: (v: number) => string; delay?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const c = animate(from, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => ref.current && (ref.current.textContent = fmt(v)),
    });
    return () => c.stop();
  }, [value, from, delay, duration]);
  return <span ref={ref}>{fmt(from)}</span>;
}

export function Confetti({ colors }: { colors?: string[] }) {
  const theme = useSettings((s) => s.theme);
  const t = themeOf(theme);
  const palette = colors ?? [t.accent, t.accent2, '#ffffff', t.done, t.accent];
  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        x: (Math.random() - 0.5) * window.innerWidth * 1.3,
        y: window.innerHeight * (0.6 + Math.random() * 0.5),
        r: Math.random() * 720 - 360,
        peak: -150 - Math.random() * 140,
        d: 1.7 + Math.random() * 1.4,
        delay: Math.random() * 0.25,
        c: palette[i % palette.length],
        w: 6 + Math.random() * 7,
      })),
    [],
  );
  return (
    <Portal>
      <div className="pointer-events-none fixed inset-0 z-[65] overflow-hidden">
        {pieces.map((p, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-[18%]"
            style={{ width: p.w, height: p.w * 0.45, background: p.c }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
            animate={{ x: p.x, y: [0, p.peak, p.y], rotate: p.r, opacity: [1, 1, 0], scale: 1 }}
            transition={{ duration: p.d, delay: p.delay, ease: 'easeOut' }}
          />
        ))}
      </div>
    </Portal>
  );
}

export interface RankUp {
  /** null = overall rank */
  exerciseId: string | null;
  from: number | null;
  to: number;
}

/** Full-screen "RANK UP" moments, one per tap. */
export function RankUpOverlay({ items, onDone }: { items: RankUp[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const cur = items[i];
  useEffect(() => {
    if (!cur) return;
    haptic('success');
    fanfare(true);
  }, [i]);
  if (!cur) return null;
  const tier = TIERS[tierIndex(cur.to)];
  const next = () => (i + 1 < items.length ? setI(i + 1) : onDone());
  return (
    <Portal>
      <motion.div
        key={i}
        className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-[#060606] px-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={next}
      >
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 42%, ${tier.c[1]}40, transparent 60%)` }} />
        <motion.div className="label !text-sm !tracking-[0.4em] !text-white" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          Rank up
        </motion.div>
        <div className="relative my-6 flex items-center justify-center">
          <Rays color={tier.c[1]} size={420} />
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: [0, 1.25, 1], rotate: 0 }} transition={{ duration: 0.9, times: [0, 0.7, 1], ease: 'easeOut' }}>
            <RankBadge score={cur.to} size={200} />
          </motion.div>
        </div>
        <motion.div initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.55, type: 'spring', stiffness: 300, damping: 15 }}>
          <TierName score={cur.to} className="text-6xl" />
        </motion.div>
        <motion.div className="mt-2 font-display text-xl uppercase tracking-wide text-white/90" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          {cur.exerciseId ? getExercise(cur.exerciseId).name : 'Overall rank'}
        </motion.div>
        <motion.div className="mt-1 text-sm text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          {cur.from != null ? (
            <>
              <TierName score={cur.from} className="text-sm" /> → <TierName score={cur.to} className="text-sm" /> · {cur.to} pts
            </>
          ) : (
            `First rank · ${cur.to} pts`
          )}
        </motion.div>
        <motion.div className="absolute bottom-0 pb-safe text-xs text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
          <div className="pb-8">Tap to continue{items.length > 1 ? ` · ${i + 1}/${items.length}` : ''}</div>
        </motion.div>
      </motion.div>
    </Portal>
  );
}

/** XP gained this workout, with breakdown and an animated level bar. */
export function XpCard({ reward }: { reward: WorkoutReward }) {
  const before = levelFromXp(reward.xpBefore);
  const after = levelFromXp(reward.xpBefore + reward.xp);
  const leveled = after.level > before.level;
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 900);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!leveled) return;
    const t = setTimeout(() => (haptic('success'), fanfare()), 1900);
    return () => clearTimeout(t);
  }, [leveled]);
  const startPct = leveled ? 0 : (before.into / before.need) * 100;
  return (
    <div className="relative overflow-hidden cut bg-card p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="label">Experience</div>
          <div className="font-display text-4xl font-bold text-accent">
            +<CountUp value={reward.xp} delay={0.4} /> XP
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-sm uppercase tracking-wider text-white/70">{levelTitle(after.level)}</div>
          <div className="font-display text-2xl font-bold">LVL {after.level}</div>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-accent"
          initial={{ width: `${startPct}%` }}
          animate={{ width: phase ? `${(after.into / after.need) * 100}%` : `${startPct}%` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] text-muted tabular">
        {after.into.toLocaleString('en-US')} / {after.need.toLocaleString('en-US')} XP
      </div>
      <div className="mt-2 space-y-1">
        {reward.parts.map((p, i) => (
          <motion.div key={p.label} className="flex justify-between text-sm" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.12 }}>
            <span className="text-white/75">{p.label}</span>
            <span className="font-display font-semibold">+{p.xp}</span>
          </motion.div>
        ))}
      </div>
      <AnimatePresence>
        {leveled && phase === 1 && (
          <motion.div
            className="mt-3 cut-sm grad py-2.5 text-center font-display text-xl font-bold tracking-widest"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.12, 1], opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
          >
            LEVEL UP · {before.level} → {after.level}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface RankChange {
  exerciseId: string;
  from: number | null;
  to: number;
}

export function RankChanges({ changes }: { changes: RankChange[] }) {
  if (!changes.length) return null;
  return (
    <div className="cut bg-card p-4">
      <div className="label mb-2">Ranks</div>
      <div className="space-y-2.5">
        {changes.map((c, i) => {
          const up = c.from == null || tierIndex(c.to) > tierIndex(c.from);
          const delta = c.to - (c.from ?? 0);
          return (
            <motion.div key={c.exerciseId} className="flex items-center gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}>
              <motion.div initial={{ scale: 0.5 }} animate={{ scale: up ? [0.5, 1.25, 1] : 1 }} transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}>
                <RankBadge score={c.to} size={40} />
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{getExercise(c.exerciseId).name}</div>
                <div className="text-xs">
                  {c.from != null && tierIndex(c.from) !== tierIndex(c.to) && (
                    <>
                      <TierName score={c.from} className="text-xs" /> <span className="text-muted">→</span>{' '}
                    </>
                  )}
                  <TierName score={c.to} className="text-xs" />
                  <span className="text-muted"> · {c.to}</span>
                </div>
              </div>
              <span className={`font-display text-sm font-bold ${up ? 'text-warn' : 'text-done'}`}>{c.from == null ? 'NEW' : up ? 'RANK UP' : `+${delta}`}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function AchievementsUnlocked({ list }: { list: Achievement[] }) {
  if (!list.length) return null;
  return (
    <div className="cut border border-warn/40 bg-gradient-to-b from-warn/10 to-card p-4">
      <div className="label mb-3 !text-warn">Trophy unlocked</div>
      <div className="grid grid-cols-2 gap-2">
        {list.map((a, i) => (
          <motion.div
            key={a.id}
            className="flex items-center gap-2.5 cut-sm bg-black/30 p-2.5"
            initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.6 + i * 0.15, type: 'spring', stiffness: 300, damping: 14 }}
          >
            <span className="text-3xl">{a.icon}</span>
            <div className="min-w-0">
              <div className="font-display text-sm font-bold uppercase leading-tight">{a.name}</div>
              <div className="text-[11px] leading-tight text-muted">{a.desc}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
