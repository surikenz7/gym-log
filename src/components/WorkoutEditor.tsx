import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { ArrowLeftRight, GripVertical, Info, Link2, Plus, Trash2, Unlink } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { getExercise, useExercise } from '../lib/exercises';
import { previousSets } from '../lib/hooks';
import { uid } from '../lib/id';
import { newSet } from '../state/workout';
import type { WExercise, WSet } from '../types';
import { ExerciseCard } from './ExerciseCard';
import { ExerciseInfoSheet } from './ExerciseInfo';
import { ExerciseThumb } from './ExerciseImage';
import { ExercisePicker } from './ExercisePicker';
import type { EditorMode } from './SetRow';
import { Button, Sheet, SheetItem } from './ui';
import { t } from '../i18n';

const SUPERSET_COLORS = ['#a855f7', '#f59e0b', '#14b8a6', '#ec4899', '#84cc16', '#0ea5e9'];

export async function makeExercise(exerciseId: string, mode: EditorMode): Promise<WExercise> {
  const prev = await previousSets(exerciseId);
  const count = Math.max(1, Math.min(prev.length, 10));
  return {
    id: uid(),
    exerciseId,
    supersetId: null,
    notes: '',
    restSec: null,
    sets: Array.from({ length: count }, (_, i) => {
      const s = newSet(prev[i]?.type ?? 'normal');
      if (mode === 'routine' && prev[i]) Object.assign(s, { weight: prev[i].weight, reps: prev[i].reps, duration: prev[i].duration, distance: prev[i].distance });
      if (mode === 'edit') s.done = true;
      return s;
    }),
  };
}

function ReorderItem({ wex }: { wex: WExercise }) {
  const ex = useExercise(wex.exerciseId);
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={wex.id}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 bg-card px-4 py-2.5"
      whileDrag={{ scale: 1.03, boxShadow: '0 10px 30px rgba(0,0,0,.5)', zIndex: 10 }}
    >
      <ExerciseThumb ex={ex} size={36} />
      <div className="flex-1 truncate font-medium">{ex.name}</div>
      <div className="touch-none p-2 text-muted" onPointerDown={(e) => controls.start(e)}>
        <GripVertical size={20} />
      </div>
    </Reorder.Item>
  );
}

