import { AnimatePresence, motion } from 'framer-motion';
import { Link2, MoreHorizontal, Plus, Timer } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useExercise } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { useHistoryBests, useHistoryRank, usePreviousSets } from '../lib/hooks';
import { setScore, tierIndex, tierOf } from '../lib/ranks';
import { fanfare } from '../lib/sound';
import { livePRs, PR_LABELS } from '../lib/stats';
import { FIELDS, fieldHeader, fmtDurationLong } from '../lib/units';
import { toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import { newSet } from '../state/workout';
import type { WExercise, WSet } from '../types';
import { ExerciseThumb } from './ExerciseImage';
import { RankBadge } from './RankBadge';
import { gridCols, SET_TYPE_STYLE, SetRow, type EditorMode, type SetRowHandle } from './SetRow';
import { Sheet, SheetItem } from './ui';

export const REST_OPTIONS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];

interface Props {
  wex: WExercise;
  mode: EditorMode;
  excludeWorkoutId?: string;
  supersetColor?: string;
  onChange: (fn: (wex: WExercise) => void) => void;
  onSetDone?: (wex: WExercise, set: WSet) => void;
  onMenu: () => void;
  onOpenInfo: () => void;
}

export function ExerciseCard({ wex, mode, excludeWorkoutId, supersetColor, onChange, onSetDone, onMenu, onOpenInfo }: Props) {
  const ex = useExercise(wex.exerciseId);
  const settings = useSettings();
  const prev = usePreviousSets(wex.exerciseId, excludeWorkoutId);
  const historyBests = useHistoryBests(wex.exerciseId, ex.type, mode === 'active' ? excludeWorkoutId : undefined);
  const prs = useMemo(() => (mode === 'active' && historyBests ? livePRs(wex.sets, historyBests, ex.type) : new Map()), [mode, historyBests, wex.sets, ex.type]);
  const rank = useHistoryRank(wex.exerciseId, mode === 'active' ? excludeWorkoutId : undefined);
  const scoreOf = (sets: WSet[]) => {
    if (!rank.ctx) return null;
    const bw = rank.ctx.bwAt(Date.now());
    const best = Math.max(0, ...sets.filter((s) => s.done).map((s) => setScore(wex.exerciseId, s, bw, rank.ctx!.sex)));
    return best || null;
  };
  const liveScore = mode === 'active' ? scoreOf(wex.sets) : null;
  const shownScore = rank.score != null || liveScore != null ? Math.max(rank.score ?? 0, liveScore ?? 0) : null;
  const [typeSheet, setTypeSheet] = useState<string | null>(null);
  const [restSheet, setRestSheet] = useState(false);
  const rows = useRef(new Map<string, SetRowHandle>());
  const rest = wex.restSec ?? settings.defaultRest;
  const fields = FIELDS[ex.type];

  let n = 0;
  const numbers = wex.sets.map((s) => (s.type === 'warmup' ? 0 : ++n));

  const toggle = (set: WSet, i: number) => {
    if (set.done) return onChange((w) => void (w.sets[i].done = false));
    const src = prev[i] ?? set.ph;
    const filled: Partial<WSet> = {};
    for (const f of fields) if (set[f] == null && src?.[f] != null) filled[f] = src[f];
    const merged = { ...set, ...filled };
    if (fields.every((f) => merged[f] == null)) return rows.current.get(set.id)?.shake();
    onChange((w) => Object.assign(w.sets[i], filled, { done: true }));
    onSetDone?.(wex, merged);
    const sets = wex.sets.map((s, j) => (j === i ? { ...merged, done: true } : s));
    if (mode === 'active' && rank.ctx) {
      const after = scoreOf(sets);
      if (after != null && (shownScore == null || tierIndex(after) > tierIndex(shownScore))) {
        haptic('success');
        fanfare(true);
        toast(`⬆ ${shownScore == null ? 'Ranked' : 'Rank up'} · ${ex.name} → ${tierOf(after).name.toUpperCase()}`);
        return;
      }
    }
    if (historyBests) {
      const hit = livePRs(sets, historyBests, ex.type).get(set.id);
      if (hit) {
        haptic('success');
        fanfare();
        toast(`🏆 New record · ${PR_LABELS[hit[0]]}`);
        return;
      }
    }
    haptic();
  };

  return (
    <motion.div layout="position" className="bg-card py-3" style={supersetColor ? { boxShadow: `inset 3px 0 0 ${supersetColor}` } : undefined}>
      <div className="flex items-center gap-3 px-4">
        <button onClick={onOpenInfo} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ExerciseThumb ex={ex} size={40} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-accent">{ex.name}</div>
            {mode === 'active' && shownScore != null && (
              <motion.div key={tierIndex(shownScore)} className="flex items-center gap-1" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                <RankBadge score={shownScore} size={16} shine={false} />
                <span className="font-display text-[11px] font-semibold uppercase tracking-wider" style={{ color: tierOf(shownScore).c[1] }}>
                  {tierOf(shownScore).name} · {shownScore}
                </span>
              </motion.div>
            )}
            {supersetColor && (
              <div className="flex items-center gap-1 text-xs font-medium" style={{ color: supersetColor }}>
                <Link2 size={12} /> Superset
              </div>
            )}
          </div>
        </button>
        <button onClick={onMenu} className="press -mr-1 p-1.5 text-muted">
          <MoreHorizontal size={22} />
        </button>
      </div>

      <textarea
        rows={1}
        value={wex.notes ?? ''}
        placeholder="Add notes here..."
        onChange={(e) => onChange((w) => void (w.notes = e.target.value))}
        className="mt-2 w-full resize-none bg-transparent px-4 text-sm text-white/80 outline-none placeholder:text-muted/70"
      />

      {mode !== 'edit' && (
        <button onClick={() => setRestSheet(true)} className="flex items-center gap-1.5 px-4 pb-2 pt-1 text-sm font-medium text-accent">
          <Timer size={16} /> Rest Timer: {rest ? fmtDurationLong(rest) : 'OFF'}
        </button>
      )}

      <div
        className="grid items-center gap-1 px-3 pb-1 pt-1 text-[11px] font-semibold tracking-wide text-muted"
        style={{ gridTemplateColumns: gridCols(ex.type, mode, settings.showRpe) }}
      >
        <div className="text-center">SET</div>
        <div className="text-center">PREVIOUS</div>
        {fields.map((f) => (
          <div key={f} className="text-center">
            {fieldHeader(f, ex.type, settings)}
          </div>
        ))}
        {settings.showRpe && mode !== 'routine' && <div className="text-center">RPE</div>}
        {mode === 'active' && <div className="text-center">✓</div>}
      </div>

      <AnimatePresence initial={false}>
        {wex.sets.map((s, i) => (
          <SetRow
            key={s.id}
            ref={(h) => (h ? rows.current.set(s.id, h) : rows.current.delete(s.id))}
            set={s}
            number={numbers[i]}
            type={ex.type}
            mode={mode}
            prev={prev[i]}
            placeholder={mode === 'active' ? (prev[i] ?? s.ph) : undefined}
            settings={settings}
            onChange={(patch) => onChange((w) => Object.assign(w.sets[i], patch))}
            onToggle={() => toggle(s, i)}
            pr={prs.get(s.id)}
            onDelete={() => (haptic(), onChange((w) => void w.sets.splice(i, 1)))}
            onTypeClick={() => setTypeSheet(s.id)}
          />
        ))}
      </AnimatePresence>

      <div className="px-4 pt-2">
        <button
          onClick={() =>
            onChange((w) => {
              const last = w.sets[w.sets.length - 1];
              const s = newSet(last?.type === 'warmup' ? 'normal' : (last?.type ?? 'normal'));
              if (last) {
                const vals = { weight: last.weight ?? last.ph?.weight, reps: last.reps ?? last.ph?.reps, duration: last.duration ?? last.ph?.duration, distance: last.distance ?? last.ph?.distance };
                // While logging, the previous row's values become grey placeholders; in editors they're copied.
                if (mode === 'active') {
                  if (!prev[w.sets.length]) s.ph = vals;
                } else Object.assign(s, vals);
              }
              if (mode === 'edit') s.done = true;
              w.sets.push(s);
            })
          }
          className="press flex w-full items-center justify-center gap-1.5 rounded-lg bg-card2 py-2 text-sm font-semibold"
        >
          <Plus size={16} /> Add Set
        </button>
      </div>

      <Sheet open={!!typeSheet} onClose={() => setTypeSheet(null)} title="Set Type">
        {(Object.keys(SET_TYPE_STYLE) as WSet['type'][]).map((t) => (
          <SheetItem
            key={t}
            icon={<span className={`inline-block w-5 text-center font-bold ${SET_TYPE_STYLE[t].cls}`}>{SET_TYPE_STYLE[t].label || '1'}</span>}
            label={SET_TYPE_STYLE[t].name}
            onClick={() => {
              const id = typeSheet;
              setTypeSheet(null);
              onChange((w) => {
                const s = w.sets.find((x) => x.id === id);
                if (s) s.type = t;
              });
            }}
          />
        ))}
        <SheetItem
          danger
          label="Remove Set"
          onClick={() => {
            const id = typeSheet;
            setTypeSheet(null);
            onChange((w) => void (w.sets = w.sets.filter((x) => x.id !== id)));
          }}
        />
      </Sheet>

      <Sheet open={restSheet} onClose={() => setRestSheet(false)} title={`Rest Timer · ${ex.name}`}>
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          {REST_OPTIONS.map((sec) => (
            <button
              key={sec}
              onClick={() => {
                setRestSheet(false);
                onChange((w) => void (w.restSec = sec));
              }}
              className={`press rounded-xl py-3 font-semibold ${sec === rest ? 'bg-accent' : 'bg-card2'}`}
            >
              {sec ? fmtDurationLong(sec) : 'Off'}
            </button>
          ))}
        </div>
      </Sheet>
    </motion.div>
  );
}
