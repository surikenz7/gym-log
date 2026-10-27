import { describe, expect, it } from 'vitest';
import { fairness, leaguePoints, leagueSummary, monthlyBadges, placeOf, questOptions, questProgress, questStats, questWeekOf, statsOf, weekId, weeklyChallenges } from '../lib/compete';
import type { Workout } from '../types';

const typeOf = () => 'weight_reps' as const;
const muscleOf = (id: string) => (id === 'squat' ? 'Quadriceps' : 'Chest');
const w = (id: string, start: Date, ex = 'bench', kg = 100): Workout => ({
  id,
  name: id,
  start: +start,
  end: +start + 3600e3,
  exerciseIds: [ex],
  exercises: [{ id: 'e', exerciseId: ex, sets: [{ id: 's', type: 'normal', weight: kg, reps: 10, done: true }] }],
});

describe('compete', () => {
  it('balances by bodyweight and sex', () => {
    expect(fairness(80, 'male')).toBe(1);
    expect(fairness(null, 'male')).toBe(1);
    expect(fairness(60, 'female')).toBeGreaterThan(1.4);
    expect(fairness(110, 'male')).toBeLessThan(1);
    expect(leaguePoints(10000, 3, 1)).toBe(160);
  });

  it('summarises this week and month', () => {
    const now = new Date(2026, 9, 28, 12); // Wed 28 Oct 2026
    const ws = [w('a', new Date(2026, 9, 27, 9)), w('b', new Date(2026, 9, 20, 9)), w('c', new Date(2026, 8, 30, 9))];
    const s = leagueSummary(ws, 1, typeOf, now);
    expect(s.wk).toMatchObject({ id: weekId(now), n: 1, v: 1000, s: 1, pts: 30 });
    expect(s.pw.n).toBe(1);
    expect(s.mo).toMatchObject({ id: '2026-10', n: 2 });
    expect(s.pm).toMatchObject({ id: '2026-09', n: 1 });
    expect(statsOf(s, '2026-09')?.n).toBe(1);
    expect(statsOf(s, '2025-01')).toBeNull();
  });

  it('places people who scored', () => {
    expect(placeOf([{ uid: 'me', pts: 50 }], 'me')).toBe(0);
    expect(placeOf([{ uid: 'me', pts: 50 }, { uid: 'x', pts: 80 }, { uid: 'y', pts: 0 }], 'me')).toBe(2);
    expect(placeOf([{ uid: 'me', pts: 0 }, { uid: 'x', pts: 80 }, { uid: 'y', pts: 10 }], 'me')).toBe(0);
  });

  it('builds stable weekly challenges and tracks progress', () => {
    const now = new Date(2026, 9, 28, 12);
    const ws = [w('a', new Date(2026, 9, 26, 9), 'squat'), w('b', new Date(2026, 9, 27, 9))];
    const a = weeklyChallenges(ws, { typeOf, muscleOf }, now);
    const b = weeklyChallenges(ws, { typeOf, muscleOf }, new Date(2026, 9, 31));
    expect(a.map((c) => c.kind)).toEqual(b.map((c) => c.kind));
    expect(a[0]).toMatchObject({ kind: 'sessions', target: 2, value: 2 });
    expect(new Set(a.map((c) => c.kind)).size).toBe(3);
  });

  it('awards a monthly badge when the challenge is done', () => {
    const ws: Workout[] = [];
    for (let d = 1; d <= 28; d += 2) ws.push(w('m' + d, new Date(2026, 8, d, 9), 'bench', 200));
    expect(monthlyBadges(ws, { typeOf, muscleOf }, new Date(2026, 9, 5))).toContain('2026-09');
  });

  it('measures quest weeks and progress by kind', () => {
    const now = new Date(2026, 9, 28, 12); // Wed
    const mine = questStats([w('a', new Date(2026, 9, 26, 9), 'squat'), w('b', new Date(2026, 9, 28, 9))], { typeOf, muscleOf }, now);
    expect(mine.qw).toMatchObject({ id: weekId(now), n: 2, s: 2, r: 20, v: 2000, d: 0b101, g: { legs: 1, chest: 1 } });
    const theirs = questStats([w('c', new Date(2026, 9, 28, 18))], { typeOf, muscleOf }, now).qw;
    expect(questProgress('sessions', mine.qw, theirs)).toBe(3);
    expect(questProgress('both', mine.qw, theirs)).toBe(1);
    expect(questProgress('sameday', mine.qw, theirs)).toBe(1); // both trained on Wednesday
    expect(questProgress('tagteam', mine.qw, theirs)).toBe(2);
    // an older profile without quest stats falls back to the league numbers
    expect(questWeekOf({ wk: { id: weekId(now), n: 4, s: 40, v: 9000, pts: 0 } }, weekId(now))).toMatchObject({ n: 4, s: 40, d: 0 });
  });

  it('offers quests that can still be done this week', () => {
    const avg = { n: 2, s: 30, v: 6000, r: 300, m: 120, pr: 0, g: { legs: 8 } };
    for (const day of [26, 28, 31, 1]) {
      const now = day === 1 ? new Date(2026, 10, 1, 20) : new Date(2026, 9, day, 8); // Mon … Sun evening
      const cur = { id: weekId(now), n: 0, s: 0, v: 0, r: 0, m: 0, pr: 0, d: 0, g: {} };
      for (const seed of ['a', 'b', 'c']) {
        const opts = questOptions({ cur, avg }, { cur: null, avg }, now, seed);
        expect(opts).toHaveLength(3);
        expect(new Set(opts.map((o) => o.kind)).size).toBe(3);
        const left = 7 - ((now.getDay() + 6) % 7);
        for (const o of opts) {
          if (o.kind === 'sessions' || o.kind === 'tagteam' || o.kind === 'sameday') expect(o.goal).toBeLessThanOrEqual(left * (o.kind === 'sessions' ? 2 : 1));
          if (o.kind === 'both') expect(o.goal).toBeLessThanOrEqual(left);
        }
      }
    }
    // two people who train twice a week: about 4–5 sessions between them, never 'impossible'
    const mon = new Date(2026, 9, 26, 8);
    const cur = { id: weekId(mon), n: 0, s: 0, v: 0, r: 0, m: 0, pr: 0, d: 0, g: {} };
    const all = ['', '1', '2', '3', '4', '5', '6', '7'].flatMap((seed) => questOptions({ cur, avg }, { cur: null, avg }, mon, seed));
    const sessions = all.find((o) => o.kind === 'sessions');
    if (sessions) expect(sessions.goal).toBeLessThanOrEqual(5);
    expect(new Set(all.map((o) => o.kind)).size).toBeGreaterThan(6);
  });
});