export function WorkoutEditor({
  exercises,
  mutate,
  mode,
  excludeWorkoutId,
  onSetDone,
  footer,
}: {
  exercises: WExercise[];
  mutate: (fn: (list: WExercise[]) => void) => void;
  mode: EditorMode;
  excludeWorkoutId?: string;
  onSetDone?: (wex: WExercise, set: WSet) => void;
  footer?: ReactNode;
}) {
  const [picker, setPicker] = useState<null | { replace?: string }>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [superset, setSuperset] = useState<string | null>(null);
  const [reorder, setReorder] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const ssIds = [...new Set(exercises.map((e) => e.supersetId).filter(Boolean))] as string[];
  const ssColor = (id?: string | null) => (id ? SUPERSET_COLORS[ssIds.indexOf(id) % SUPERSET_COLORS.length] : undefined);
  const menuWex = exercises.find((e) => e.id === menu);

  const onPick = async (ids: string[]) => {
    const added = await Promise.all(ids.map((id) => makeExercise(id, mode)));
    if (picker?.replace) {
      const target = picker.replace;
      mutate((l) => {
        const i = l.findIndex((e) => e.id === target);
        if (i >= 0) l[i] = { ...added[0], supersetId: l[i].supersetId, restSec: l[i].restSec };
      });
    } else mutate((l) => void l.push(...added));
  };

  return (
    <>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {exercises.map((wex) => (
            <motion.div
              key={wex.id}
              layout="position"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -60, transition: { duration: 0.2 } }}
            >
              <ExerciseCard
                wex={wex}
                mode={mode}
                excludeWorkoutId={excludeWorkoutId}
                supersetColor={ssColor(wex.supersetId)}
                onChange={(fn) =>
                  mutate((l) => {
                    const t = l.find((e) => e.id === wex.id);
                    if (t) fn(t);
                  })
                }
                onSetDone={onSetDone}
                onMenu={() => setMenu(wex.id)}
                onOpenInfo={() => setInfo(wex.exerciseId)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="space-y-2 px-4 pt-4">
        <Button className="w-full" onClick={() => setPicker({})}>
          <Plus size={20} /> {t('Add Exercise')}
        </Button>
        {footer}
      </div>

      <ExercisePicker
        open={!!picker}
        single={!!picker?.replace}
        title={picker?.replace ? 'Replace Exercise' : 'Add Exercise'}
        onClose={() => setPicker(null)}
        onPick={onPick}
      />

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menuWex ? getExercise(menuWex.exerciseId).name : ''}>
        <SheetItem icon={<GripVertical size={20} />} label={t('Reorder Exercises')} onClick={() => (setMenu(null), setReorder(true))} />
        <SheetItem icon={<ArrowLeftRight size={20} />} label={t('Replace Exercise')} onClick={() => (setMenu(null), setPicker({ replace: menu! }))} />
        {menuWex?.supersetId ? (
          <SheetItem
            icon={<Unlink size={20} />}
            label={t('Remove From Superset')}
            onClick={() => {
              const id = menu;
              setMenu(null);
              mutate((l) => {
                const t = l.find((e) => e.id === id)!;
                const sid = t.supersetId;
                t.supersetId = null;
                const rest = l.filter((e) => e.supersetId === sid);
                if (rest.length === 1) rest[0].supersetId = null;
              });
            }}
          />
        ) : (
          exercises.length > 1 && <SheetItem icon={<Link2 size={20} />} label={t('Add To Superset')} onClick={() => (setMenu(null), setSuperset(menu))} />
        )}
        <SheetItem icon={<Info size={20} />} label={t('Exercise Info')} onClick={() => (setMenu(null), setInfo(menuWex!.exerciseId))} />
        <SheetItem
          danger
          icon={<Trash2 size={20} />}
          label={t('Remove Exercise')}
          onClick={() => {
            const id = menu;
            setMenu(null);
            mutate((l) => {
              const i = l.findIndex((e) => e.id === id);
              if (i >= 0) l.splice(i, 1);
            });
          }}
        />
      </Sheet>

      <Sheet open={!!superset} onClose={() => setSuperset(null)} title={t('Superset with...')}>
        {exercises
          .filter((e) => e.id !== superset)
          .map((e) => {
            const ex = getExercise(e.exerciseId);
            return (
              <SheetItem
                key={e.id}
                icon={<ExerciseThumb ex={ex} size={32} />}
                label={ex.name}
                right={e.supersetId ? <span className="h-3 w-3 rounded-full" style={{ background: ssColor(e.supersetId) }} /> : undefined}
                onClick={() => {
                  const src = superset;
                  setSuperset(null);
                  mutate((l) => {
                    const a = l.find((x) => x.id === src)!;
                    const b = l.find((x) => x.id === e.id)!;
                    const sid = b.supersetId ?? a.supersetId ?? uid();
                    a.supersetId = sid;
                    b.supersetId = sid;
                    // Keep superset members next to each other.
                    const ia = l.indexOf(a);
                    l.splice(ia, 1);
                    l.splice(l.indexOf(b) + 1, 0, a);
                  });
                }}
              />
            );
          })}
      </Sheet>

      <Sheet open={reorder} onClose={() => setReorder(false)} title={t('Reorder Exercises')}>
        <Reorder.Group
          axis="y"
          values={exercises.map((e) => e.id)}
          onReorder={(ids: string[]) => mutate((l) => void l.splice(0, l.length, ...ids.map((id) => l.find((e) => e.id === id)!)))}
          className="divide-y divide-line"
        >
          {exercises.map((wex) => (
            <ReorderItem key={wex.id} wex={wex} />
          ))}
        </Reorder.Group>
        <div className="px-4 pt-4">
          <Button className="w-full" onClick={() => setReorder(false)}>
            {t('Done')}
          </Button>
        </div>
      </Sheet>

      <ExerciseInfoSheet exerciseId={info} onClose={() => setInfo(null)} />
    </>
  );
}
