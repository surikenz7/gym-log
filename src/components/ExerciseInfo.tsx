import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Pencil, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { getInstructions, useExercise } from '../lib/exercises';
import { bestSessionVolume, exerciseBests, exerciseSessions, PR_LABELS, repRecords, type PRKind, type SessionPoint } from '../lib/stats';
import { distLabel, distTo, fmtDuration, fmtNum, fmtSet, isShortDistance, kgTo, round, TYPE_LABELS } from '../lib/units';
import { useSettings } from '../state/settings';
import type { ExerciseType, Settings } from '../types';
import { ProgressChart } from './charts';
import { exerciseRanks, standardFor } from '../lib/ranks';
import { useRankCtx } from '../lib/useProgress';
import { CustomExerciseSheet } from './CustomExerciseSheet';
import { ExerciseRankCard } from './RankParts';
import { ExerciseDemo } from './ExerciseImage';
import { SET_TYPE_STYLE } from './SetRow';
import { Sheet } from './ui';

type Metric = { key: keyof SessionPoint; label: string; kind: 'weight' | 'reps' | 'duration' | 'distance' };

function metricsFor(type: ExerciseType): Metric[] {
  const w: Metric[] = [
    { key: 'heaviest', label: 'Heaviest Weight', kind: 'weight' },
    { key: 'oneRM', label: 'One Rep Max', kind: 'weight' },
    { key: 'bestSetVolume', label: 'Best Set Volume', kind: 'weight' },
    { key: 'sessionVolume', label: 'Session Volume', kind: 'weight' },
    { key: 'totalReps', label: 'Total Reps', kind: 'reps' },
  ];
  switch (type) {
    case 'weight_reps':
    case 'weighted_bodyweight':
      return w;
    case 'bodyweight_reps':
    case 'assisted_bodyweight':
      return [
        { key: 'bestReps', label: 'Most Reps', kind: 'reps' },
        { key: 'totalReps', label: 'Total Reps', kind: 'reps' },
      ];
    case 'duration':
      return [{ key: 'bestDuration', label: 'Best Time', kind: 'duration' }];
    case 'weight_duration':
      return [
        { key: 'heaviest', label: 'Heaviest Weight', kind: 'weight' },
        { key: 'bestDuration', label: 'Best Time', kind: 'duration' },
      ];
    case 'distance_duration':
      return [
        { key: 'bestDistance', label: 'Distance', kind: 'distance' },
        { key: 'bestDuration', label: 'Duration', kind: 'duration' },
      ];
    case 'weight_distance':
      return [
        { key: 'heaviest', label: 'Heaviest Weight', kind: 'weight' },
        { key: 'bestDistance', label: 'Distance', kind: 'distance' },
      ];
  }
}

export function formatMetric(kind: Metric['kind'] | PRKind, v: number, type: ExerciseType, s: Settings) {
  switch (kind) {
    case 'weight':
      return `${fmtNum(kgTo(v, s.weightUnit))} ${s.weightUnit}`;
    case '1rm':
    case 'volume':
      return `${round(kgTo(v, s.weightUnit), 1).toLocaleString('en-US')} ${s.weightUnit}`;
    case 'reps':
      return `${v} reps`;
    case 'duration':
      return fmtDuration(v);
    case 'distance': {
      const short = isShortDistance(type);
      return `${fmtNum(distTo(v, s.distanceUnit, short))} ${distLabel(s.distanceUnit, short)}`;
    }
  }
}

