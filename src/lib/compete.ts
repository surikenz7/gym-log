import { addDays, addMonths, endOfMonth, format, getISOWeek, getISOWeekYear, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import type { ExerciseType, Workout } from '../types';
import { prCounts, workoutVolume } from './stats';

/*
 * Challenges and friend leagues. Everything here is computed from workout history, so solo
 * challenges work offline; leagues compare the period summaries everyone publishes on their profile.
 */

export const weekId = (d: Date | number) => `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`;
export const monthId = (d: Date | number) => format(d, 'yyyy-MM');
export const weekStart = (d: Date | number) => startOfWeek(d, { weekStartsOn: 1 });

/** Summary of one week or month: sessions, volume (kg), working sets, league points. */
export interface PeriodStats {
  id: string;
  n: number;
  v: number;
  s: number;
  pts: number;
}

/*
 * DOTS coefficients (used in powerlifting to compare lifters of any bodyweight and sex).
 * Divided by an 80 kg man's coefficient, so he scores ×1.00, lighter lifters and women more.
 */
const DOTS = {
  male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
};
function dots(bw: number, sex: 'male' | 'female') {
  const c = DOTS[sex];
  const x = Math.min(Math.max(bw, 40), sex === 'male' ? 210 : 150);
  return 500 / (c[0] + c[1] * x + c[2] * x ** 2 + c[3] * x ** 3 + c[4] * x ** 4);
}
const REF = dots(80, 'male');

/** League handicap from bodyweight and sex; 1 when either is unknown. */
export function fairness(bw: number | null | undefined, sex: 'male' | 'female' | null | undefined) {
  if (!bw || !sex) return 1;
  return Math.round((dots(bw, sex) / REF) * 1000) / 1000;
}

/** 1 point per 100 kg lifted (handicapped) + 20 per session, so consistency counts as much as load. */
export const leaguePoints = (volume: number, sessions: number, coef: number) => Math.round((volume * coef) / 100) + sessions * 20;

const workingSets = (w: Workout) => w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.type !== 'warmup').length, 0);

export function periodStats(ws: Workout[], id: string, from: number, to: number, coef: number, typeOf: (id: string) => ExerciseType): PeriodStats {
  let n = 0;
  let v = 0;
  let s = 0;
  for (const w of ws) {
    if (w.start < from || w.start >= to) continue;
    n++;
    v += workoutVolume(w, typeOf);
    s += workingSets(w);
  }
  v = Math.round(v);
  return { id, n, v, s, pts: leaguePoints(v, n, coef) };
}

/** This and last week / month, as published on the profile. */
export function leagueSummary(ws: Workout[], coef: number, typeOf: (id: string) => ExerciseType, now = new Date()) {
  const w0 = weekStart(now);
  const m0 = startOfMonth(now);
  const lw = subWeeks(w0, 1);
  const lm = subMonths(m0, 1);
  return {
    wk: periodStats(ws, weekId(w0), +w0, +addDays(w0, 7), coef, typeOf),
    pw: periodStats(ws, weekId(lw), +lw, +w0, coef, typeOf),
    mo: periodStats(ws, monthId(m0), +m0, +addMonths(m0, 1), coef, typeOf),
    pm: periodStats(ws, monthId(lm), +lm, +m0, coef, typeOf),
  };
}

/** A friend's published stats for a period, or null when they haven't trained in it. */
export function statsOf(p: { wk?: PeriodStats; pw?: PeriodStats; mo?: PeriodStats; pm?: PeriodStats }, id: string): PeriodStats | null {
  for (const x of [p.wk, p.pw, p.mo, p.pm]) if (x?.id === id) return x;
  return null;
}

/** 1-based place of `me` among people who scored, or 0 (needs at least two people with points). */
export function placeOf(rows: { uid: string; pts: number }[], me: string) {
  const scored = rows.filter((r) => r.pts > 0).sort((a, b) => b.pts - a.pts);
  if (scored.length < 2) return 0;
  return scored.findIndex((r) => r.uid === me) + 1;
}

/* ------------------------------------------------------------------ challenges */

export type ChallengeKind = 'sessions' | 'volume' | 'sets' | 'weekend' | 'pr' | 'legs' | 'minutes' | 'exercises' | 'weeks';

export interface Challenge {
  kind: ChallengeKind;
  target: number;
  value: number;
}

const LEGS = new Set(['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Abductors']);

function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const roundTo = (x: number, step: number) => Math.round(x / step) * step;

type Ctx = { typeOf: (id: string) => ExerciseType; muscleOf: (id: string) => string; prs: Map<string, number> };

/** Raw measurements of a set of workouts, one per challenge kind. */
function measure(ws: Workout[], c: Ctx): Record<ChallengeKind, number> {
  const ex = new Set<string>();
  const weeks = new Set<string>();
  const out = { sessions: ws.length, volume: 0, sets: 0, weekend: 0, pr: 0, legs: 0, minutes: 0, exercises: 0, weeks: 0 };
  for (const w of ws) {
    out.volume += workoutVolume(w, c.typeOf);
    out.sets += workingSets(w);
    out.minutes += (w.end - w.start) / 60000;
    out.pr += c.prs.get(w.id) ?? 0;
    if ([0, 6].includes(new Date(w.start).getDay())) out.weekend = 1;
    if (w.exercises.some((e) => LEGS.has(c.muscleOf(e.exerciseId)))) out.legs++;
    w.exercises.forEach((e) => ex.add(e.exerciseId));
    weeks.add(weekId(w.start));
  }
  out.exercises = ex.size;
  out.weeks = weeks.size;
  out.volume = Math.round(out.volume);
  out.minutes = Math.round(out.minutes);
  return out;
}

