import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomExerciseSheet } from '../components/CustomExerciseSheet';
import { ExerciseDetailBody } from '../components/ExerciseInfo';
import { ExerciseList, FilterBar } from '../components/ExercisePicker';
import { Header, Page } from '../components/ui';
import { useExercise } from '../lib/exercises';

// Filters survive navigating into an exercise and back.
let saved = { query: '', muscle: null as string | null, equipment: null as string | null };

export function Exercises() {
  const nav = useNavigate();
  const [query, setQ] = useState(saved.query);
  const [muscle, setM] = useState(saved.muscle);
  const [equipment, setE] = useState(saved.equipment);
  const [creating, setCreating] = useState(false);
  const setQuery = (query: string) => (setQ(query), (saved = { ...saved, query }));
  const setMuscle = (muscle: string | null) => (setM(muscle), (saved = { ...saved, muscle }));
  const setEquipment = (equipment: string | null) => (setE(equipment), (saved = { ...saved, equipment }));
  return (
    <Page pushed>
      <Header
        title="Exercises"
        back
        right={
          <button onClick={() => setCreating(true)} className="press text-accent">
            <Plus size={26} />
          </button>
        }
      />
      <div className="sticky z-10 bg-bg pt-1" style={{ top: 'calc(var(--sat) + 3rem)' }}>
        <FilterBar {...{ query, setQuery, muscle, setMuscle, equipment, setEquipment }} />
      </div>
      <div className="pb-8">
        <ExerciseList query={query} muscle={muscle} equipment={equipment} onTap={(e) => nav(`/exercises/${e.id}`)} />
      </div>
      <CustomExerciseSheet open={creating} onClose={() => setCreating(false)} initialName={query} onSaved={(e) => nav(`/exercises/${e.id}`)} />
    </Page>
  );
}

export function ExercisePage() {
  const { id } = useParams();
  const ex = useExercise(id!);
  return (
    <Page pushed>
      <Header back title={ex.name} />
      <ExerciseDetailBody exerciseId={id!} />
    </Page>
  );
}
