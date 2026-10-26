import { motion } from 'framer-motion';
import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { ExerciseThumb } from '../components/ExerciseImage';
import { Button, Header, Page } from '../components/ui';
import { db } from '../db/db';
import { getExercise } from '../lib/exercises';
import { uid } from '../lib/id';
import { toast } from '../state/dialog';
import { newSet } from '../state/workout';
import type { Routine } from '../types';

/** [exerciseId, sets, reps] — reps 0 = time-based. */
type Item = [string, number, number];
interface Program {
  name: string;
  level: string;
  description: string;
  routines: { name: string; items: Item[] }[];
}

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
const SQUAT = 'Barbell_Squat';
const ROW = 'Bent_Over_Barbell_Row';
const OHP = 'Standing_Military_Press';
const DEADLIFT = 'Barbell_Deadlift';
const RDL = 'Romanian_Deadlift';

export const PROGRAMS: Program[] = [
  {
    name: 'Push Pull Legs',
    level: 'Intermediate · 3–6 days/week',
    description: 'The classic split: chest/shoulders/triceps, back/biceps, then legs.',
    routines: [
      { name: 'Push', items: [[BENCH, 4, 8], ['Dumbbell_Shoulder_Press', 3, 10], ['Incline_Dumbbell_Press', 3, 10], ['Side_Lateral_Raise', 3, 15], ['Triceps_Pushdown_-_Rope_Attachment', 3, 12], ['Cable_Rope_Overhead_Triceps_Extension', 3, 12]] },
      { name: 'Pull', items: [['Wide-Grip_Lat_Pulldown', 4, 10], ['Seated_Cable_Rows', 3, 10], [ROW, 3, 8], ['Face_Pull', 3, 15], ['Barbell_Curl', 3, 10], ['Hammer_Curls', 3, 12]] },
      { name: 'Legs', items: [[SQUAT, 4, 6], [RDL, 3, 8], ['Leg_Press', 3, 12], ['Lying_Leg_Curls', 3, 12], ['Leg_Extensions', 3, 12], ['Standing_Calf_Raises', 4, 15]] },
    ],
  },
  {
    name: 'Upper / Lower',
    level: 'Beginner–Intermediate · 4 days/week',
    description: 'Train every muscle twice a week with two upper and two lower days.',
    routines: [
      { name: 'Upper', items: [[BENCH, 4, 6], [ROW, 4, 8], [OHP, 3, 8], ['Wide-Grip_Lat_Pulldown', 3, 10], ['Dumbbell_Bicep_Curl', 3, 12], ['Triceps_Pushdown', 3, 12]] },
      { name: 'Lower', items: [[SQUAT, 4, 6], [RDL, 3, 8], ['Leg_Press', 3, 10], ['Seated_Leg_Curl', 3, 12], ['Standing_Calf_Raises', 4, 12], ['Plank', 3, 0]] },
    ],
  },
  {
    name: 'Full Body',
    level: 'Beginner · 3 days/week',
    description: 'Simple full-body sessions, great for building a base.',
    routines: [
      { name: 'Full Body A', items: [[SQUAT, 3, 8], [BENCH, 3, 8], [ROW, 3, 8], ['Side_Lateral_Raise', 2, 15], ['Plank', 3, 0]] },
      { name: 'Full Body B', items: [[DEADLIFT, 3, 5], [OHP, 3, 8], ['Pullups', 3, 8], ['Dumbbell_Lunges', 3, 10], ['Hanging_Leg_Raise', 3, 12]] },
    ],
  },
  {
    name: '5×5 Strength',
    level: 'Beginner · 3 days/week',
    description: 'Alternate A and B, add a little weight every session.',
    routines: [
      { name: '5×5 A', items: [[SQUAT, 5, 5], [BENCH, 5, 5], [ROW, 5, 5]] },
      { name: '5×5 B', items: [[SQUAT, 5, 5], [OHP, 5, 5], [DEADLIFT, 1, 5]] },
    ],
  },
];

async function addProgram(p: Program) {
  const folderId = uid();
  const now = Date.now();
  await db.folders.add({ id: folderId, name: p.name, order: now });
  const routines: Routine[] = p.routines.map((r, i) => ({
    id: uid(),
    name: r.name,
    folderId,
    order: now + i,
    createdAt: now,
    updatedAt: now,
    exercises: r.items.map(([exerciseId, sets, reps]) => ({
      id: uid(),
      exerciseId,
      supersetId: null,
      notes: '',
      restSec: null,
      sets: Array.from({ length: sets }, () => newSet('normal', reps ? { reps } : getExercise(exerciseId).type === 'duration' ? { duration: 45 } : {})),
    })),
  }));
  await db.routines.bulkAdd(routines);
}

/** Each program's gradient (shared with the Routines tab carousel). */
export const PROGRAM_COLORS = [
  ['#ef4444', '#f97316'],
  ['#6366f1', '#22d3ee'],
  ['#22c55e', '#a3e635'],
  ['#a855f7', '#ec4899'],
  ['#f59e0b', '#fde047'],
];

export function Explore() {
  const [added, setAdded] = useState<string[]>([]);
  return (
    <Page pushed>
      <Header back title="Explore Routines" />
      <div className="space-y-4 px-4 pb-12">
        {PROGRAMS.map((p, i) => (
          <motion.div key={p.name} className="cut bg-card p-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="-mx-4 -mt-4 mb-3 px-4 pb-3 pt-4 text-[#fff]" style={{ background: `linear-gradient(135deg, ${PROGRAM_COLORS[i % PROGRAM_COLORS.length][0]}, ${PROGRAM_COLORS[i % PROGRAM_COLORS.length][1]})` }}>
              <div className="font-display text-2xl font-bold uppercase">{p.name}</div>
              <div className="text-xs font-semibold opacity-85">{p.level}</div>
            </div>
            <div className="text-sm text-muted">{p.description}</div>
            <div className="mt-3 space-y-3">
              {p.routines.map((r) => (
                <div key={r.name}>
                  <div className="mb-1.5 text-sm font-semibold">{r.name}</div>
                  <div className="space-y-1.5">
                    {r.items.map(([id, sets, reps]) => {
                      const ex = getExercise(id);
                      return (
                        <div key={id} className="flex items-center gap-2.5 text-sm">
                          <ExerciseThumb ex={ex} size={26} />
                          <span className="flex-1 truncate">{ex.name}</span>
                          <span className="text-muted">
                            {sets} × {reps || '45s'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="mt-4 w-full"
              variant={added.includes(p.name) ? 'secondary' : 'primary'}
              disabled={added.includes(p.name)}
              onClick={async () => {
                await addProgram(p);
                setAdded((a) => [...a, p.name]);
                toast(`Added “${p.name}” to your routines`);
              }}
            >
              {added.includes(p.name) ? (
                <>
                  <Check size={18} /> Added to My Routines
                </>
              ) : (
                <>
                  <Plus size={18} /> Save {p.routines.length} routines
                </>
              )}
            </Button>
          </motion.div>
        ))}
      </div>
    </Page>
  );
}