const between = (ws: Workout[], from: number, to: number) => ws.filter((w) => w.start >= from && w.start < to);

/** Three weekly challenges, scaled to your last 8 weeks and the same for the whole week. */
export function weeklyChallenges(all: Workout[], c: Omit<Ctx, 'prs'>, now = new Date(), prs = prCounts(all, c.typeOf)): Challenge[] {
  const ctx = { ...c, prs };
  const w0 = weekStart(now);
  const base = measure(between(all, +subWeeks(w0, 8), +w0), ctx);
  const avg = (k: ChallengeKind) => base[k] / 8;
  const cur = measure(between(all, +w0, +addDays(w0, 7)), ctx);
  const targets: Record<string, number> = {
    sessions: Math.min(6, Math.max(2, Math.round(avg('sessions')) + 1)),
    volume: Math.max(5000, roundTo(avg('volume') * 1.1, 1000)),
    sets: Math.max(25, roundTo(avg('sets') * 1.1, 5)),
    weekend: 1,
    pr: 1,
    legs: avg('sessions') >= 3 ? 2 : 1,
    minutes: Math.max(90, roundTo(avg('minutes') * 1.1, 15)),
    exercises: Math.max(6, Math.round((base.exercises / 8) * 1.5)),
  };
  const rnd = seeded(weekId(w0));
  const pool = (['volume', 'sets', 'weekend', 'pr', 'legs', 'minutes', 'exercises'] as ChallengeKind[]).sort(() => rnd() - 0.5);
  return (['sessions', pool[0], pool[1]] as ChallengeKind[]).map((kind) => ({ kind, target: targets[kind], value: cur[kind] }));
}

function monthly(all: Workout[], ctx: Ctx, m0: Date): Challenge {
  const base = measure(between(all, +subMonths(m0, 3), +m0), ctx);
  const avg = (k: ChallengeKind) => base[k] / 3;
  const cur = measure(between(all, +m0, +addMonths(m0, 1)), ctx);
  let weeksInMonth = 0;
  for (let d = weekStart(m0); d <= endOfMonth(m0); d = addDays(d, 7)) weeksInMonth++;
  const targets: Record<string, number> = {
    sessions: Math.max(6, Math.round(avg('sessions')) + 2),
    volume: Math.max(20000, roundTo(avg('volume') * 1.15, 5000)),
    sets: Math.max(100, roundTo(avg('sets') * 1.15, 10)),
    pr: Math.max(3, Math.round(avg('pr') * 1.2)),
    weeks: weeksInMonth,
  };
  const kinds: ChallengeKind[] = ['sessions', 'volume', 'sets', 'pr', 'weeks'];
  const kind = kinds[Math.floor(seeded(monthId(m0))() * kinds.length)];
  return { kind, target: targets[kind], value: cur[kind] };
}

export function monthlyChallenge(all: Workout[], c: Omit<Ctx, 'prs'>, now = new Date(), prs = prCounts(all, c.typeOf)): Challenge {
  return monthly(all, { ...c, prs }, startOfMonth(now));
}

/** Months (yyyy-MM) whose monthly challenge you completed, newest first. */
export function monthlyBadges(all: Workout[], c: Omit<Ctx, 'prs'>, now = new Date()): string[] {
  if (!all.length) return [];
  const ctx = { ...c, prs: prCounts(all, c.typeOf) };
  const first = startOfMonth(Math.min(...all.map((w) => w.start)));
  const out: string[] = [];
  for (let m = startOfMonth(now); m >= first; m = subMonths(m, 1)) {
    const ch = monthly(all, ctx, m);
    if (ch.value >= ch.target) out.push(monthId(m));
  }
  return out;
}

/** Days left in the current week / month, counting today. */
export function daysLeft(period: 'week' | 'month', now = new Date()) {
  const end = period === 'week' ? addDays(weekStart(now), 7) : addMonths(startOfMonth(now), 1);
  return Math.max(1, Math.ceil((+end - +now) / 86400000));
}

/* ------------------------------------------------------------------ friend quests */

export type QuestKind = 'sessions' | 'sets' | 'volume';

/** Shared weekly goal for two friends: about what both usually do together, plus a bit. */
export function questGoal(kind: QuestKind, myWeek: { n: number; s: number; v: number }) {
  if (kind === 'sessions') return Math.max(5, Math.round(myWeek.n * 2 * 1.1));
  if (kind === 'sets') return Math.max(60, roundTo(myWeek.s * 2 * 1.1, 10));
  return Math.max(15000, roundTo(myWeek.v * 2 * 1.1, 5000));
}

/** Average week over the last 8 (for quest goals). */
export function averageWeek(all: Workout[], typeOf: (id: string) => ExerciseType, now = new Date()) {
  const w0 = weekStart(now);
  const s = periodStats(all, '', +subWeeks(w0, 8), +w0, 1, typeOf);
  return { n: s.n / 8, s: s.s / 8, v: s.v / 8 };
}

export const questKindOf = (week: string): QuestKind => (['sessions', 'sets', 'volume'] as const)[Math.floor(seeded('q' + week)() * 3)];
