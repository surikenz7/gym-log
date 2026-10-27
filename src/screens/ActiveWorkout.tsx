import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, Timer, UserPlus } from 'lucide-react';
import { useAccount } from '../cloud/account';
import { PhotoStrip, TagPicker } from '../components/WorkoutExtras';
import { t } from '../i18n';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Button, Portal, spring, useNow } from '../components/ui';
import { db } from '../db/db';
import { typeOf } from '../lib/exercises';
import { beepRestDone } from '../lib/sound';
import { workoutSetCount, workoutVolume } from '../lib/stats';
import { fmtDuration, fmtVolume } from '../lib/units';
import { setKeepAwake } from '../lib/wakelock';
import { ask, confirmDialog, toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import { newSet, useWorkout } from '../state/workout';
import type { ActiveWorkout as ActiveWorkoutT, WExercise, Workout } from '../types';

function structure(exs: WExercise[]) {
  return exs.map((e) => `${e.exerciseId}:${e.sets.length}:${e.supersetId ? 'S' : ''}`).join('|');
}

async function maybeUpdateRoutine(w: Workout) {
  if (!w.routineId) return;
  const r = await db.routines.get(w.routineId);
  if (!r) return;
  const sameStructure = structure(r.exercises) === structure(w.exercises);
  if (sameStructure) return;
  const res = await ask({
    title: 'Update routine?',
    message: `You changed exercises or sets compared to "${r.name}". Save these changes to the routine?`,
    actions: [
      { label: 'Keep Original Routine', value: 'keep', style: 'cancel' },
      { label: 'Update Routine', value: 'update', style: 'primary' },
    ],
  });
  if (res !== 'update') return;
  const exercises = w.exercises.map((e) => ({
    ...e,
    sets: e.sets.map((s) => newSet(s.type, s)),
  }));
  await db.routines.update(r.id, { exercises, updatedAt: Date.now() });
  toast('Routine updated');
}

export function RestWatcher() {
  const rest = useWorkout((s) => s.active?.rest);
  const skip = useWorkout((s) => s.skipRest);
  const sound = useSettings((s) => s.sound);
  useEffect(() => {
    if (!rest) return;
    const ms = rest.endAt - Date.now();
    const t = setTimeout(() => {
      if (sound) beepRestDone();
      toast('Rest complete — next set! 💪');
      skip();
    }, Math.max(0, ms));
    return () => clearTimeout(t);
  }, [rest, skip, sound]);
  return null;
}

function RestBar() {
  const rest = useWorkout((s) => s.active?.rest);
  const { adjustRest, skipRest } = useWorkout();
  const now = useNow(200, !!rest);
  const left = rest ? Math.max(0, (rest.endAt - now) / 1000) : 0;
  const pct = rest ? Math.min(1, left / rest.duration) : 0;
  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <AnimatePresence>
      {rest && (
        <motion.div
          className="absolute inset-x-3 bottom-3 z-10"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={spring}
          style={{ marginBottom: 'var(--sab)' }}
        >
          <div className="flex items-center gap-3 cut bg-card2/95 p-3 shadow-2xl ring-1 ring-line backdrop-blur-xl">
            <div className="relative h-14 w-14">
              <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
                <circle cx="28" cy="28" r={R} fill="none" className="stroke-accent/20" strokeWidth="5" />
                <circle
                  cx="28"
                  cy="28"
                  r={R}
                  fill="none"
                  className="stroke-accent"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - pct)}
                  style={{ transition: 'stroke-dashoffset 0.2s linear' }}
                />
              </svg>
              <Timer size={18} className="absolute inset-0 m-auto text-accent" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted">Rest</div>
              <div className="font-display text-3xl font-bold tabular-nums">{fmtDuration(Math.ceil(left))}</div>
            </div>
            <button onClick={() => adjustRest(-15)} className="press rounded-lg bg-card px-3 py-2 text-sm font-semibold">
              -15
            </button>
            <button onClick={() => adjustRest(15)} className="press rounded-lg bg-card px-3 py-2 text-sm font-semibold">
              +15
            </button>
            <button onClick={skipRest} className="press cut-sm grad px-3 py-2 font-display text-sm font-bold uppercase">
              Skip
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Lets tagged friends know (shows up in their Activity). */
async function notifyTagged(w: Workout, tagged: NonNullable<Workout['tagged']>) {
  const a = useAccount.getState();
  if (!a.uid || !a.nick) return;
  const { notify } = await import('../cloud/social');
  const avatar = useSettings.getState().avatar ?? null;
  await Promise.all(tagged.map((f) => notify(f.uid, { kind: 'tag', from: a.uid!, nick: a.nick!, avatar, workoutId: w.id, workoutName: w.name }).catch(() => {})));
}

function SaveScreen({ open, onBack }: { open: boolean; onBack: () => void }) {
  const active = useWorkout((s) => s.active);
  const finish = useWorkout((s) => s.finish);
  const settings = useSettings();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [tagged, setTagged] = useState<NonNullable<Workout['tagged']>>([]);
  const [tagging, setTagging] = useState(false);
  const signedIn = useAccount((a) => a.status === 'signedIn');
  useEffect(() => {
    if (open && active) {
      setName(active.workout.name);
      setNotes(active.workout.notes ?? '');
    }
  }, [open]);
  if (!active) return null;
  const w = active.workout;
  const save = async () => {
    const saved = await finish(name, notes, { photos, tagged });
    setPhotos([]);
    setTagged([]);
    nav(`/summary/${saved.id}`);
    if (tagged.length) void notifyTagged(saved, tagged);
    await maybeUpdateRoutine(saved);
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex flex-col bg-bg pt-safe" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={spring}>
          <div className="flex h-12 items-center px-3">
            <button onClick={onBack} className="text-accent">
              <ChevronLeft size={26} />
            </button>
            <div className="flex-1 text-center font-display text-[17px] font-semibold uppercase tracking-wider">Save Workout</div>
            <button onClick={save} className="press cut-sm grad px-4 py-1.5 font-display text-sm font-bold uppercase">
              Save
            </button>
          </div>
          <div className="scroll-area flex-1 px-4 pt-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent py-3 text-2xl font-bold outline-none"
              placeholder="Workout title"
            />
            <div className="grid grid-cols-3 gap-2 border-y border-line py-4">
              <Stat label="Duration" value={fmtDuration((Date.now() - w.start) / 1000)} />
              <Stat label="Volume" value={fmtVolume(workoutVolume(w, typeOf), settings)} />
              <Stat label="Sets" value={String(workoutSetCount(w))} />
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder={t('How did your workout go? Leave some notes here...')}
              className="mt-4 w-full resize-none cut-sm bg-card p-3 outline-none placeholder:text-muted"
            />
            <div className="label mb-2 mt-5">{t('Photos')}</div>
            <PhotoStrip photos={photos} onChange={setPhotos} />
            {signedIn && (
              <>
                <div className="label mb-2 mt-5">{t('Trained with')}</div>
                <button onClick={() => setTagging(true)} className="press cut-sm flex w-full items-center gap-3 bg-card px-4 py-3 text-left">
                  <UserPlus size={20} className="text-accent" />
                  <span className="flex-1">{tagged.length ? tagged.map((f) => '@' + f.nick).join(', ') : t('Tag friends')}</span>
                  <ChevronRight size={18} className="text-muted" />
                </button>
                <TagPicker open={tagging} onClose={() => setTagging(false)} value={tagged} onChange={setTagged} />
              </>
            )}
            <div className="h-10" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Thin bar showing how many of the planned sets are ticked off. */
function WorkoutProgress({ w }: { w: ActiveWorkoutT['workout'] }) {
  const total = w.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = workoutSetCount(w);
  if (!total) return null;
  const p = done / total;
  return (
    <div className="relative h-[3px] w-full bg-white/10">
      <motion.div
        className="grad absolute inset-y-0 left-0"
        initial={false}
        animate={{ width: `${p * 100}%` }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        style={{ boxShadow: p > 0 ? '0 0 10px rgb(var(--accent) / 0.8)' : undefined }}
      />
      {p === 1 && <motion.div className="absolute inset-0 bg-done" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.85] }} transition={{ duration: 0.6 }} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label !text-[10px]">{label}</div>
      <div className="font-display text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function ActiveWorkout() {
  const { active, open, setOpen, mutate, startRest, discard } = useWorkout();
  const settings = useSettings();
  const [saving, setSaving] = useState(false);
  const now = useNow(1000, open);

  useEffect(() => {
    setKeepAwake(open && settings.keepAwake);
  }, [open, settings.keepAwake]);

  const w = active?.workout;
  // A new (or finished) workout never starts on the save screen.
  useEffect(() => setSaving(false), [w?.id]);

  const onFinish = async () => {
    if (!w) return;
    const done = workoutSetCount(w);
    if (done === 0) {
      const r = await ask({
        title: 'No completed sets',
        message: 'Tick the ✓ on the sets you did. Or discard this workout?',
        actions: [
          { label: 'Keep Logging', value: 'cancel', style: 'cancel' },
          { label: 'Discard Workout', value: 'discard', style: 'danger' },
        ],
      });
      if (r === 'discard') discard();
      return;
    }
    const pending = w.exercises.some((e) => e.sets.some((s) => !s.done && (s.weight != null || s.reps != null || s.duration != null || s.distance != null)));
    if (pending && !(await confirmDialog('Unfinished sets', 'Sets that are not ticked ✓ will be discarded.', 'Finish Anyway'))) return;
    setSaving(true);
  };

  const onDiscard = async () => {
    if (await confirmDialog('Discard workout?', 'This workout will be deleted and can’t be recovered.', 'Discard', true)) discard();
  };

  return (
    <Portal>
      <AnimatePresence>
        {open && w && (
          <motion.div
            className="fixed inset-0 z-30 flex flex-col bg-bg"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
          >
            <div className="border-b border-line bg-bg pt-safe">
              <div className="flex h-12 items-center px-3">
                <button onClick={() => setOpen(false)} className="press w-20 text-muted">
                  <ChevronDown size={28} />
                </button>
                <div className="flex-1 text-center font-display text-[17px] font-semibold uppercase tracking-wider">Log Workout</div>
                <div className="flex w-20 justify-end">
                  <button onClick={onFinish} className="press cut-sm grad px-4 py-1.5 font-display text-sm font-bold uppercase tracking-wider">
                    Finish
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                <Stat label="Duration" value={fmtDuration((now - w.start) / 1000)} />
                <Stat label="Volume" value={fmtVolume(workoutVolume(w, typeOf), settings)} />
                <Stat label="Sets" value={String(workoutSetCount(w))} />
              </div>
              <WorkoutProgress w={w} />
            </div>
            <div className="scroll-area flex-1 pb-40 pt-2">
              {w.exercises.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-8 py-10 text-center">
                  <div className="font-display text-2xl font-bold uppercase">Get started</div>
                  <div className="mt-1 text-sm text-muted">Add an exercise to start your workout</div>
                </motion.div>
              )}
              <WorkoutEditor
                mode="active"
                exercises={w.exercises}
                excludeWorkoutId={w.id}
                mutate={(fn) => mutate((wk) => fn(wk.exercises))}
                onSetDone={(wex) => {
                  // In a superset, rest only after the last exercise of the round.
                  if (wex.supersetId) {
                    const members = w.exercises.filter((e) => e.supersetId === wex.supersetId);
                    if (members[members.length - 1].id !== wex.id) return;
                  }
                  startRest(wex.restSec ?? settings.defaultRest);
                }}
                footer={
                  <Button variant="danger" className="w-full" onClick={onDiscard}>
                    Discard Workout
                  </Button>
                }
              />
            </div>
            <RestBar />
            <SaveScreen open={saving} onBack={() => setSaving(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export function MiniWorkoutBar() {
  const { active, open, setOpen } = useWorkout();
  const now = useNow(1000, !!active && !open);
  const rest = active?.rest;
  return (
    <AnimatePresence>
      {active && !open && (
        <motion.button
          onClick={() => setOpen(true)}
          className="glass relative mx-4 mb-2 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[26px] py-2.5 pl-4 pr-2.5 text-left"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={spring}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-done opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-done" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{active.workout.name}</div>
            <div className="text-xs text-muted tabular-nums">
              {fmtDuration((now - active.workout.start) / 1000)}
              {rest && rest.endAt > now && ` · Rest ${fmtDuration(Math.ceil((rest.endAt - now) / 1000))}`}
            </div>
          </div>
          <span className="grad rounded-full px-4 py-2 text-sm font-bold">Resume</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
