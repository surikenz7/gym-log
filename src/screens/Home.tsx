import { isSameWeek } from 'date-fns';
import { Dumbbell, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WorkoutList } from '../components/WorkoutFeed';
import { Button, Empty, Header, Page } from '../components/ui';
import { useAllWorkouts } from '../lib/hooks';
import { fmtDurationLong } from '../lib/units';
import { startWorkout } from './WorkoutTab';

export function Home() {
  const workouts = useAllWorkouts();
  const nav = useNavigate();
  const week = (workouts ?? []).filter((w) => isSameWeek(w.start, new Date(), { weekStartsOn: 1 }));
  const weekTime = week.reduce((t, w) => t + (w.end - w.start) / 1000, 0);
  return (
    <Page>
      <Header title="Home" large />
      <div className="space-y-3 px-4 pb-8">
        {workouts && workouts.length === 0 ? (
          <Empty icon={<Dumbbell size={48} />} title="Welcome to Gym Log" text="Your workouts will show up here, just like in Hevy.">
            <div className="flex flex-col gap-2">
              <Button onClick={() => startWorkout()}>
                <Play size={18} /> Start Empty Workout
              </Button>
              <Button variant="secondary" onClick={() => nav('/import/hevy')}>
                Import from Hevy
              </Button>
            </div>
          </Empty>
        ) : (
          <>
            {workouts && (
              <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                <div>
                  <div className="text-xs text-muted">This week</div>
                  <div className="font-semibold">
                    {week.length} workout{week.length === 1 ? '' : 's'}
                    {weekTime > 0 && <span className="font-normal text-muted"> · {fmtDurationLong(weekTime)}</span>}
                  </div>
                </div>
                <Button className="!px-4 !py-2 text-sm" onClick={() => startWorkout()}>
                  <Play size={16} /> Start
                </Button>
              </div>
            )}
            <WorkoutList workouts={workouts ?? []} />
          </>
        )}
      </div>
    </Page>
  );
}
