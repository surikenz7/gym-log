import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Check, Trophy } from 'lucide-react';
import { forwardRef, useImperativeHandle } from 'react';
import { distTo, FIELDS, fmtNum, fmtSet, isShortDistance, kgTo, toKg, toMeters, type Field } from '../lib/units';
import type { PRKind } from '../lib/stats';
import type { ExerciseType, Settings, WSet } from '../types';
import { DurationInput, NumInput } from './inputs';
import { useRotated } from '../lib/orientation';

export type EditorMode = 'active' | 'routine' | 'edit';

export function gridCols(type: ExerciseType, mode: EditorMode, rpe: boolean) {
  const n = FIELDS[type].length + (rpe && mode !== 'routine' ? 1 : 0);
  return `2.25rem minmax(0,1fr) repeat(${n}, ${n > 2 ? '3.6rem' : '4.4rem'})${mode === 'active' ? ' 2.6rem' : ''}`;
}

export const SET_TYPE_STYLE: Record<WSet['type'], { label: string; cls: string; name: string }> = {
  normal: { label: '', cls: 'text-white', name: 'Normal Set' },
  warmup: { label: 'W', cls: 'text-warn', name: 'Warm Up Set' },
  failure: { label: 'F', cls: 'text-danger', name: 'Failure Set' },
  drop: { label: 'D', cls: 'text-violet-400', name: 'Drop Set' },
};

export interface SetRowHandle {
  shake: () => void;
}

interface Props {
  set: WSet;
  number: number;
  type: ExerciseType;
  mode: EditorMode;
  prev?: WSet;
  placeholder?: Partial<WSet>;
  settings: Settings;
  pr?: PRKind[];
  onChange: (patch: Partial<WSet>) => void;
  onToggle: () => void;
  onDelete: () => void;
  onTypeClick: () => void;
}

export const SetRow = forwardRef<SetRowHandle, Props>(function SetRow(
  { set, number, type, mode, prev, placeholder, settings, pr, onChange, onToggle, onDelete, onTypeClick },
  ref,
) {
  const shakeCtl = useAnimationControls();
  // swipe-to-delete measures screen-space movement, so it's off while the page is counter-rotated
  const rotated = useRotated();
  useImperativeHandle(ref, () => ({
    shake: () => void shakeCtl.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.35 } }),
  }));
  const short = isShortDistance(type);
  const fields = FIELDS[type];
  const showRpe = settings.showRpe && mode !== 'routine';
  const done = mode === 'active' && set.done;
  const st = SET_TYPE_STYLE[set.type];

  const ph = (f: Field): string => {
    const v = placeholder?.[f];
    if (v == null) return '-';
    if (f === 'weight') return fmtNum(kgTo(v, settings.weightUnit));
    if (f === 'distance') return fmtNum(distTo(v, settings.distanceUnit, short));
    if (f === 'duration') return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
    return String(v);
  };

  const input = (f: Field) => {
    const cls = done ? 'focus:bg-done/20' : '';
    if (f === 'duration')
      return <DurationInput key={f} className={cls} value={set.duration} placeholder={ph(f)} onChange={(v) => onChange({ duration: v })} />;
    if (f === 'reps')
      return <NumInput key={f} className={cls} integer value={set.reps} placeholder={ph(f)} onChange={(v) => onChange({ reps: v })} />;
    if (f === 'weight')
      return (
        <NumInput
          key={f}
          className={cls}
          value={set.weight == null ? null : kgTo(set.weight, settings.weightUnit)}
          placeholder={ph(f)}
          onChange={(v) => onChange({ weight: v == null ? null : toKg(v, settings.weightUnit) })}
        />
      );
    return (
      <NumInput
        key={f}
        className={cls}
        value={set.distance == null ? null : distTo(set.distance, settings.distanceUnit, short)}
        placeholder={ph(f)}
        onChange={(v) => onChange({ distance: v == null ? null : toMeters(v, settings.distanceUnit, short) })}
      />
    );
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      className="relative overflow-hidden"
    >
      <div className="absolute inset-y-0 right-0 flex w-full items-center justify-end bg-danger pr-5 text-sm font-semibold">Delete</div>
      <motion.div
        drag={rotated ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        dragSnapToOrigin
        onDragEnd={(_, i) => {
          if (i.offset.x < -110 || i.velocity.x < -700) onDelete();
        }}
        animate={shakeCtl}
        className={`relative grid items-center gap-1 px-3 py-1 transition-colors duration-300 ${done ? 'bg-done-soft' : 'bg-card'}`}
        style={{ gridTemplateColumns: gridCols(type, mode, settings.showRpe), boxShadow: done ? 'inset 3px 0 0 rgb(var(--done))' : undefined }}
      >
        <button onClick={onTypeClick} className={`press relative h-8 text-center font-display text-lg font-bold ${st.cls} ${done ? '' : 'cut-sm bg-card2'}`}>
          {st.label || number}
          <AnimatePresence>
            {pr && (
              <motion.span
                className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-warn text-black shadow"
                initial={{ scale: 0, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 14 }}
              >
                <Trophy size={11} strokeWidth={2.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button
          className="truncate px-1 text-center text-sm text-muted"
          onClick={() => prev && onChange({ weight: prev.weight, reps: prev.reps, duration: prev.duration, distance: prev.distance })}
        >
          {prev ? fmtSet(prev, type, settings) : '-'}
        </button>
        {fields.map(input)}
        {showRpe && <NumInput value={set.rpe} placeholder="RPE" onChange={(v) => onChange({ rpe: v == null ? null : Math.min(10, v) })} />}
        {mode === 'active' && (
          <motion.button
            key={String(done)}
            onClick={onToggle}
            initial={done ? { scale: 0.6 } : false}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 14 }}
            className={`cut-sm ml-auto flex h-8 w-9 items-center justify-center ${done ? 'bg-done text-black' : 'bg-card2 text-muted'}`}
          >
            <Check size={20} strokeWidth={3} />
          </motion.button>
        )}
      </motion.div>
    </motion.div>
  );
});
