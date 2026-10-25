import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { ClipboardList, MoreHorizontal, Pencil, Trash2, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExerciseThumb } from '../components/ExerciseImage';
import { formatMetric } from '../components/ExerciseInfo';
import { SET_TYPE_STYLE } from '../components/SetRow';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Button, Header, Page, Portal, Sheet, SheetItem } from '../components/ui';
import { db } from '../db/db';
import { getExercise, typeOf } from '../lib/exercises';
import { uid } from '../lib/id';
import { findPRs, PR_LABELS, workoutSetCount, workoutVolume, type PR } from '../lib/stats';
import { fmtDurationLong, fmtSet, fmtVolume } from '../lib/units';
import { confirmDialog, toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import { newSet } from '../state/workout';
import type { Workout } from '../types';

function usePRs(w: Workout | undefined): PR[] {
  const earlier = useLiveQuery(() => (w ? db.workouts.where('start').below(w.start).toArray() : []), [w?.id, w?.start]);
  return useMemo(() => (w && earlier ? findPRs(w, earlier, typeOf) : []), [w, earlier]);
}

function StatGrid({ w, prs }: { w: Workout; prs: number }) {
  const settings = useSettings();
  const items = [
    ['Duration', fmtDurationLong((w.end - w.start) / 1000)],
    ['Volume', fmtVolume(workoutVolume(w, typeOf), settings)],
    ['Sets', String(workoutSetCount(w))],
    ['Records', String(prs)],
  ];
  return (
    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-card p-4">
      {items.map(([l, v]) => (
        <div key={l}>
          <div className="text-xs text-muted">{l}</div>
          <div className="font-semibold">{v}</div>
        </div>
      ))}
    </div>
  );
}

function ExerciseBlocks({ w, prs }: { w: Workout; prs: PR[] }) {
  const settings = useSettings();
  const nav = useNavigate();
  return (
    <div className="space-y-2">
      {w.exercises.map((e) => {
        const ex = getExercise(e.exerciseId);
        let n = 0;
        return (
          <div key={e.id} className="rounded-2xl bg-card p-4">
            <button className="flex items-center gap-3" onClick={() => nav(`/exercises/${ex.id}`)}>
              <ExerciseThumb ex={ex} size={36} />
              <span className="font-semibold text-accent">{ex.name}</span>
            </button>
            {e.notes && <div className="mt-2 text-sm text-white/75">{e.notes}</div>}
            <div className="mt-3 space-y-1">
              {e.sets.map((s) => {
                const st = SET_TYPE_STYLE[s.type];
                const label = st.label || String(++n);
                const pr = prs.filter((p) => p.setId === s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 odd:bg-card2/60">
                    <span className={`w-5 text-center font-semibold ${st.cls}`}>{label}</span>
                    <span className="flex-1">{fmtSet(s, ex.type, settings)}</span>
                    {pr.length > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">
                        <Trophy size={12} /> {pr.length > 1 ? `${pr.length} PRs` : PR_LABELS[pr[0].kind]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WorkoutDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const w = useLiveQuery(() => db.workouts.get(id!), [id]);
  const prs = usePRs(w);
  const [menu, setMenu] = useState(false);

  if (!w) return <Page pushed><Header back title="Workout" /></Page>;

  const saveAsRoutine = async () => {
    setMenu(false);
    await db.routines.add({
      id: uid(),
      name: w.name,
      order: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      exercises: w.exercises.map((e) => ({ ...e, id: uid(), sets: e.sets.map((s) => newSet(s.type, s)) })),
    });
    toast('Saved as routine');
  };

  return (
    <Page pushed>
      <Header
        back
        title={w.name}
        right={
          <button onClick={() => setMenu(true)} className="press text-accent">
            <MoreHorizontal size={24} />
          </button>
        }
      />
      <div className="space-y-3 px-4 pb-10">
        <div>
          <div className="text-2xl font-bold">{w.name}</div>
          <div className="text-sm text-muted">{format(w.start, 'EEEE, d MMMM yyyy · HH:mm')}</div>
        </div>
        <StatGrid w={w} prs={prs.length} />
        {w.notes && <div className="rounded-2xl bg-card p-4 text-sm text-white/85">{w.notes}</div>}
        <ExerciseBlocks w={w} prs={prs} />
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)} title={w.name}>
        <SheetItem icon={<Pencil size={20} />} label="Edit Workout" onClick={() => (setMenu(false), nav(`/history/${w.id}/edit`))} />
        <SheetItem icon={<ClipboardList size={20} />} label="Save as Routine" onClick={saveAsRoutine} />
        <SheetItem
          danger
          icon={<Trash2 size={20} />}
          label="Delete Workout"
          onClick={async () => {
            setMenu(false);
            if (!(await confirmDialog('Delete workout?', 'This can’t be undone.', 'Delete', true))) return;
            await db.workouts.delete(w.id);
            nav(-1);
          }}
        />
      </Sheet>
    </Page>
  );
}

const toLocalInput = (t: number) => format(t, "yyyy-MM-dd'T'HH:mm");

export function WorkoutEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [w, setW] = useState<Workout | null>(null);
  useEffect(() => void db.workouts.get(id!).then((x) => setW(x ?? null)), [id]);
  if (!w) return null;
  const minutes = Math.round((w.end - w.start) / 60000);

  const save = async () => {
    const exercises = w.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.weight != null || s.reps != null || s.duration != null || s.distance != null).map((s) => ({ ...s, done: true })) }))
      .filter((e) => e.sets.length);
    await db.workouts.put({ ...w, exercises, exerciseIds: [...new Set(exercises.map((e) => e.exerciseId))] });
    toast('Workout saved');
    nav(-1);
  };

  return (
    <Page pushed className="pb-32">
      <div className="sticky top-0 z-20 bg-bg/90 pt-safe backdrop-blur-xl">
        <div className="flex h-12 items-center px-4">
          <button onClick={() => nav(-1)} className="w-16 text-left text-accent">
            Cancel
          </button>
          <div className="flex-1 text-center font-semibold">Edit Workout</div>
          <button onClick={save} className="press w-16 rounded-lg bg-accent py-1.5 text-sm font-semibold">
            Save
          </button>
        </div>
      </div>
      <div className="space-y-3 px-4 pb-4">
        <input value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} className="w-full bg-transparent py-2 text-2xl font-bold outline-none" />
        <div className="grid grid-cols-2 gap-2">
          <label className="rounded-xl bg-card p-3">
            <div className="text-xs text-muted">Start</div>
            <input
              type="datetime-local"
              value={toLocalInput(w.start)}
              onChange={(e) => {
                const start = new Date(e.target.value).getTime();
                if (start) setW({ ...w, start, end: start + (w.end - w.start) });
              }}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <label className="rounded-xl bg-card p-3">
            <div className="text-xs text-muted">Duration (min)</div>
            <input
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setW({ ...w, end: w.start + (Number(e.target.value.replace(/\D/g, '')) || 0) * 60000 })}
              className="w-full bg-transparent outline-none"
            />
          </label>
        </div>
        <textarea
          value={w.notes ?? ''}
          onChange={(e) => setW({ ...w, notes: e.target.value })}
          rows={2}
          placeholder="Notes"
          className="w-full resize-none rounded-xl bg-card p-3 text-sm outline-none placeholder:text-muted"
        />
      </div>
      <WorkoutEditor
        mode="edit"
        exercises={w.exercises}
        excludeWorkoutId={w.id}
        mutate={(fn) =>
          setW((prev) => {
            const next = structuredClone(prev!);
            fn(next.exercises);
            return next;
          })
        }
      />
    </Page>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: (Math.random() - 0.5) * window.innerWidth * 1.2,
        y: window.innerHeight * (0.6 + Math.random() * 0.5),
        r: Math.random() * 720 - 360,
        peak: -140 - Math.random() * 120,
        d: 1.6 + Math.random() * 1.4,
        delay: Math.random() * 0.25,
        c: ['#2f7cf6', '#22c55e', '#f5a524', '#ef4444', '#a855f7', '#ffffff'][i % 6],
        w: 6 + Math.random() * 6,
      })),
    [],
  );
  return (
    <Portal>
      <div className="pointer-events-none fixed inset-0 z-[65] overflow-hidden">
        {pieces.map((p, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-[18%] rounded-sm"
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

export function Summary() {
  const { id } = useParams();
  const nav = useNavigate();
  const settings = useSettings();
  const w = useLiveQuery(() => db.workouts.get(id!), [id]);
  const prs = usePRs(w);
  const count = useLiveQuery(() => db.workouts.count(), []);
  if (!w) return null;
  return (
    <Page className="pb-10">
      <Confetti />
      <div className="px-4 pt-safe">
        <motion.div className="pt-10 text-center" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
          <div className="text-6xl">🏆</div>
          <div className="mt-3 text-3xl font-bold">Great workout!</div>
          <div className="mt-1 text-muted">{count ? `This is your ${ordinal(count)} workout` : ''}</div>
        </motion.div>
        <motion.div className="mt-8 space-y-3" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
          <StatGrid w={w} prs={prs.length} />
          {prs.length > 0 && (
            <div className="rounded-2xl bg-card p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Trophy size={18} className="text-warn" /> New Personal Records
              </div>
              {prs.map((p, i) => {
                const ex = getExercise(p.exerciseId);
                return (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between gap-3 py-1.5 text-sm"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                  >
                    <span className="min-w-0 truncate">
                      {ex.name} <span className="text-muted">· {PR_LABELS[p.kind]}</span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatMetric(p.kind, p.value, ex.type, settings)}</span>
                  </motion.div>
                );
              })}
            </div>
          )}
          <ExerciseBlocks w={w} prs={prs} />
          <Button className="w-full" onClick={() => nav('/', { replace: true })}>
            Done
          </Button>
        </motion.div>
      </div>
    </Page>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
