import { describe, expect, it } from 'vitest';
import { downsample, parseHealthText, requestText } from '../lib/health';
import { bestSessionVolume, exerciseBests, livePRs, prCounts, repRecords } from '../lib/stats';
import type { WSet, Workout } from '../types';

let n = 0;
const set = (weight: number, reps: number, extra: Partial<WSet> = {}): WSet => ({ id: String(++n), type: 'normal', weight, reps, done: true, ...extra });
const workout = (id: string, start: number, sets: WSet[]): Workout => ({
  id,
  name: id,
  start,
  end: start + 3600e3,
  exerciseIds: ['bench'],
  exercises: [{ id: 'e' + id, exerciseId: 'bench', sets }],
});
const typeOf = () => 'weight_reps' as const;

describe('records', () => {
  const ws = [workout('a', 1, [set(80, 5), set(70, 8)]), workout('b', 2, [set(85, 5), set(90, 1), set(100, 1, { type: 'warmup' })]), workout('c', 3, [set(80, 5)])];

  it('builds set records per rep count, ignoring warm-ups', () => {
    const r = repRecords(ws, 'bench');
    expect(r.map((x) => [x.reps, x.weight, x.workoutId])).toEqual([
      [1, 90, 'b'],
      [5, 85, 'b'],
      [8, 70, 'a'],
    ]);
  });

  it('finds the best session volume', () => {
    // session a: 80×5 + 70×8 = 960 beats b (85×5 + 90×1 + 100×1 warm-up = 615)
    expect(bestSessionVolume(ws, 'bench', 'weight_reps')).toBe(960);
  });

  it('counts PR sets per workout chronologically', () => {
    const c = prCounts(ws, typeOf);
    expect(c.get('a')).toBe(0); // first session never counts
    expect(c.get('b')).toBe(2); // 85×5 (weight, 1RM, volume) and 90×1 (weight)
    expect(c.get('c')).toBe(0);
  });

  it('flags live PRs only for sets that beat history', () => {
    const hist = exerciseBests([ws[0]], 'bench', 'weight_reps');
    const sets = [set(75, 5), set(82.5, 5), set(60, 20, { done: false })];
    const live = livePRs(sets, hist, 'weight_reps');
    expect(live.has(sets[0].id)).toBe(false);
    // 82.5×5 beats 80 kg and the 1RM, but not the 70×8 = 560 kg set volume
    expect(live.get(sets[1].id)).toEqual(['weight', '1rm']);
    expect(live.has(sets[2].id)).toBe(false);
    expect(livePRs(sets, {}, 'weight_reps').size).toBe(0);
  });
});

describe('apple health bridge', () => {
  it('parses the Shortcut output with comma decimals and units', () => {
    const h = parseHealthText('GYMLOG\nKCAL:345,6\n92\n110 count/min\n131,0\n\n2');
    expect(h).toEqual({ calories: 346, avgHr: 111, maxHr: 131, hr: [92, 110, 131] });
  });

  it('rejects other clipboard contents, including our own request', () => {
    expect(parseHealthText('hello')).toBeNull();
    expect(parseHealthText(requestText(0, 60_000))).toBeNull();
    expect(parseHealthText('GYMLOG')).toBeNull();
  });

  it('formats the request window with a minute of slack', () => {
    const start = new Date(2026, 9, 25, 17, 0).getTime();
    expect(requestText(start, start + 3600e3)).toBe('GYMLOG-REQ|2026-10-25 16:59|2026-10-25 18:01');
  });

  it('downsamples long series', () => {
    const d = downsample(Array.from({ length: 1000 }, (_, i) => i), 100);
    expect(d).toHaveLength(100);
    expect(d[0]).toBe(5);
  });
});
