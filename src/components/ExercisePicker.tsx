import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Search, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db/db';
import { EQUIPMENT, MUSCLES, searchExercises, useLibrary } from '../lib/exercises';
import type { Exercise } from '../types';
import { CustomExerciseSheet } from './CustomExerciseSheet';
import { ExerciseThumb } from './ExerciseImage';
import { Portal, Sheet, SheetItem, spring } from './ui';

export function ExerciseList({
  query,
  muscle,
  equipment,
  selected,
  onTap,
  showRecent,
}: {
  query: string;
  muscle: string | null;
  equipment: string | null;
  selected?: string[];
  onTap: (ex: Exercise) => void;
  showRecent?: boolean;
}) {
  const list = useLibrary((s) => s.list);
  const map = useLibrary((s) => s.map);
  const recentIds = useLiveQuery(async () => {
    const ws = await db.workouts.orderBy('start').reverse().limit(15).toArray();
    return [...new Set(ws.flatMap((w) => w.exerciseIds))].slice(0, 12);
  }, []);
  const filtered = useMemo(() => {
    let l = list;
    if (muscle) l = l.filter((e) => e.muscle === muscle);
    if (equipment) l = l.filter((e) => e.equipment === equipment);
    return searchExercises(l, query);
  }, [list, query, muscle, equipment]);
  const recent = showRecent && !query && !muscle && !equipment ? (recentIds ?? []).map((id) => map[id]).filter(Boolean) : [];

  const row = (e: Exercise, key: string) => {
    const sel = selected?.includes(e.id);
    return (
      <button
        key={key}
        onClick={() => onTap(e)}
        className={`cv-auto relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${sel ? 'bg-accent-soft' : 'active:bg-card2'}`}
      >
        <AnimatePresence>
          {sel && (
            <motion.div layoutId={undefined} className="absolute inset-y-0 left-0 w-1 bg-accent" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} />
          )}
        </AnimatePresence>
        <ExerciseThumb ex={e} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{e.name}</div>
          <div className="truncate text-sm text-muted">
            {e.muscle}
            {e.equipment !== 'None' ? ` · ${e.equipment}` : ''}
            {e.custom ? ' · Custom' : ''}
          </div>
        </div>
        <AnimatePresence>
          {sel && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-accent"
            >
              <Check size={15} strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  };

  return (
    <div>
      {recent.length > 0 && (
        <>
          <div className="px-4 pb-1 pt-3 text-sm font-semibold text-muted">Recent Exercises</div>
          {recent.map((e) => row(e, 'r' + e.id))}
          <div className="px-4 pb-1 pt-4 text-sm font-semibold text-muted">All Exercises</div>
        </>
      )}
      {filtered.map((e) => row(e, e.id))}
      {filtered.length === 0 && <div className="px-4 py-10 text-center text-muted">No exercises found</div>}
    </div>
  );
}

export function FilterBar({
  query,
  setQuery,
  muscle,
  setMuscle,
  equipment,
  setEquipment,
}: {
  query: string;
  setQuery: (q: string) => void;
  muscle: string | null;
  setMuscle: (m: string | null) => void;
  equipment: string | null;
  setEquipment: (m: string | null) => void;
}) {
  const [sheet, setSheet] = useState<'muscle' | 'equipment' | null>(null);
  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} className={`press flex-1 rounded-lg py-2 text-sm font-semibold ${active ? 'bg-accent' : 'bg-card2'}`}>
      {label}
    </button>
  );
  return (
    <div className="space-y-2 px-4 pb-2">
      <div className="flex items-center gap-2 rounded-xl bg-card2 px-3">
        <Search size={18} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercise"
          className="w-full bg-transparent py-2.5 outline-none placeholder:text-muted"
          enterKeyHint="search"
        />
        {query && (
          <button onClick={() => setQuery('')} className="text-muted">
            <X size={18} />
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {chip(equipment ?? 'All Equipment', !!equipment, () => setSheet('equipment'))}
        {chip(muscle ?? 'All Muscles', !!muscle, () => setSheet('muscle'))}
      </div>
      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet === 'muscle' ? 'Muscle Group' : 'Equipment'}>
        <SheetItem
          label={sheet === 'muscle' ? 'All Muscles' : 'All Equipment'}
          onClick={() => {
            (sheet === 'muscle' ? setMuscle : setEquipment)(null);
            setSheet(null);
          }}
        />
        {(sheet === 'muscle' ? MUSCLES : EQUIPMENT).map((m) => (
          <SheetItem
            key={m}
            label={m}
            right={(sheet === 'muscle' ? muscle : equipment) === m ? <Check size={18} className="text-accent" /> : undefined}
            onClick={() => {
              (sheet === 'muscle' ? setMuscle : setEquipment)(m);
              setSheet(null);
            }}
          />
        ))}
      </Sheet>
    </div>
  );
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
  single,
  title = 'Add Exercise',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (ids: string[]) => void;
  single?: boolean;
  title?: string;
}) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const close = () => {
    onClose();
    setTimeout(() => {
      setSelected([]);
      setQuery('');
    }, 300);
  };
  const done = (ids: string[]) => {
    onPick(ids);
    close();
  };

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col bg-bg"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
          >
            <div className="pt-safe">
              <div className="flex h-12 items-center px-4">
                <button onClick={close} className="w-16 text-left text-accent">
                  Cancel
                </button>
                <div className="flex-1 text-center font-semibold">{title}</div>
                <button onClick={() => setCreating(true)} className="flex w-16 justify-end text-accent">
                  Create
                </button>
              </div>
              <FilterBar {...{ query, setQuery, muscle, setMuscle, equipment, setEquipment }} />
            </div>
            <div className="scroll-area flex-1 pb-28">
              <ExerciseList
                showRecent
                query={query}
                muscle={muscle}
                equipment={equipment}
                selected={selected}
                onTap={(e) => {
                  if (single) return done([e.id]);
                  setSelected((s) => (s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id]));
                }}
              />
            </div>
            <AnimatePresence>
              {selected.length > 0 && (
                <motion.div
                  className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/90 to-transparent px-4 pb-safe pt-6"
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  transition={spring}
                >
                  <button onClick={() => done(selected)} className="press mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 font-semibold">
                    <Plus size={18} /> Add {selected.length} exercise{selected.length > 1 ? 's' : ''}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <CustomExerciseSheet
              open={creating}
              onClose={() => setCreating(false)}
              initialName={query}
              onSaved={(ex) => (single ? done([ex.id]) : setSelected((s) => [...s, ex.id]))}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
