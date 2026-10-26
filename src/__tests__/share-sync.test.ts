import { describe, expect, it } from 'vitest';
import { hash } from '../cloud/sync';
import { codeFromText, decodeRoutine, encodeRoutine, unpackExercises } from '../lib/share';
import type { WExercise } from '../types';

const exercises: WExercise[] = [
  {
    id: 'a',
    exerciseId: 'Barbell_Bench_Press_-_Medium_Grip',
    restSec: 120,
    supersetId: null,
    notes: 'Pause at the bottom',
    sets: [
      { id: '1', type: 'warmup', weight: 40, reps: 10, done: false },
      { id: '2', type: 'normal', weight: null, reps: 8, done: false, ph: { weight: 80 } },
    ],
  },
  { id: 'b', exerciseId: 'Plank', sets: [{ id: '3', type: 'normal', duration: 60, done: false }] },
];

describe('routine links', () => {
  it('round-trips a routine through a compact link code', async () => {
    const code = await encodeRoutine({ name: 'Push Day', notes: 'Heavy', exercises });
    expect(code.length).toBeLessThan(400);
    const link = `https://surikenz7.github.io/gym-log/#/r/${code}`;
    expect(codeFromText(`Check this out: ${link}`)).toBe(code);
    const p = (await decodeRoutine(code))!;
    expect(p.n).toBe('Push Day');
    expect(p.notes).toBe('Heavy');
    const ex = unpackExercises(p);
    expect(ex.map((e) => e.exerciseId)).toEqual(['Barbell_Bench_Press_-_Medium_Grip', 'Plank']);
    expect(ex[0].restSec).toBe(120);
    expect(ex[0].notes).toBe('Pause at the bottom');
    // placeholder targets become real values for the receiver
    expect(ex[0].sets.map((s) => [s.type, s.weight, s.reps])).toEqual([
      ['warmup', 40, 10],
      ['normal', 80, 8],
    ]);
    expect(ex[1].sets[0].duration).toBe(60);
    expect(ex[0].id).not.toBe('a');
  });

  it('rejects broken codes', async () => {
    expect(await decodeRoutine('zNOTVALID')).toBeNull();
    expect(await decodeRoutine('x123')).toBeNull();
    expect(codeFromText('hello')).toBeNull();
  });
});

describe('sync hashing', () => {
  it('is stable and sensitive to changes', () => {
    expect(hash('abc')).toBe(hash('abc'));
    expect(hash('abc')).not.toBe(hash('abd'));
    expect(hash(JSON.stringify({ a: 1 }))).not.toBe(hash(JSON.stringify({ a: 2 })));
  });
});
