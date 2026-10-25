import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { ClipboardList, Flame, MoreHorizontal, Pencil, Trash2, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExerciseThumb } from '../components/ExerciseImage';
import { formatMetric } from '../components/ExerciseInfo';
import { SET_TYPE_STYLE } from '../components/SetRow';
import { WatchCard } from '../components/WatchCard';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { RankBadge } from '../components/RankBadge';
import { AchievementsUnlocked, Confetti, CountUp, RankChanges, RankUpOverlay, XpCard, type RankChange, type RankUp } from '../components/Rewards';
import { Button, Header, Page, Sheet, SheetItem } from '../components/ui';
import { db } from '../db/db';
import { getExercise, typeOf } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { useAllWorkouts } from '../lib/hooks';
import { uid } from '../lib/id';
import { volumeComparison } from '../lib/progress';
import { STANDARDS, tierIndex } from '../lib/ranks';
import { fanfare } from '../lib/sound';
import { computeRanks, useJourney, useRankCtx } from '../lib/useProgress';
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
    <div className="grid grid-cols-4 gap-2 rounded-2xl border border-line bg-card p-4">
      {items.map(([l, v]) => (
        <div key={l}>
          <div className="label !text-[10px]">{l}</div>
          <div className="font-display text-lg font-semibold">{v}</div>
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
          <div className="font-display text-3xl font-bold uppercase">{w.name}</div>
          <div className="text-sm text-muted">{format(w.start, 'EEEE, d MMMM yyyy · HH:mm')}</div>
        </div>
        <StatGrid w={w} prs={prs.length} />
        {w.notes && <div className="rounded-2xl bg-card p-4 text-sm text-white/85">{w.notes}</div>}
        <WatchCard w={w} />
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

const HYPE = ['Crushed it', 'Beast mode', 'Gains secured', 'No days off', 'Iron sharpens iron', 'Built different', 'Pure work'];

export function Summary() {
  const { id } = useParams();
  const nav = useNavigate();
  const settings = useSettings();
  const w = useLiveQuery(() => db.workouts.get(id!), [id]);
  const prs = usePRs(w);
  const all = useAllWorkouts();
  const journey = useJourney();
  const ctx = useRankCtx();
  const reward = w ? journey?.byWorkout.get(w.id) : undefined;
  const [hype] = useState(() => HYPE[Math.floor(Math.random() * HYPE.length)]);

  const ranks = useMemo(() => {
    if (!w || !all || !ctx) return null;
    const before = computeRanks(
      all.filter((x) => x.start < w.start && x.id !== w.id),
      ctx,
    );
    const after = computeRanks(
      all.filter((x) => x.start <= w.start),
      ctx,
    );
    const changes: RankChange[] = [];
    for (const exId of new Set(w.exerciseIds)) {
      const a = after.exercises.get(exId);
      if (!a) continue;
      const b = before.exercises.get(exId)?.score ?? null;
      if (b == null || a.score > b) changes.push({ exerciseId: exId, from: b, to: a.score });
    }
    changes.sort((x, y) => y.to - x.to);
    const ups: RankUp[] = [];
    if (after.overall != null && (before.overall == null || tierIndex(after.overall) > tierIndex(before.overall)))
      ups.push({ exerciseId: null, from: before.overall, to: after.overall });
    for (const c of changes) if (c.from != null && tierIndex(c.to) > tierIndex(c.from)) ups.push(c);
    return { changes, ups };
  }, [w?.id, all, ctx]);

  const [overlay, setOverlay] = useState<RankUp[] | null>(null);
  const shown = useRef(false);
  useEffect(() => {
    if (!w || shown.current) return;
    if (ctx === undefined || (ctx && !ranks)) return; // wait until ranks are known
    shown.current = true;
    haptic('success');
    fanfare();
    if (ranks?.ups.length) {
      const t = setTimeout(() => setOverlay(ranks.ups), 1300);
      return () => clearTimeout(t);
    }
  }, [w, ranks, ctx]);

  if (!w) return null;
  const vol = workoutVolume(w, typeOf);
  const comparison = volumeComparison(vol);
  const tiles: [string, number, (v: number) => string][] = [
    ['Duration', (w.end - w.start) / 1000, (v) => fmtDurationLong(Math.round(v / 60) * 60 || Math.round(v))],
    ['Volume', vol, (v) => fmtVolume(v, settings)],
    ['Sets', workoutSetCount(w), (v) => String(Math.round(v))],
    ['Records', prs.length, (v) => String(Math.round(v))],
  ];

  return (
    <Page className="pb-10">
      <Confetti />
      {overlay && <RankUpOverlay items={overlay} onDone={() => setOverlay(null)} />}
      <div className="px-4 pt-safe">
        <div className="relative pt-8 text-center">
          <motion.div className="label !tracking-[0.35em]" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            Workout #{reward?.number ?? ''} complete
          </motion.div>
          <motion.div
            className="mt-1 font-display text-[52px] font-bold uppercase italic leading-none tracking-tight"
            initial={{ scale: 2.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.1 }}
          >
            {hype}
            <span className="text-accent">.</span>
          </motion.div>
          <motion.div className="mx-auto mt-3 h-1 w-24 bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.35, duration: 0.4 }} />
          {reward && reward.streak > 1 && (
            <motion.div
              className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 font-display text-sm font-semibold uppercase tracking-wider text-orange-400"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Flame size={16} /> {reward.streak}-week streak
            </motion.div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {tiles.map(([label, value, fmt], i) => (
            <motion.div
              key={label}
              className="rounded-2xl border border-line bg-card px-4 py-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.07 }}
            >
              <div className="label">{label}</div>
              <div className={`font-display text-2xl font-bold ${label === 'Records' && prs.length ? 'text-warn' : ''}`}>
                <CountUp value={value} fmt={fmt} delay={0.35 + i * 0.07} />
              </div>
            </motion.div>
          ))}
        </div>
        {comparison && (
          <motion.div className="mt-2 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-white/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            💪 You moved <b className="text-white">{fmtVolume(vol, settings)}</b> — that’s like lifting <b className="text-white">{comparison}</b>.
          </motion.div>
        )}

        <motion.div className="mt-3 space-y-3" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}>
          {reward && <XpCard reward={reward} />}
          {reward && <AchievementsUnlocked list={reward.achievements} />}
          {ranks && <RankChanges changes={ranks.changes} />}
          {ctx === null && w.exerciseIds.some((x) => STANDARDS[x]) && (
            <button onClick={() => nav('/ranks')} className="press flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left">
              <RankBadge score={null} size={40} />
              <div className="flex-1 text-sm">
                <div className="font-display font-semibold uppercase">Unlock your ranks</div>
                <div className="text-muted">Add your bodyweight to see how strong these lifts rank.</div>
              </div>
            </button>
          )}
          {prs.length > 0 && (
            <div className="rounded-2xl border border-line bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Trophy size={18} className="text-warn" /> <span className="label !text-white">New Personal Records</span>
              </div>
              {prs.map((p, i) => {
                const ex = getExercise(p.exerciseId);
                return (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between gap-3 py-1.5 text-sm"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
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
          <WatchCard w={w} />
          <ExerciseBlocks w={w} prs={prs} />
          <Button className="w-full" onClick={() => nav('/', { replace: true })}>
            Done
          </Button>
        </motion.div>
      </div>
    </Page>
  );
}
