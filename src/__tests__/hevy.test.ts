import { describe, expect, it } from 'vitest';
import { inferType, matchExercise, parseHevyCsv, parseHevyDate, toWorkouts } from '../import/hevy';
import { BUILTIN } from '../lib/exercises';

const CSV = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push Day","6 Feb 2024, 17:58","6 Feb 2024, 19:02","felt good","Bench Press (Barbell)",,"",0,"warmup",40,10,,,
"Push Day","6 Feb 2024, 17:58","6 Feb 2024, 19:02","felt good","Bench Press (Barbell)",,"",1,"normal",80,8,,,8
"Push Day","6 Feb 2024, 17:58","6 Feb 2024, 19:02","felt good","Bench Press (Barbell)",,"",2,"failure",80,6.0,,,
"Push Day","6 Feb 2024, 17:58","6 Feb 2024, 19:02","felt good","Lateral Raise (Dumbbell)",0,"",0,"normal",10,15,,,
"Push Day","6 Feb 2024, 17:58","6 Feb 2024, 19:02","felt good","Triceps Rope Pushdown",0,"",0,"dropset",25,12,,,
"Push Day","6 Feb 2024, 17:58","6 Feb 2024, 19:02","felt good","Plank",,"",0,"normal",,,,60,
"Push Day","6 Feb 2024, 17:58","6 Feb 2024, 19:02","felt good","Treadmill",,"",0,"normal",,,2.5,900,
"Legs","8 Feb 2024, 07:05","8 Feb 2024, 08:00","","Squat (Barbell)",,"",0,"normal",100,5,,,
"Legs","8 Feb 2024, 07:05","8 Feb 2024, 08:00","","Pull Up (Weighted)",,"",0,"normal",10,8,,,
"Legs","8 Feb 2024, 07:05","8 Feb 2024, 08:00","","Zercher Squat Weird Thing",,"",0,"normal",60,5,,,
`;

describe('hevy import', () => {
  it('parses Hevy dates as local time', () => {
    const t = parseHevyDate('6 Feb 2024, 17:58')!;
    const d = new Date(t);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2024, 1, 6, 17, 58]);
    expect(parseHevyDate('2024-02-06 17:58:00')).toBe(t);
    expect(parseHevyDate('')).toBeNull();
  });

  it('groups rows into workouts, exercises and sets', () => {
    const p = parseHevyCsv(CSV);
    expect(p.workouts).toHaveLength(2);
    const push = p.workouts[0];
    expect(push.title).toBe('Push Day');
    expect(push.end - push.start).toBe(64 * 60000);
    expect(push.exercises.map((e) => e.name)).toEqual([
      'Bench Press (Barbell)',
      'Lateral Raise (Dumbbell)',
      'Triceps Rope Pushdown',
      'Plank',
      'Treadmill',
    ]);
    expect(push.exercises[0].sets.map((s) => s.type)).toEqual(['warmup', 'normal', 'failure']);
    expect(push.exercises[0].sets[1]).toMatchObject({ weight: 80, reps: 8, rpe: 8 });
    expect(push.exercises[2].sets[0].type).toBe('drop');
    expect(push.exercises[4].sets[0]).toMatchObject({ distance: 2500, duration: 900 });
    expect(push.exercises[1].superset).toBe('0');
  });

  it('converts lbs exports to kg', () => {
    const p = parseHevyCsv(CSV.replace('"weight_kg"', '"weight_lbs"'));
    expect(p.workouts[0].exercises[0].sets[1].weight).toBeCloseTo(36.287, 2);
  });

  it('rejects non-Hevy files', () => {
    expect(() => parseHevyCsv('a,b\n1,2')).toThrow();
  });

  it('matches popular exercises exactly and infers custom types', () => {
    const p = parseHevyCsv(CSV);
    const f = (n: string) => p.exercises.find((e) => e.name === n)!.fields;
    expect(matchExercise('Bench Press (Barbell)', f('Bench Press (Barbell)'), BUILTIN)).toEqual({ id: 'Barbell_Bench_Press_-_Medium_Grip', exact: true });
    expect(matchExercise('Squat (Barbell)', f('Squat (Barbell)'), BUILTIN)?.id).toBe('Barbell_Squat');
    expect(matchExercise('Plank', f('Plank'), BUILTIN)?.id).toBe('Plank');
    expect(matchExercise('Treadmill', f('Treadmill'), BUILTIN)?.id).toBe('Running_Treadmill');
    expect(matchExercise('Zercher Squat Weird Thing', f('Zercher Squat Weird Thing'), BUILTIN)).toBeNull();
    expect(inferType('Pull Up (Weighted)', ['weight', 'reps'])).toBe('weighted_bodyweight');
    expect(inferType('Something', ['duration'])).toBe('duration');
    expect(inferType('Something', ['distance', 'duration'])).toBe('distance_duration');
    expect(inferType('Something', ['reps'])).toBe('bodyweight_reps');
  });

  it('fuzzy matches Hevy names that are not in the alias table', () => {
    const m = matchExercise('Incline Dumbbell Fly', ['weight', 'reps'], BUILTIN);
    expect(m?.exact).toBe(false);
    expect(m?.id).toMatch(/Incline_Dumbbell_Fl/);
  });

  it('builds app workouts with done sets and shared superset ids', () => {
    const p = parseHevyCsv(CSV);
    const ws = toWorkouts(p.workouts, (n) => 'id:' + n);
    expect(ws[0].exercises.every((e) => e.sets.every((s) => s.done))).toBe(true);
    expect(ws[0].exercises[1].supersetId).toBeTruthy();
    expect(ws[0].exercises[1].supersetId).toBe(ws[0].exercises[2].supersetId);
    expect(ws[0].exerciseIds).toContain('id:Plank');
  });
});
