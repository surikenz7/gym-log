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

export type QuestMuscle = 'legs' | 'back' | 'chest' | 'shoulders' | 'arms' | 'core';
export const QUEST_MUSCLES: QuestMuscle[] = ['legs', 'back', 'chest', 'shoulders', 'arms', 'core'];
const GROUP: Record<string, QuestMuscle> = {
  Quadriceps: 'legs', Hamstrings: 'legs', Glutes: 'legs', Calves: 'legs', Adductors: 'legs', Abductors: 'legs',
  Lats: 'back', 'Upper Back': 'back', 'Lower Back': 'back', Traps: 'back',
  Chest: 'chest', Shoulders: 'shoulders', Biceps: 'arms', Triceps: 'arms', Forearms: 'arms', Abs: 'core',
};

/**
 * One person's week in quest terms. Published on the profile (`qw` = this week, `qa` = average of
 * the last 8) so a quest partner can see it: sessions, working sets, volume, reps, minutes, PR sets,
 * days trained (bit 0 = Monday) and working sets per muscle group.
 */
export interface QuestWeek {
  id: string;
  n: number;
  s: number;
  v: number;
  r: number;
  m: number;
  pr: number;
  d: number;
  g: Partial<Record<QuestMuscle, number>>;
}
export type QuestAvg = Omit<QuestWeek, 'id' | 'd'>;

const emptyWeek = (id: string): QuestWeek => ({ id, n: 0, s: 0, v: 0, r: 0, m: 0, pr: 0, d: 0, g: {} });
const dayBit = (t: number) => 1 << ((new Date(t).getDay() + 6) % 7);

function questMeasure(ws: Workout[], id: string, c: Ctx): QuestWeek {
  const out = emptyWeek(id);
  for (const w of ws) {
    out.n++;
    out.v += workoutVolume(w, c.typeOf);
    out.m += (w.end - w.start) / 60000;
    out.pr += c.prs.get(w.id) ?? 0;
    out.d |= dayBit(w.start);
    for (const e of w.exercises) {
      const sets = e.sets.filter((x) => x.type !== 'warmup');
      out.s += sets.length;
      out.r += sets.reduce((n, x) => n + (x.reps ?? 0), 0);
      const grp = GROUP[c.muscleOf(e.exerciseId)];
      if (grp) out.g[grp] = (out.g[grp] ?? 0) + sets.length;
    }
  }
  out.v = Math.round(out.v);
  out.m = Math.round(out.m);
  return out;
}

/** This week and the average week (last 8), as published on the profile. */
export function questStats(all: Workout[], c: Omit<Ctx, 'prs'>, now = new Date(), prs = prCounts(all, c.typeOf)) {
  const ctx = { ...c, prs };
  const w0 = weekStart(now);
  const qw = questMeasure(between(all, +w0, +addDays(w0, 7)), weekId(w0), ctx);
  const base = questMeasure(between(all, +subWeeks(w0, 8), +w0), '', ctx);
  const r1 = (x: number) => Math.round((x / 8) * 10) / 10;
  const g: QuestAvg['g'] = {};
  for (const k of QUEST_MUSCLES) if (base.g[k]) g[k] = r1(base.g[k]!);
  const qa: QuestAvg = { n: r1(base.n), s: r1(base.s), v: Math.round(base.v / 8), r: Math.round(base.r / 8), m: Math.round(base.m / 8), pr: r1(base.pr), g };
  return { qw, qa };
}

/** A partner's week for a quest; profiles from older app versions only have sessions / sets / volume. */
export function questWeekOf(p: { qw?: QuestWeek; wk?: PeriodStats; pw?: PeriodStats; mo?: PeriodStats; pm?: PeriodStats } | null | undefined, week: string): QuestWeek | null {
  if (!p) return null;
  if (p.qw?.id === week) return p.qw;
  if (p.qw) return null; // published, but for an earlier week: nothing yet this week
  const st = statsOf(p, week);
  return st ? { ...emptyWeek(week), n: st.n, s: st.s, v: st.v } : null;
}

/*
 * Quest kinds:
 *  - 'sum'  you both add up (sessions, sets, volume, reps, minutes, PRs, sets for a muscle group)
 *  - 'each' each of you has to get there (both train N times, both train at the weekend)
 *  - 'days' about the days you trained: on the same day N times, or N different days between you
 */
export type QuestKind = 'sessions' | 'sets' | 'volume' | 'reps' | 'minutes' | 'prs' | QuestMuscle | 'both' | 'weekend' | 'sameday' | 'tagteam';
export type QuestMode = 'sum' | 'each' | 'days';
export const questMode = (k: QuestKind): QuestMode => (k === 'both' || k === 'weekend' ? 'each' : k === 'sameday' || k === 'tagteam' ? 'days' : 'sum');

export const bitCount = (x: number) => {
  let n = 0;
  for (; x; x &= x - 1) n++;
  return n;
};
const WEEKEND = 0b1100000;

