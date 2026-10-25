import { isSameWeek } from 'date-fns';
import { Dumbbell, Flame, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WorkoutList } from '../components/WorkoutFeed';
import { Button, Empty, Header, Page } from '../components/ui';
import { useAllWorkouts } from '../lib/hooks';
import { fmtDurationLong } from '../lib/units';
import { useJourney } from '../lib/useProgress';
import { startWorkout } from './WorkoutTab';

export function Home() {
  const workouts = useAllWorkouts();
  const nav = useNavigate();
  const week = (workouts ?? []).filter((w) => isSameWeek(w.start, new Date(), { weekStartsOn: 1 }));
  const weekTime = week.reduce((t, w) => t + (w.end - w.start) / 1000, 0);
  const streak = useJourney()?.totals.streak ?? 0;
  return (
    <Page>
      <Header title="Home" large />
      <div className="space-y-3 px-4 pb-8">
        {workouts && workouts.length === 0 ? (
          <Empty icon={<Dumbbell size={48} />} title="Welcome to Gym Log" text="No excuses. Log your first session and start climbing the ranks.">
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
              <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
                <div>
                  <div className="label">This week</div>
                  <div className="font-display text-xl font-bold uppercase">
                    {week.length} workout{week.length === 1 ? '' : 's'}
                    {weekTime > 0 && <span className="font-sans text-sm font-normal normal-case text-muted"> · {fmtDurationLong(weekTime)}</span>}
                  </div>
                  {streak > 1 && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-orange-400">
                      <Flame size={13} /> {streak}-week streak
                    </div>
                  )}
                </div>
                <Button className="stripes !px-5 !py-2.5 text-base" onClick={() => startWorkout()}>
                  <Play size={16} fill="currentColor" /> Train
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
