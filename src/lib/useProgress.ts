import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import { useSettings } from '../state/settings';
import type { Workout } from '../types';
import { typeOf } from './exercises';
import { useAllWorkouts } from './hooks';
import { computeJourney } from './progress';
import { bodyweightTimeline, exerciseRanks, groupRanks, overallScore, type RankCtx } from './ranks';

/** undefined while loading, null when sex or bodyweight hasn't been set yet. */
export function useRankCtx(): RankCtx | null | undefined {
  const sex = useSettings((s) => s.sex);
  const measures = useLiveQuery(() => db.measures.toArray(), []);
  return useMemo(() => {
    if (!measures) return undefined;
    const bwAt = bodyweightTimeline(measures);
    return sex && bwAt ? { sex, bwAt } : null;
  }, [sex, measures]);
}

export function useLatestBodyweight(): number | null | undefined {
  return useLiveQuery(async () => {
    const all = await db.measures.orderBy('date').reverse().toArray();
    return all.find((m) => m.weight)?.weight ?? null;
  }, []);
}

export function computeRanks(workouts: Workout[], ctx: RankCtx) {
  const exercises = exerciseRanks(workouts, ctx);
  const groups = groupRanks(exercises);
  return { exercises, groups, overall: overallScore(groups) };
}

export function useRanks() {
  const ctx = useRankCtx();
  const workouts = useAllWorkouts();
  const data = useMemo(() => (ctx && workouts ? computeRanks(workouts, ctx) : null), [ctx, workouts]);
  return { ctx, data, loading: ctx === undefined || !workouts };
}

export function useJourney() {
  const workouts = useAllWorkouts();
  return useMemo(() => (workouts ? computeJourney(workouts, typeOf) : null), [workouts]);
}
