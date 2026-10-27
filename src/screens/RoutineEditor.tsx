import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { Page } from '../components/ui';
import { db } from '../db/db';
import { uid } from '../lib/id';
import { confirmDialog, toast } from '../state/dialog';
import type { Routine, WExercise } from '../types';
import { t } from '../i18n';

export function RoutineEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const isNew = !id || id === 'new';
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<WExercise[]>([]);
  const [orig, setOrig] = useState<Routine | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isNew) return;
    void db.routines.get(id!).then((r) => {
      if (!r) return nav('/', { replace: true });
      setOrig(r);
      setName(r.name);
      setNotes(r.notes ?? '');
      setExercises(r.exercises);
    });
  }, [id]);

  const save = async () => {
    if (!name.trim()) return toast(t('Give your routine a name'));
    if (!exercises.length) return toast(t('Add at least one exercise'));
    const now = Date.now();
    const r: Routine = {
      id: orig?.id ?? uid(),
      name: name.trim(),
      notes,
      folderId: orig ? orig.folderId : params.get('folder'),
      order: orig?.order ?? now,
      createdAt: orig?.createdAt ?? now,
      updatedAt: now,
      exercises: exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: false })) })),
    };
    await db.routines.put(r);
    toast(isNew ? 'Routine created' : 'Routine saved');
    nav(-1);
  };

  const cancel = async () => {
    if (dirty && !(await confirmDialog(t('Discard changes?'), t('Your changes to this routine will be lost.'), t('Discard'), true))) return;
    nav(-1);
  };

  return (
    <Page pushed className="pb-32">
      <div className="sticky top-0 z-20 bg-bg/90 pt-safe backdrop-blur-xl">
        <div className="flex h-12 items-center px-4">
          <button onClick={cancel} className="w-16 text-left text-accent">
            {t('Cancel')}
          </button>
          <div className="flex-1 text-center font-semibold">{isNew ? 'Create Routine' : 'Edit Routine'}</div>
          <button onClick={save} className="press w-16 rounded-lg bg-accent py-1.5 text-sm font-semibold">
            {t('Save')}
          </button>
        </div>
      </div>
      <div className="px-4 pb-3">
        <input
          value={name}
          onChange={(e) => (setName(e.target.value), setDirty(true))}
          placeholder={t('Routine title')}
          className="w-full bg-transparent py-3 text-2xl font-bold outline-none placeholder:text-muted/60"
        />
        <textarea
          value={notes}
          onChange={(e) => (setNotes(e.target.value), setDirty(true))}
          rows={1}
          placeholder={t('Notes (optional)')}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>
      <WorkoutEditor
        mode="routine"
        exercises={exercises}
        mutate={(fn) => {
          setDirty(true);
          setExercises((prev) => {
            const next = structuredClone(prev);
            fn(next);
            return next;
          });
        }}
      />
    </Page>
  );
}
