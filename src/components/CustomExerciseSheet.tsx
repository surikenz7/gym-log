import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { EQUIPMENT, MUSCLES, useLibrary } from '../lib/exercises';
import { uid } from '../lib/id';
import { TYPE_LABELS } from '../lib/units';
import { toast } from '../state/dialog';
import type { Exercise, ExerciseType } from '../types';
import { Button, Sheet } from './ui';
import { t } from '../i18n';

const selectCls = 'w-full appearance-none rounded-xl bg-card2 px-3 py-3 outline-none';

/** Create a custom exercise, or edit one (for built-ins only the type can be changed). */
export function CustomExerciseSheet({
  open,
  onClose,
  onSaved,
  initialName = '',
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: (ex: Exercise) => void;
  initialName?: string;
  editing?: Exercise;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ExerciseType>('weight_reps');
  const [muscle, setMuscle] = useState('Chest');
  const [equipment, setEquipment] = useState('None');
  const builtin = editing && !editing.custom;

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? initialName);
    setType(editing?.type ?? 'weight_reps');
    setMuscle(editing?.muscle ?? 'Chest');
    setEquipment(editing?.equipment ?? 'None');
  }, [open, editing, initialName]);

  const save = async () => {
    if (!name.trim()) return toast(t('Enter a name'));
    const ex: Exercise = builtin
      ? ({ id: editing.id, type } as Exercise)
      : { id: editing?.id ?? 'c_' + uid(), name: name.trim(), type, muscle, equipment, secondary: [], custom: true };
    if (builtin) await db.exercises.put({ ...(await db.exercises.get(editing.id)), ...ex });
    else await db.exercises.put(ex);
    await useLibrary.getState().reload();
    onSaved?.(useLibrary.getState().map[ex.id]);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit Exercise' : 'Create Exercise'}>
      <div className="space-y-4 px-4 pt-3">
        <label className="block">
          <div className="mb-1 text-sm text-muted">{t('Name')}</div>
          <input
            disabled={builtin}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-card2 px-3 py-3 outline-none disabled:opacity-50"
            placeholder="e.g. Cable Y-Raise"
          />
        </label>
        <label className="block">
          <div className="mb-1 text-sm text-muted">{t('Exercise Type')}</div>
          <select value={type} onChange={(e) => setType(e.target.value as ExerciseType)} className={selectCls}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {!builtin && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-sm text-muted">{t('Primary Muscle')}</div>
              <select value={muscle} onChange={(e) => setMuscle(e.target.value)} className={selectCls}>
                {MUSCLES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-sm text-muted">{t('Equipment')}</div>
              <select value={equipment} onChange={(e) => setEquipment(e.target.value)} className={selectCls}>
                {EQUIPMENT.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <Button className="w-full" onClick={save}>
          {t('Save')}
        </Button>
      </div>
    </Sheet>
  );
}
