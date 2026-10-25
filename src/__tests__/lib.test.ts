import { describe, expect, it } from 'vitest';
import { epley1RM, exerciseSessions, findPRs } from '../lib/stats';
import { digitsToSeconds, fmtDuration, fmtSet, kgTo, parseNum, secondsToDigits, toKg } from '../lib/units';
import { DEFAULT_SETTINGS, type WSet, type Workout } from '../types';

let n = 0;
const set = (weight: number | null, reps: number | null, extra: Partial<WSet> = {}): WSet => ({ id: String(++n), type: 'normal', weight, reps, done: true, ...extra });
const workout = (start: number, sets: WSet[], exerciseId = 'bench'): Workout => ({
  id: 'w' + start,
  name: 'W',
  start,
  end: start + 3600e3,
  exerciseIds: [exerciseId],
  exercises: [{ id: 'e' + start, exerciseId, sets }],
});

describe('units', () => {
  it('parses comma and dot decimals', () => {
    expect(parseNum('62,5')).toBe(62.5);
    expect(parseNum('62.5')).toBe(62.5);
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
  });
  it('round-trips lbs', () => {
    expect(kgTo(toKg(135, 'lbs'), 'lbs')).toBe(135);
    expect(kgTo(100, 'kg')).toBe(100);
  });
  it('handles microwave time entry', () => {
    expect(digitsToSeconds('130')).toBe(90);
    expect(digitsToSeconds('10000')).toBe(3600);
    expect(secondsToDigits(90)).toBe('130');
    expect(secondsToDigits(30)).toBe('30');
    expect(digitsToSeconds(secondsToDigits(3725))).toBe(3725);
    expect(fmtDuration(3725)).toBe('1:02:05');
  });
  it('formats sets per exercise type', () => {
    expect(fmtSet({ weight: 80, reps: 8 }, 'weight_reps', DEFAULT_SETTINGS)).toBe('80 kg × 8');
    expect(fmtSet({ weight: 10, reps: 8 }, 'weighted_bodyweight', DEFAULT_SETTINGS)).toBe('+10 kg × 8');
    expect(fmtSet({ reps: 12 }, 'bodyweight_reps', DEFAULT_SETTINGS)).toBe('12 reps');
    expect(fmtSet({ distance: 2500, duration: 900 }, 'distance_duration', DEFAULT_SETTINGS)).toBe('2.5 km · 15:00');
  });
});

describe('stats', () => {
  const typeOf = () => 'weight_reps' as const;
  it('computes Epley 1RM', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 1);
  });
  it('finds PRs against history only', () => {
    const hist = [workout(1, [set(80, 8), set(80, 8)])];
    const now = workout(2, [set(85, 5), set(80, 10), set(60, 1, { type: 'warmup' })]);
    const prs = findPRs(now, hist, typeOf);
    expect(prs.map((p) => p.kind).sort()).toEqual(['1rm', 'volume', 'weight']);
    expect(prs.find((p) => p.kind === 'weight')!.value).toBe(85);
  });
  it('reports no PRs on the first session of an exercise', () => {
    expect(findPRs(workout(2, [set(100, 5)]), [], typeOf)).toEqual([]);
  });
  it('builds per-session chart points, oldest first', () => {
    const pts = exerciseSessions([workout(5, [set(90, 3)]), workout(1, [set(80, 5), set(40, 10, { type: 'warmup' })])], 'bench', 'weight_reps');
    expect(pts.map((p) => p.heaviest)).toEqual([80, 90]);
    expect(pts[0].sessionVolume).toBe(800);
    expect(pts[0].totalReps).toBe(15);
  });
});
