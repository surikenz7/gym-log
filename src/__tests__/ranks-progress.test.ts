import { describe, expect, it } from 'vitest';
import { setLang } from '../i18n';

setLang('en');
import { ACHIEVEMENTS, computeJourney, levelFromXp, volumeComparison, xpForLevel } from '../lib/progress';
import { anchors, bodyweightTimeline, loadFactor, loadQuestions, exerciseRanks, groupRanks, overallScore, scoreFor, setScore, STANDARDS, tierOf, valueForScore, weightForScore } from '../lib/ranks';
import type { WSet, Workout } from '../types';

const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';
let n = 0;
const set = (weight: number, reps: number, extra: Partial<WSet> = {}): WSet => ({ id: String(++n), type: 'normal', weight, reps, done: true, ...extra });
const workout = (id: string, start: number, exerciseId: string, sets: WSet[]): Workout => ({
  id,
  name: id,
  start,
  end: start + 3600e3,
  exerciseIds: [exerciseId],
  exercises: [{ id: 'e' + id, exerciseId, sets }],
});

describe('ranks', () => {
  it('maps standard levels to 150-point steps and inverts cleanly', () => {
    const a = anchors(STANDARDS[BENCH], 'male');
    expect(scoreFor(a[1], a)).toBeCloseTo(150); // beginner
    expect(scoreFor(a[3], a)).toBeCloseTo(450); // intermediate = Gold
    expect(scoreFor(a[5], a)).toBeCloseTo(750); // elite = Champion
    expect(scoreFor(0, a)).toBe(0);
    expect(scoreFor(99, a)).toBe(1000);
    for (const s of [37, 200, 455, 820, 950]) expect(scoreFor(valueForScore(s, a), a)).toBeCloseTo(s);
  });

  it('scores a set from the estimated 1RM relative to bodyweight', () => {
    // 80 kg man, 100 kg × 5 → e1RM 116.7 = 1.46 × BW → between intermediate and advanced
    const sc = setScore(BENCH, set(100, 5), 80, 'male');
    expect(tierOf(sc).name).toBe('Gold');
    expect(sc).toBeGreaterThan(470);
    expect(sc).toBeLessThan(490);
    // same lift is worth more for a woman of the same bodyweight
    expect(setScore(BENCH, set(100, 5), 80, 'female')).toBeGreaterThan(sc);
    // warm-ups and 30+ rep sets never count
    expect(setScore(BENCH, set(100, 5, { type: 'warmup' }), 80, 'male')).toBe(0);
    expect(setScore(BENCH, set(40, 40), 80, 'male')).toBe(0);
  });

  it('weight needed for a score gives back that score', () => {
    const kg = weightForScore(BENCH, 600, 5, 90, 'male')!;
    expect(setScore(BENCH, set(kg, 5), 90, 'male')).toBe(600);
    // pull-ups: added weight on top of bodyweight
    const added = weightForScore('Pullups', 700, 5, 80, 'male')!;
    expect(added).toBeGreaterThan(0);
    expect(setScore('Pullups', set(added, 5), 80, 'male')).toBe(700);
    expect(setScore('Pullups', set(0, 12), 80, 'male')).toBeGreaterThan(setScore('Pullups', set(0, 5), 80, 'male'));
  });

  it('takes the best set per exercise, best exercise per group, and averages groups', () => {
    const ws = [
      workout('a', 1, BENCH, [set(80, 5), set(90, 3)]),
      workout('b', 2, 'Barbell_Squat', [set(120, 5)]),
      workout('c', 3, 'Barbell_Deadlift', [set(150, 5)]),
      workout('d', 4, 'Dumbbell_Bench_Press', [set(10, 10)]),
    ];
    const ranks = exerciseRanks(ws, { sex: 'male', bwAt: () => 80 });
    expect(ranks.get(BENCH)!.score).toBe(Math.max(setScore(BENCH, ws[0].exercises[0].sets[0], 80, 'male'), setScore(BENCH, ws[0].exercises[0].sets[1], 80, 'male')));
    const groups = groupRanks(ranks);
    expect(groups.find((g) => g.group === 'chest')!.exerciseId).toBe(BENCH);
    const overall = overallScore(groups)!;
    const ranked = groups.filter((g) => g.score);
    expect(ranked).toHaveLength(3);
    expect(overall).toBe(Math.round(ranked.reduce((s, g) => s + g.score, 0) / 3));
    expect(overallScore(groups.slice(0, 1))).toBeNull();
  });

  it('uses the bodyweight logged closest before each workout', () => {
    const bw = bodyweightTimeline([
      { date: 100, weight: 90 },
      { date: 10, weight: 80 },
      { date: 50, weight: null },
    ])!;
    expect(bw(5)).toBe(80);
    expect(bw(60)).toBe(80);
    expect(bw(200)).toBe(90);
    expect(bodyweightTimeline([])).toBeNull();
  });
});