/** One partner's own number for a quest. */
export function questValue(kind: QuestKind, w: QuestWeek | null): number {
  if (!w) return 0;
  switch (kind) {
    case 'sessions':
    case 'both':
      return w.n;
    case 'sets':
      return w.s;
    case 'volume':
      return w.v;
    case 'reps':
      return w.r;
    case 'minutes':
      return w.m;
    case 'prs':
      return w.pr;
    case 'weekend':
      return w.d & WEEKEND ? 1 : 0;
    case 'sameday':
    case 'tagteam':
      return bitCount(w.d);
    default:
      return w.g?.[kind] ?? 0;
  }
}

/** The pair's number compared with the goal. */
export function questProgress(kind: QuestKind, a: QuestWeek | null, b: QuestWeek | null) {
  const mode = questMode(kind);
  if (mode === 'sum') return questValue(kind, a) + questValue(kind, b);
  if (mode === 'each') return Math.min(questValue(kind, a), questValue(kind, b));
  return bitCount(kind === 'sameday' ? (a?.d ?? 0) & (b?.d ?? 0) : (a?.d ?? 0) | (b?.d ?? 0));
}

export interface QuestOption {
  kind: QuestKind;
  goal: number;
}

const DEFAULT_AVG: QuestAvg = { n: 3, s: 45, v: 9000, r: 450, m: 180, pr: 1, g: {} };

/**
 * Three quest ideas for this pair for the rest of the week. Goals come from what both of you usually
 * do (the partner's average when their app publishes it), scaled to the days left, and only ideas
 * that can still be done this week are offered. A different `seed` gives other ideas.
 */
export function questOptions(me: { cur: QuestWeek; avg: QuestAvg }, them: { cur: QuestWeek | null; avg?: QuestAvg | null }, now = new Date(), seed = ''): QuestOption[] {
  const left = daysLeft('week', now);
  const frac = left / 7;
  const A = me.avg.n ? me.avg : DEFAULT_AVG;
  const B = them.avg?.n ? them.avg : A;
  const a = me.cur;
  const b = them.cur ?? emptyWeek(a.id);
  const together: QuestOption[] = [];
  const team: QuestOption[] = [];
  const special: QuestOption[] = [];

  const sum = (to: QuestOption[], kind: QuestKind, usual: number, step: number, min: number, max = Infinity) => {
    const cur = questProgress(kind, a, b);
    const goal = Math.max(cur + min, roundTo(cur + usual * frac * 1.1, step));
    if (goal - cur <= max) to.push({ kind, goal });
  };
  sum(team, 'sessions', A.n + B.n, 1, 1, left * 2);
  sum(team, 'sets', A.s + B.s, 5, 10);
  sum(team, 'volume', A.v + B.v, 1000, 2000);
  sum(team, 'reps', A.r + B.r, 50, 100);
  sum(team, 'minutes', A.m + B.m, 30, 60);
  if (A.pr + B.pr >= 1) sum(special, 'prs', A.pr + B.pr, 1, 1);
  for (const k of QUEST_MUSCLES) {
    const usual = (A.g[k] ?? 0) + (B.g[k] ?? 0);
    if (usual >= 6) sum(special, k, usual, 5, 10);
  }

  // each of you trains N times: the lighter trainer's usual week, if it still fits in the days left
  const low = Math.min(a.n, b.n);
  const both = Math.min(6, Math.max(low + 1, Math.round(Math.min(a.n + A.n * frac, b.n + B.n * frac))));
  if (both >= 2 && both - low <= left) together.push({ kind: 'both', goal: both });
  if (questProgress('weekend', a, b) < 1) together.push({ kind: 'weekend', goal: 1 });
  const today = (now.getDay() + 6) % 7;
  const rest = 0b1111111 & ~((1 << today) - 1); // today … Sunday
  const same = questProgress('sameday', a, b);
  const sameGoal = same + (left >= 5 && Math.min(A.n, B.n) >= 3 ? 2 : 1);
  if (sameGoal - same <= bitCount(rest & ~(a.d & b.d))) together.push({ kind: 'sameday', goal: sameGoal });
  const union = bitCount(a.d | b.d);
  const free = bitCount(rest & ~(a.d | b.d));
  const tag = Math.min(union + free, Math.max(union + 1, Math.round(union + Math.min(free, (A.n + B.n) * frac * 0.8))));
  if (free > 0 && tag >= 3) together.push({ kind: 'tagteam', goal: tag });

  const rnd = seeded(`${a.id}|${seed}`);
  const shuffle = (xs: QuestOption[]) => xs.map((x) => [rnd(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  const groups = [shuffle(together), shuffle(team), shuffle(special)];
  const out: QuestOption[] = [];
  for (const g of groups) if (g.length) out.push(g.shift()!);
  for (const x of shuffle(groups.flat())) if (out.length < 3) out.push(x);
  return out;
}