export function ExerciseDetailBody({ exerciseId, inSheet }: { exerciseId: string; inSheet?: boolean }) {
  const ex = useExercise(exerciseId);
  const settings = useSettings();
  const nav = useNavigate();
  const [tab, setTab] = useState<'summary' | 'history' | 'howto'>('summary');
  const [metric, setMetric] = useState(0);
  const [editing, setEditing] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const workouts = useLiveQuery(() => db.workouts.where('exerciseIds').equals(exerciseId).toArray(), [exerciseId]) ?? [];

  useEffect(() => void getInstructions(exerciseId).then(setSteps), [exerciseId]);

  const sessions = useMemo(() => exerciseSessions(workouts, exerciseId, ex.type), [workouts, exerciseId, ex.type]);
  const bests = useMemo(() => exerciseBests(workouts, exerciseId, ex.type), [workouts, exerciseId, ex.type]);
  const sessionBest = useMemo(() => bestSessionVolume(workouts, exerciseId, ex.type), [workouts, exerciseId, ex.type]);
  const reps = useMemo(() => repRecords(workouts, exerciseId), [workouts, exerciseId]);
  const recordRows: [string, string][] = [
    ...(['weight', '1rm', 'volume'] as PRKind[]).filter((k) => bests[k]).map((k): [string, string] => [PR_LABELS[k], formatMetric(k, bests[k]!, ex.type, settings)]),
    ...(sessionBest ? [['Best session volume', formatMetric('volume', sessionBest, ex.type, settings)] as [string, string]] : []),
    ...(['reps', 'duration', 'distance'] as PRKind[]).filter((k) => bests[k]).map((k): [string, string] => [PR_LABELS[k], formatMetric(k, bests[k]!, ex.type, settings)]),
  ];
  const rankCtx = useRankCtx();
  const rankScore = useMemo(() => (rankCtx ? (exerciseRanks(workouts, rankCtx).get(exerciseId)?.score ?? null) : null), [workouts, rankCtx, exerciseId]);
  const metrics = metricsFor(ex.type);
  const m = metrics[Math.min(metric, metrics.length - 1)];
  const history = [...workouts].sort((a, b) => b.start - a.start);

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-10 flex bg-card/95 backdrop-blur" style={inSheet ? undefined : { top: 'calc(env(safe-area-inset-top) + 3rem)', background: '#090909e6' }}>
        {(['summary', 'history', 'howto'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`relative flex-1 py-3 text-sm font-semibold ${tab === t ? 'text-white' : 'text-muted'}`}>
            {t === 'summary' ? 'Summary' : t === 'history' ? 'History' : 'How to'}
            {tab === t && <motion.div layoutId={`tab-${inSheet ? 's' : 'p'}`} className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="px-4 pt-4">
        {tab === 'summary' && (
          <>
            <ExerciseDemo ex={ex} />
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-2xl font-bold uppercase leading-tight">{ex.name}</div>
                <div className="mt-0.5 text-sm text-muted">
                  Primary: {ex.muscle}
                  {ex.secondary.length > 0 && <> · Secondary: {ex.secondary.join(', ')}</>}
                </div>
                <div className="text-sm text-muted">
                  {ex.equipment} · {TYPE_LABELS[ex.type]}
                </div>
              </div>
              <button onClick={() => setEditing(true)} className="press rounded-full bg-card2 p-2 text-muted">
                <Pencil size={16} />
              </button>
            </div>

            {standardFor(exerciseId) && <ExerciseRankCard exerciseId={exerciseId} score={rankScore} />}

            {sessions.length > 0 && (
              <>
                <div className="mt-5 rounded-2xl bg-card p-3">
                  <ProgressChart
                    key={m.key}
                    data={sessions.map((p) => ({ date: p.date, value: p[m.key] as number })).filter((p) => p.value > 0)}
                    fmt={(v) => formatMetric(m.kind, v, ex.type, settings)}
                  />
                </div>
                <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
                  {metrics.map((mt, i) => (
                    <button
                      key={mt.key}
                      onClick={() => setMetric(i)}
                      className={`press shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${i === metric ? 'bg-accent' : 'bg-card2 text-white/80'}`}
                    >
                      {mt.label}
                    </button>
                  ))}
                </div>

                <div className="label mt-6">Personal Records</div>
                <div className="mt-2 divide-y divide-line rounded-2xl bg-card">
                  {recordRows.map(([label, value], i) => (
                    <motion.div key={label} className="flex items-center gap-3 px-4 py-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                      <Trophy size={18} className="text-warn" />
                      <div className="flex-1">{label}</div>
                      <div className="font-semibold tabular-nums">{value}</div>
                    </motion.div>
                  ))}
                </div>

                {reps.length > 0 && (
                  <>
                    <div className="label mt-6">Set Records</div>
                    <div className="mt-1 text-xs text-muted">Heaviest weight you’ve lifted for each number of reps</div>
                    <div className="mt-2 overflow-hidden rounded-2xl bg-card">
                      <div className="grid grid-cols-[4rem_1fr_auto] gap-2 border-b border-line px-4 py-2 text-[11px] font-semibold tracking-wide text-muted">
                        <span>REPS</span>
                        <span>BEST WEIGHT</span>
                        <span>DATE</span>
                      </div>
                      {reps.map((r) => (
                        <button
                          key={r.reps}
                          onClick={() => !inSheet && nav(`/history/${r.workoutId}`)}
                          className="grid w-full grid-cols-[4rem_1fr_auto] gap-2 px-4 py-2.5 text-left odd:bg-card2/40"
                        >
                          <span className="font-semibold">{r.reps}</span>
                          <span className="tabular-nums">{formatMetric('weight', r.weight, ex.type, settings)}</span>
                          <span className="text-sm text-muted">{format(r.date, 'd MMM yyyy')}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {sessions.length === 0 && <div className="mt-6 rounded-2xl bg-card p-5 text-center text-sm text-muted">Log this exercise to see your progress chart and records.</div>}
          </>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {history.length === 0 && <div className="py-10 text-center text-muted">No history yet</div>}
            {history.map((w) => (
              <button
                key={w.id}
                onClick={() => !inSheet && nav(`/history/${w.id}`)}
                className="block w-full rounded-2xl bg-card p-4 text-left"
              >
                <div className="font-semibold">{w.name}</div>
                <div className="mb-2 text-sm text-muted">{format(w.start, 'EEEE, d MMM yyyy')}</div>
                {w.exercises
                  .filter((e) => e.exerciseId === exerciseId)
                  .flatMap((e) => e.sets)
                  .map((s, i) => (
                    <div key={s.id} className="flex gap-3 py-0.5 text-sm">
                      <span className={`w-5 font-semibold ${SET_TYPE_STYLE[s.type].cls}`}>{SET_TYPE_STYLE[s.type].label || i + 1}</span>
                      <span>{fmtSet(s, ex.type, settings)}</span>
                    </div>
                  ))}
              </button>
            ))}
          </div>
        )}

        {tab === 'howto' && (
          <>
            <ExerciseDemo ex={ex} />
            <ol className="mt-4 space-y-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                  <span className="text-white/85">{s}</span>
                </li>
              ))}
              {steps.length === 0 && <div className="py-6 text-center text-muted">No instructions for this exercise.</div>}
            </ol>
          </>
        )}
      </motion.div>
      <CustomExerciseSheet open={editing} onClose={() => setEditing(false)} editing={ex} />
    </div>
  );
}

export function ExerciseInfoSheet({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!exerciseId} onClose={onClose} tall>
      {exerciseId && <ExerciseDetailBody exerciseId={exerciseId} inSheet />}
    </Sheet>
  );
}
