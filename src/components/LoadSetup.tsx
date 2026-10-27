import { AlertTriangle, Check } from 'lucide-react';
import { db } from '../db/db';
import { useExercise, useLibrary } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { loadMissing, loadQuestions, STANDARDS } from '../lib/ranks';
import type { Exercise, LoadSetup } from '../types';
import { t } from '../i18n';

/** Saves the load setup as an override row (built-in exercises keep their other fields). */
export async function saveLoad(id: string, patch: LoadSetup) {
  const cur = await db.exercises.get(id);
  await db.exercises.put({ ...(cur ?? ({ id } as Exercise)), load: { ...cur?.load, ...patch } });
  await useLibrary.getState().reload();
}

function Choice({ on, title, sub, onClick }: { on: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`press cut-sm flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${on ? 'bg-accent text-ink' : 'bg-card2'}`}
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-current' : 'border-line'}`}>{on && <Check size={12} strokeWidth={4} />}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className={`block text-xs ${on ? 'opacity-80' : 'text-muted'}`}>{sub}</span>
      </span>
    </button>
  );
}

const PULLEYS: [number, string, string][] = [
  [1, '1 pulley · 1:1', 'You pull exactly the weight on the stack'],
  [2, '2 pulleys · 2:1', 'Feels half as heavy — most dual-cable / crossover stations'],
  [3, '3 pulleys · 3:1', 'Feels a third as heavy'],
  [4, '4 pulleys · 4:1', 'Feels a quarter as heavy'],
];

/** "How do you log the weight?" — per side vs both sides, and the cable pulley ratio. */
export function LoadSetupCard({ exerciseId, bare }: { exerciseId: string; bare?: boolean }) {
  const ex = useExercise(exerciseId);
  const q = loadQuestions(ex);
  if (!q.side && !q.pulley) return null;
  const cable = ex.equipment === 'Cable';
  const set = (patch: LoadSetup) => {
    haptic();
    void saveLoad(exerciseId, patch);
  };
  return (
    <div className={bare ? '' : 'cut bg-card p-4'}>
      {!bare && (
        <div className="mb-3">
          <div className="label">{t('How you log the weight')}</div>
          <div className="mt-0.5 text-xs text-muted">
            {STANDARDS[exerciseId] ? 'Needed for a fair rank — the same number means different things on different setups.' : 'Saved with the exercise so your numbers stay comparable.'}
          </div>
        </div>
      )}
      {q.side && (
        <>
          <div className="mb-1.5 font-display text-sm font-semibold uppercase tracking-wider">{cable ? 'Handles' : 'Dumbbells'}</div>
          <div className="space-y-1.5">
            <Choice on={ex.load?.side === 'one'} title={t('One side')} sub={cable ? 'The weight of one handle / one arm' : 'The weight of one dumbbell'} onClick={() => set({ side: 'one' })} />
            <Choice on={ex.load?.side === 'both'} title={t('Both sides together')} sub={cable ? 'Left + right handles added up' : 'Both dumbbells added up'} onClick={() => set({ side: 'both' })} />
          </div>
        </>
      )}
      {q.pulley && (
        <>
          <div className={`mb-1.5 font-display text-sm font-semibold uppercase tracking-wider ${q.side ? 'mt-4' : ''}`}>{t('Pulleys on the cable')}</div>
          <div className="space-y-1.5">
            {PULLEYS.map(([n, title, sub]) => (
              <Choice key={n} on={ex.load?.pulley === n} title={title} sub={sub} onClick={() => set({ pulley: n })} />
            ))}
          </div>
          <div className="mt-2 text-xs text-muted">Not sure? Pull the handle 1 m: if the stack rises only ½ m, it’s 2:1.</div>
        </>
      )}
    </div>
  );
}

/** Warning strip shown on an exercise until its load setup is answered. */
export function LoadSetupNag({ exerciseId, onClick }: { exerciseId: string; onClick: () => void }) {
  const ex = useExercise(exerciseId);
  if (!loadMissing(ex)) return null;
  return (
    <button onClick={onClick} className="press mx-4 mt-2 flex w-[calc(100%-2rem)] items-center gap-2 bg-warn/15 px-3 py-2 text-left text-sm text-warn">
      <AlertTriangle size={16} className="shrink-0" />
      <span className="flex-1">
        {loadQuestions(ex).pulley ? 'Set the pulley ratio' : 'One dumbbell or both?'} — tap to set{STANDARDS[exerciseId] ? ' (needed for ranks)' : ''}
      </span>
    </button>
  );
}
