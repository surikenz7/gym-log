import { describe, expect, it } from 'vitest';
import { DECO_ART } from '../components/Decorations';
import { DECORATIONS, earnedDecorations, rarityOf, redeemCode } from '../lib/decorations';
import { computeJourney } from '../lib/progress';
import type { Workout } from '../types';

const w = (id: string, date: Date, name = 'Workout'): Workout => ({
  id,
  name,
  start: date.getTime(),
  end: date.getTime() + 3600e3,
  exerciseIds: ['Barbell_Squat'],
  exercises: [{ id: 'e' + id, exerciseId: 'Barbell_Squat', sets: [{ id: 's' + id, type: 'normal', weight: 100, reps: 5, done: true }] }],
});

describe('avatar decorations', () => {
  it('has art, a unique id and a rarity for every decoration', () => {
    expect(DECORATIONS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(DECORATIONS.map((d) => d.id)).size).toBe(DECORATIONS.length);
    for (const d of DECORATIONS) {
      expect(DECO_ART[d.id], d.id).toBeTypeOf('function');
      expect(d.pct).toBeGreaterThan(0);
    }
    expect(rarityOf(95).label).toBe('Common');
    expect(rarityOf(0.05).label).toBe('Mythic');
  });

  it('unlocks from history, dates and workout names', () => {
    const ws = [
      w('a', new Date(2025, 11, 25, 10)), // Christmas
      w('b', new Date(2026, 0, 1, 0, 30)), // New Year, just after midnight
      w('c', new Date(2026, 9, 31, 23), 'Light Weight Baby!'), // Halloween, late
    ];
    const j = computeJourney(ws, () => 'weight_reps');
    const got = earnedDecorations(j, ws, null);
    expect(got).toEqual(expect.arrayContaining(['iron_ring', 'santa', 'party', 'moon', 'pumpkin', 'chain', 'horns']));
    expect(got).not.toContain('clover');
    expect(got).not.toContain('crown');
    expect(earnedDecorations(j, ws, 650)).toEqual(expect.arrayContaining(['crown', 'diamond']));
  });

  it('redeems secret codes regardless of case and spacing', async () => {
    expect(await redeemCode('iron paradise')).toBe('neon');
    expect(await redeemCode('No-Pain-No-Gain')).toBe('thorns');
    expect(await redeemCode('letmein')).toBeNull();
    expect(await redeemCode('')).toBeNull();
  });
});
