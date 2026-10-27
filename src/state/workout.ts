import { create } from 'zustand';
import { db, getKv, KV_ACTIVE, setKv } from '../db/db';
import { uid } from '../lib/id';
import type { ActiveWorkout, Routine, WExercise, WSet, Workout } from '../types';

interface WorkoutState {
  active: ActiveWorkout | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  start: (routine?: Routine) => void;
  mutate: (fn: (w: ActiveWorkout['workout']) => void) => void;
  startRest: (sec: number) => void;
  adjustRest: (delta: number) => void;
  skipRest: () => void;
  discard: () => void;
  finish: (name: string, notes: string, extra?: Pick<Workout, 'photos' | 'tagged'>) => Promise<Workout>;
}

export function newSet(type: WSet['type'] = 'normal', from?: Partial<WSet>): WSet {
  return {
    id: uid(),
    type,
    weight: from?.weight ?? null,
    reps: from?.reps ?? null,
    duration: from?.duration ?? null,
    distance: from?.distance ?? null,
    done: false,
  };
}

export function cloneExercises(src: WExercise[], keepValuesAsPlaceholder: boolean): WExercise[] {
  const ssMap = new Map<string, string>();
  return src.map((e) => ({
    ...e,
    id: uid(),
    supersetId: e.supersetId ? (ssMap.get(e.supersetId) ?? ssMap.set(e.supersetId, uid()).get(e.supersetId)) : null,
    sets: e.sets.map((s) => {
      const vals = { weight: s.weight, reps: s.reps, duration: s.duration, distance: s.distance };
      const hasVals = Object.values(vals).some((v) => v != null);
      // Routine values become grey placeholders, copied into the set when it's checked off empty.
      return keepValuesAsPlaceholder ? { ...newSet(s.type), ...(hasVals ? { ph: vals } : {}) } : newSet(s.type, vals);
    }),
  }));
}

function defaultName() {
  const h = new Date().getHours();
  if (h < 11) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  return 'Evening Workout';
}

export const useWorkout = create<WorkoutState>((set, get) => ({
  active: null,
  open: false,
  setOpen: (open) => set({ open }),
  start: (routine) => {
    const workout: ActiveWorkout['workout'] = {
      id: uid(),
      name: routine?.name ?? defaultName(),
      routineId: routine?.id ?? null,
      start: Date.now(),
      notes: '',
      exercises: routine ? cloneExercises(routine.exercises, true) : [],
    };
    set({ active: { workout, rest: null }, open: true });
  },
  mutate: (fn) => {
    const a = get().active;
    if (!a) return;
    const w = structuredClone(a.workout);
    fn(w);
    set({ active: { ...a, workout: w } });
  },
  startRest: (sec) => {
    const a = get().active;
    if (!a || sec <= 0) return;
    set({ active: { ...a, rest: { endAt: Date.now() + sec * 1000, duration: sec } } });
  },
  adjustRest: (delta) => {
    const a = get().active;
    if (!a?.rest) return;
    const endAt = a.rest.endAt + delta * 1000;
    if (endAt <= Date.now()) return set({ active: { ...a, rest: null } });
    set({ active: { ...a, rest: { endAt, duration: Math.max(1, a.rest.duration + delta) } } });
  },
  skipRest: () => {
    const a = get().active;
    if (a) set({ active: { ...a, rest: null } });
  },
  discard: () => set({ active: null, open: false }),
  finish: async (name, notes, extra) => {
    const a = get().active!;
    const exercises: WExercise[] = a.workout.exercises
      .map((e) => ({
        ...e,
        sets: e.sets.filter((s) => s.done).map(({ ph: _ph, ...s }) => s),
      }))
      .filter((e) => e.sets.length > 0);
    const workout: Workout = {
      ...a.workout,
      name: name.trim() || a.workout.name,
      notes,
      ...(extra?.photos?.length ? { photos: extra.photos } : {}),
      ...(extra?.tagged?.length ? { tagged: extra.tagged } : {}),
      end: Date.now(),
      exercises,
      exerciseIds: [...new Set(exercises.map((e) => e.exerciseId))],
    };
    await db.workouts.put(workout);
    set({ active: null, open: false });
    return workout;
  },
}));

// ---- persistence: survive iOS killing the PWA mid-workout ----
let timer: ReturnType<typeof setTimeout> | undefined;
function flush() {
  clearTimeout(timer);
  void setKv(KV_ACTIVE, useWorkout.getState().active);
}

export async function loadActiveWorkout() {
  const saved = await getKv<ActiveWorkout | null>(KV_ACTIVE);
  if (saved?.workout) {
    if (saved.rest && saved.rest.endAt < Date.now()) saved.rest = null;
    useWorkout.setState({ active: saved, open: false });
  }
  useWorkout.subscribe((s, prev) => {
    if (s.active === prev.active) return;
    clearTimeout(timer);
    // Structural changes (start/finish/discard) are written immediately, typing is debounced.
    if (!s.active || !prev.active) flush();
    else timer = setTimeout(flush, 400);
  });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
}
