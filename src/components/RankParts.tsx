import { motion } from 'framer-motion';
import { ChevronRight, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { uid } from '../lib/id';
import { LEVEL_NAMES, standardFor, targetForScore, tierIndex, TIERS, weightForScore, type Sex } from '../lib/ranks';
import { fmtDuration, fmtNum, kgTo, toKg } from '../lib/units';
import { useLatestBodyweight, useRankCtx } from '../lib/useProgress';
import { toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import type { Settings } from '../types';
import { NumInput } from './inputs';
import { RankBadge, TierBar, TierName } from './RankBadge';
import { t } from '../i18n';

/** Asks for the two things ranks depend on: sex and bodyweight (saved as a Measures entry). */
export function RankSetup({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const s = useSettings();
  const latest = useLatestBodyweight();
  const [sex, setSex] = useState<Sex | null>(s.sex ?? null);
  const [bw, setBw] = useState<number | null>(null);
  useEffect(() => {
    if (latest) setBw(+kgTo(latest, s.weightUnit).toFixed(1));
  }, [latest, s.weightUnit]);

  const save = async () => {
    if (!sex || !bw) return toast(t('Pick your sex and enter your bodyweight'));
    s.update({ sex });
    const kg = toKg(bw, s.weightUnit);
    if (!latest || Math.abs(latest - kg) > 0.05) await db.measures.add({ id: uid(), date: Date.now(), weight: kg });
    onDone?.();
  };

  return (
    <div className={compact ? '' : 'cut bg-card p-4'}>
      {!compact && (
        <div className="mb-3 flex items-center gap-3">
          <Lock size={18} className="text-accent" />
          <div>
            <div className="font-display text-lg font-bold">{t('Unlock your ranks')}</div>
            <div className="text-sm text-muted">{t('Ranks compare your lifts to strength standards for your sex and bodyweight.')}</div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(['male', 'female'] as Sex[]).map((x) => (
          <button key={x} onClick={() => setSex(x)} className={`press cut-sm py-2.5 font-semibold capitalize ${sex === x ? 'bg-accent' : 'bg-card2 text-white/80'}`}>
            {t(x === 'male' ? 'Male' : 'Female')}
          </button>
        ))}
      </div>
      <label className="mt-2 flex items-center gap-3 cut-sm bg-card2 px-4 py-1.5">
        <span className="flex-1 text-sm text-muted">{t('Bodyweight')}</span>
        <NumInput value={bw} onChange={setBw} placeholder="0" className="!w-24 !text-right text-lg" />
        <span className="text-sm text-muted">{s.weightUnit}</span>
      </label>
      <button onClick={save} className="press cut-sm grad mt-3 w-full py-3 font-display text-lg font-bold tracking-wider">
        {t('Save')}
      </button>
    </div>
  );
}

const fmtW = (kg: number, s: Settings) => `${fmtNum(kgTo(Math.max(0, kg), s.weightUnit))}`;

/** Rounds up to a loadable increment (2.5 kg / 5 lb). */
function loadable(kg: number, s: Settings) {
  if (s.weightUnit === 'lbs') return toKg(Math.ceil(kgTo(kg, 'lbs') / 5) * 5, 'lbs');
  return Math.ceil(kg / 2.5) * 2.5;
}

/**
 * Rank card for the exercise page: current rank, progress to the next tier,
 * and the "what weight is what rank" table for your bodyweight.
 */
export function ExerciseRankCard({ exerciseId, score }: { exerciseId: string; score: number | null }) {
  const ctx = useRankCtx();
  const s = useSettings();
  const nav = useNavigate();
  const [table, setTable] = useState(false);
  const std = standardFor(exerciseId);
  if (!std) return null;

  if (ctx === null)
    return (
      <div className="mt-5">
        <div className="label mb-2">{t('Rank')}</div>
        <RankSetup />
      </div>
    );
  if (!ctx) return null;

  const factor = ctx.factor ? ctx.factor(exerciseId) : 1;
  if (factor == null)
    return (
      <div className="mt-5">
        <div className="label mb-2">{t('Rank')}</div>
        <div className="cut flex items-center gap-4 bg-card p-4">
          <RankBadge score={null} size={56} />
          <div className="text-sm text-white/80">{t('Answer “How you log the weight” above to get this exercise ranked.')}</div>
        </div>
      </div>
    );
  const bw = ctx.bwAt(Date.now());
  const ti = score != null ? tierIndex(score) : -1;
  const next = TIERS[ti + 1];
  const isWeight = std.metric === 'ratio' || std.metric === 'bw';
  const target = (min: number, reps: number) => {
    if (isWeight) {
      const kg = weightForScore(exerciseId, min, reps, bw, ctx.sex, factor)!;
      if (std.metric === 'bw' && kg <= 0) return 'BW'; // bodyweight alone is enough
      return `${std.metric === 'bw' ? '+' : ''}${fmtW(loadable(kg, s), s)} ${s.weightUnit}`;
    }
    const v = Math.ceil(targetForScore(exerciseId, min, ctx.sex));
    return std.metric === 'seconds' ? fmtDuration(v) : `${v} reps`;
  };
  /** reps at bodyweight (no added weight) that reach a score, for pull-ups/dips */
  const bwReps = (min: number) => {
    const v = targetForScore(exerciseId, min, ctx.sex);
    // a single rep counts as exactly bodyweight (Epley treats 1 rep as the 1RM)
    return v <= 1 ? 1 : Math.max(2, Math.ceil(30 * (v - 1) - 1e-9));
  };

  return (
    <div className="mt-5">
      <div className="label mb-2">{t('Rank')}</div>
      <div className="overflow-hidden cut bg-card">
        <button onClick={() => nav('/ranks')} className="flex w-full items-center gap-4 p-4 text-left">
          <motion.div initial={{ scale: 0.6, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
            <RankBadge score={score} size={72} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <TierName score={score} className="text-3xl leading-none" />
            <div className="mt-1 text-sm text-muted">{score != null ? <>{t('Score')} <b className="text-white">{score}</b> / 1000</> : 'Log a working set to get ranked'}</div>
            {score != null && <TierBar score={score} className="mt-2" />}
          </div>
          <ChevronRight size={18} className="text-muted" />
        </button>
        {next && (
          <div className="border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">Next: </span>
            <span className="tier-text font-semibold" style={{ color: next.c[1] }}>
              {next.name}
            </span>
            <span className="text-muted"> at </span>
            <span className="font-semibold">
              {std.metric === 'bw'
                ? bwReps(next.min) <= 30
                  ? `${bwReps(next.min)} bodyweight reps`
                  : `${target(next.min, 5)} × 5`
                : isWeight
                  ? `${target(next.min, 1)} × 1 · ${target(next.min, 5)} × 5`
                  : target(next.min, 1)}
            </span>
          </div>
        )}
        <button onClick={() => setTable((t) => !t)} className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-semibold text-accent">
          {table ? 'Hide' : 'Show'} rank requirements
        </button>
        {table && (
          <div className="border-t border-line">
            <div className={`grid ${isWeight ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto]'} gap-x-4 px-4 py-2 text-[11px] font-semibold tracking-wide text-muted`}>
              <span>{t('RANK')}</span>
              {isWeight ? (
                <>
                  <span className="text-right">1 REP</span>
                  <span className="text-right">5 REPS</span>
                  <span className="text-right">10 REPS</span>
                </>
              ) : (
                <span className="text-right">{std.metric === 'seconds' ? 'TIME' : 'REPS'}</span>
              )}
            </div>
            {TIERS.slice(1).map((t, k) => (
              <div
                key={t.name}
                className={`grid ${isWeight ? 'grid-cols-[1fr_auto_auto_auto]' : 'grid-cols-[1fr_auto]'} items-center gap-x-4 px-4 py-2 text-sm tabular-nums odd:bg-card2/40 ${ti === k + 1 ? 'ring-1 ring-inset ring-white/20' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <RankBadge score={t.min} size={22} shine={false} />
                  <span className="tier-text font-semibold" style={{ color: t.c[1] }}>
                    {t.name}
                  </span>
                </span>
                {isWeight ? (
                  <>
                    <span className="text-right">{target(t.min, 1)}</span>
                    <span className="text-right">{target(t.min, 5)}</span>
                    <span className="text-right">{target(t.min, 10)}</span>
                  </>
                ) : (
                  <span className="text-right">{target(t.min, 1)}</span>
                )}
              </div>
            ))}
            <div className="px-4 py-2.5 text-xs text-muted">
              For your bodyweight ({fmtW(bw, s)} {s.weightUnit}, {ctx.sex}). {std.metric === 'bw' ? 'Weights are added on top of bodyweight. ' : ''}
              {LEVEL_NAMES[3]} lifters land around Gold.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
