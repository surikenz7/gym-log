import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { db } from '../db/db';
import { useSettings } from '../state/settings';
import type { Workout } from '../types';
import { typeOf, useLibrary } from './exercises';
import { useAllWorkouts } from './hooks';
import { computeJourney, type Journey } from './progress';
import { bodyweightTimeline, exerciseRanks, groupRanks, loadFactor, overallScore, type RankCtx } from './ranks';

/** undefined while loading, null when sex or bodyweight hasn't been set yet. */
export function useRankCtx(): RankCtx | null | undefined {
  const sex = useSettings((s) => s.sex);
  const measures = useLiveQuery(() => db.measures.toArray(), []);
  const lib = useLibrary((s) => s.map);
  return useMemo(() => {
    if (!measures) return undefined;
    const bwAt = bodyweightTimeline(measures);
    const factor = (id: string) => (lib[id] ? loadFactor(lib[id]) : 1);
    return sex && bwAt ? { sex, bwAt, factor } : null;
  }, [sex, measures, lib]);
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

interface RankState {
  ctx: RankCtx | null | undefined;
  data: ReturnType<typeof computeRanks> | null;
  loading: boolean;
}

/** Ranks are computed once (by <RankSync/>) and shared, so any exercise name can show its rank cheaply. */
const useRankStore = create<RankState>(() => ({ ctx: undefined, data: null, loading: true }));

const useJourneyStore = create<{ journey: Journey | null }>(() => ({ journey: null }));

/** Computes ranks and XP/trophies once per data change and shares them with every screen. */
export function RankSync() {
  const ctx = useRankCtx();
  const workouts = useAllWorkouts();
  useEffect(() => {
    useRankStore.setState({ ctx, data: ctx && workouts ? computeRanks(workouts, ctx) : null, loading: ctx === undefined || !workouts });
  }, [ctx, workouts]);
  useEffect(() => {
    if (workouts) useJourneyStore.setState({ journey: computeJourney(workouts, typeOf) });
  }, [workouts]);
  return null;
}

export function useRanks() {
  return useRankStore();
}

/** Best rank score of one exercise from saved workouts, or null. */
export function useExerciseScore(exerciseId: string) {
  return useRankStore((s) => s.data?.exercises.get(exerciseId)?.score ?? null);
}

export function useJourney() {
  return useJourneyStore((s) => s.journey);
}