describe('load setup', () => {
  const db = { id: 'Dumbbell_Bench_Press', equipment: 'Dumbbell' };
  const rope = { id: 'Triceps_Pushdown_-_Rope_Attachment', equipment: 'Cable' };
  const fly = { id: 'Cable_Crossover', equipment: 'Cable' };

  it('asks only the questions that matter', () => {
    expect(loadQuestions(db)).toEqual({ side: true, pulley: false });
    expect(loadQuestions(rope)).toEqual({ side: false, pulley: true });
    expect(loadQuestions(fly)).toEqual({ side: true, pulley: true });
    expect(loadQuestions({ id: 'Barbell_Squat', equipment: 'Barbell' })).toEqual({ side: false, pulley: false });
  });

  it('leaves dumbbell / cable lifts unranked until set up, then converts the logged weight', () => {
    expect(loadFactor(db)).toBeNull();
    expect(loadFactor({ ...db, load: { side: 'one' } })).toBe(1);
    expect(loadFactor({ ...db, load: { side: 'both' } })).toBe(0.5);
    expect(loadFactor(rope)).toBeNull();
    expect(loadFactor({ ...rope, load: { pulley: 2 } })).toBe(0.5);
    expect(loadFactor({ ...fly, load: { side: 'both', pulley: 2 } })).toBe(0.25);
    expect(loadFactor({ id: 'Barbell_Squat', equipment: 'Barbell' })).toBe(1);
  });

  it('applies the factor when ranking', () => {
    const ws = [workout('a', 1, 'Dumbbell_Bench_Press', [set(60, 8)])];
    const base = { sex: 'male' as const, bwAt: () => 80 };
    expect(exerciseRanks(ws, { ...base, factor: () => null }).size).toBe(0);
    const one = exerciseRanks(ws, { ...base, factor: () => 1 }).get('Dumbbell_Bench_Press')!.score;
    const both = exerciseRanks(ws, { ...base, factor: () => 0.5 }).get('Dumbbell_Bench_Press')!.score;
    expect(both).toBeLessThan(one);
    expect(setScore('Dumbbell_Bench_Press', set(60, 8), 80, 'male', 0.5)).toBe(setScore('Dumbbell_Bench_Press', set(30, 8), 80, 'male'));
    expect(weightForScore('Dumbbell_Bench_Press', 500, 5, 80, 'male', 0.5)).toBeCloseTo(2 * weightForScore('Dumbbell_Bench_Press', 500, 5, 80, 'male')!);
  });
});

describe('progress', () => {
  it('levels up on a growing XP curve', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, need: xpForLevel(1) });
    expect(levelFromXp(xpForLevel(1)).level).toBe(2);
    expect(levelFromXp(xpForLevel(1) + xpForLevel(2) - 1).level).toBe(2);
  });

  it('awards XP, streaks and achievements chronologically', () => {
    const wk = 7 * 864e5;
    const t0 = new Date(2026, 0, 5, 18).getTime(); // a Monday
    const ws = [
      workout('w1', t0, BENCH, [set(60, 5)]),
      workout('w2', t0 + wk, BENCH, [set(100, 1), set(50, 10)]),
      workout('w3', t0 + wk + 864e5, BENCH, [set(50, 5)]),
    ];
    const j = computeJourney(ws, () => 'weight_reps');
    const r1 = j.byWorkout.get('w1')!;
    expect(r1.number).toBe(1);
    expect(r1.achievements.map((a) => a.id)).toEqual(['w1', 'b60']);
    const r2 = j.byWorkout.get('w2')!;
    expect(r2.streak).toBe(2);
    expect(r2.achievements.map((a) => a.id)).toContain('b100');
    expect(r2.parts.find((p) => p.label.includes('Personal records'))).toBeTruthy();
    expect(r2.xpBefore).toBe(r1.xp);
    // second workout in the same week: no weekly bonus, streak unchanged
    const r3 = j.byWorkout.get('w3')!;
    expect(r3.streak).toBe(2);
    expect(r3.parts.some((p) => p.label === 'First workout this week')).toBe(false);
    expect(j.xp).toBe(r1.xp + r2.xp + r3.xp);
    expect(j.unlocked.size).toBe(3);
    expect(ACHIEVEMENTS.every((a) => a.goal > 0)).toBe(true);
  });

  it('compares volume to real things', () => {
    expect(volumeComparison(50)).toBeNull();
    expect(volumeComparison(1600)).toBe('a car');
    expect(volumeComparison(3200)).toBe('1.3 rhinos');
  });
});
