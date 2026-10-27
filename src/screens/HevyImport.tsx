import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, FileUp, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExerciseThumb } from '../components/ExerciseImage';
import { ExercisePicker } from '../components/ExercisePicker';
import { Button, Header, Page, Sheet, SheetItem } from '../components/ui';
import { db } from '../db/db';
import { inferType, matchExercise, parseHevyCsv, toWorkouts, type HevyParse } from '../import/hevy';
import { getExercise, useLibrary } from '../lib/exercises';
import { uid } from '../lib/id';
import { TYPE_LABELS } from '../lib/units';
import type { Exercise, ExerciseType } from '../types';
import { t } from '../i18n';

type Target = { id: string; exact: boolean } | { custom: ExerciseType };

export function HevyImport() {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const list = useLibrary((s) => s.list);
  const [parsed, setParsed] = useState<HevyParse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, Target>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [onlyNew, setOnlyNew] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number; customs: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (f: File) => {
    setError(null);
    try {
      const p = parseHevyCsv(await f.text());
      if (!p.workouts.length) throw new Error('No workouts found in this file.');
      const m: Record<string, Target> = {};
      // Existing custom exercises with the same name win (re-imports reuse them).
      for (const e of p.exercises) {
        const custom = list.find((x) => x.custom && x.name.toLowerCase() === e.name.toLowerCase());
        m[e.name] = custom ? { id: custom.id, exact: true } : (matchExercise(e.name, e.fields, list) ?? { custom: inferType(e.name, e.fields) });
      }
      setMapping(m);
      setParsed(p);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stats = useMemo(() => {
    if (!parsed) return null;
    const vals = Object.values(mapping);
    return {
      exact: vals.filter((v) => 'id' in v && v.exact).length,
      fuzzy: vals.filter((v) => 'id' in v && !v.exact).length,
      custom: vals.filter((v) => 'custom' in v).length,
      from: parsed.workouts[0].start,
      to: parsed.workouts[parsed.workouts.length - 1].start,
    };
  }, [parsed, mapping]);

  const run = async () => {
    if (!parsed) return;
    setBusy(true);
    const ids: Record<string, string> = {};
    const customs: Exercise[] = [];
    for (const [name, t] of Object.entries(mapping)) {
      if ('id' in t) ids[name] = t.id;
      else {
        const muscle = 'Other';
        const ex: Exercise = { id: 'c_' + uid(), name, type: t.custom, muscle, equipment: /\((\w[^)]*)\)/.exec(name)?.[1] ?? 'Other', secondary: [], custom: true };
        customs.push(ex);
        ids[name] = ex.id;
      }
    }
    const workouts = toWorkouts(parsed.workouts, (n) => ids[n]);
    const existing = new Set((await db.workouts.toArray()).map((w) => Math.round(w.start / 60000)));
    const fresh = workouts.filter((w) => !existing.has(Math.round(w.start / 60000)));
    await db.transaction('rw', db.workouts, db.exercises, async () => {
      await db.exercises.bulkPut(customs);
      await db.workouts.bulkPut(fresh);
    });
    await useLibrary.getState().reload();
    setBusy(false);
    setResult({ added: fresh.length, skipped: workouts.length - fresh.length, customs: customs.length });
  };

  const names = parsed?.exercises.filter((e) => !onlyNew || !('id' in mapping[e.name]) || !(mapping[e.name] as { exact: boolean }).exact) ?? [];

  return (
    <Page pushed>
      <Header back title={t('Import from Hevy')} />
      <div className="px-4 pb-12">
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="pt-12 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}>
                <CheckCircle2 size={72} className="mx-auto text-done" />
              </motion.div>
              <div className="mt-4 text-2xl font-bold">{t('Import complete')}</div>
              <div className="mt-2 text-muted">
                {result.added} workouts imported
                {result.skipped > 0 && <>, {result.skipped} already existed</>}
                {result.customs > 0 && <>, {result.customs} custom exercises created</>}.
              </div>
              <Button className="mt-8 w-full" onClick={() => nav('/history', { replace: true })}>
                {t('View History')}
              </Button>
            </motion.div>
          ) : !parsed ? (
            <motion.div key="start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="cut bg-card p-4">
                <div className="font-semibold">1. Export from Hevy</div>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-white/80">
                  <li>Open Hevy → Profile → ⚙️ Settings</li>
                  <li>Tap “Export & Import Data” → “Export Workouts”</li>
                  <li>{t('Save the CSV file to Files (iCloud Drive / On My iPhone)')}</li>
                </ol>
                <div className="mt-4 font-semibold">2. Choose the file here</div>
                <div className="mt-1 text-sm text-white/80">{t('Exercises are matched automatically. You can fix any match before importing. Importing the same file twice won’t create duplicates.')}</div>
              </div>
              <Button className="mt-4 w-full" onClick={() => fileRef.current?.click()}>
                <FileUp size={20} /> {t('Choose Hevy CSV')}
              </Button>
              {error && (
                <div className="mt-4 flex gap-2 rounded-xl bg-danger/10 p-3 text-sm text-danger">
                  <AlertCircle size={18} className="shrink-0" /> {error}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="review" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}>
              <div className="cut bg-card p-4">
                <div className="text-2xl font-bold">{parsed.workouts.length} workouts</div>
                <div className="text-sm text-muted">
                  {format(stats!.from, 'd MMM yyyy')} – {format(stats!.to, 'd MMM yyyy')} · {parsed.exercises.length} exercises
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-done/10 py-2 text-done">
                    <div className="text-lg font-bold">{stats!.exact}</div>matched
                  </div>
                  <div className="rounded-lg bg-warn/10 py-2 text-warn">
                    <div className="text-lg font-bold">{stats!.fuzzy}</div>check these
                  </div>
                  <div className="rounded-lg bg-accent-soft py-2 text-accent">
                    <div className="text-lg font-bold">{stats!.custom}</div>new custom
                  </div>
                </div>
              </div>

              <div className="mb-2 mt-5 flex items-center justify-between">
                <div className="font-semibold">{t('Exercise matching')}</div>
                <button onClick={() => setOnlyNew((v) => !v)} className="text-sm text-accent">
                  {onlyNew ? 'Show all' : 'Only needs review'}
                </button>
              </div>
              <div className="divide-y divide-line overflow-hidden cut bg-card">
                {names.map((e) => {
                  const t = mapping[e.name];
                  const ex = 'id' in t ? getExercise(t.id) : null;
                  return (
                    <button key={e.name} onClick={() => setEditing(e.name)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-card2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-muted">{e.name}</div>
                        <div className="mt-1 flex items-center gap-2">
                          {ex ? (
                            <>
                              <ExerciseThumb ex={ex} size={24} />
                              <span className="truncate font-medium">{ex.name}</span>
                              {!('exact' in t && t.exact) && <span className="shrink-0 rounded bg-warn/15 px-1.5 text-[10px] font-bold text-warn">CHECK</span>}
                            </>
                          ) : (
                            <>
                              <Sparkles size={18} className="text-accent" />
                              <span className="font-medium">New custom · {TYPE_LABELS[(t as { custom: ExerciseType }).custom]}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-muted" />
                    </button>
                  );
                })}
              </div>
              <Button className="mt-5 w-full" onClick={run} disabled={busy}>
                {busy ? 'Importing…' : `Import ${parsed.workouts.length} workouts`}
              </Button>
              <Button variant="ghost" className="mt-1 w-full" onClick={() => setParsed(null)}>
                {t('Choose another file')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void load(f);
        }}
      />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing ?? ''}>
        <SheetItem label={t('Choose from exercise library')} onClick={() => (setPicking(editing), setEditing(null))} />
        <SheetItem
          label={t('Create as new custom exercise')}
          onClick={() => {
            const e = parsed!.exercises.find((x) => x.name === editing)!;
            setMapping((m) => ({ ...m, [e.name]: { custom: inferType(e.name, e.fields) } }));
            setEditing(null);
          }}
        />
        {editing && 'id' in (mapping[editing] ?? {}) && !(mapping[editing] as { exact: boolean }).exact && (
          <SheetItem
            label={t('Match looks right ✓')}
            onClick={() => {
              setMapping((m) => ({ ...m, [editing]: { ...(m[editing] as { id: string }), exact: true } }));
              setEditing(null);
            }}
          />
        )}
      </Sheet>
      <ExercisePicker
        open={!!picking}
        single
        title={t('Match exercise')}
        onClose={() => setPicking(null)}
        onPick={([id]) => picking && setMapping((m) => ({ ...m, [picking]: { id, exact: true } }))}
      />
    </Page>
  );
}
