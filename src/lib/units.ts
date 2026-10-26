import type { ExerciseType, Settings, WSet } from '../types';

export const KG_PER_LB = 0.45359237;
const M_PER_MI = 1609.344;
const M_PER_YD = 0.9144;

/** Parses user input; accepts both "," and "." as decimal separator (Czech iOS keypad shows ","). */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '' || t === '.') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function round(n: number, dp = 2) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function kgTo(kg: number, unit: Settings['weightUnit']) {
  return unit === 'kg' ? round(kg, 2) : round(kg / KG_PER_LB, 1);
}

export function toKg(v: number, unit: Settings['weightUnit']) {
  return unit === 'kg' ? v : v * KG_PER_LB;
}

/** Cardio distances are shown in km/mi, carries in m/yd. */
export function isShortDistance(type: ExerciseType) {
  return type === 'weight_distance';
}

export function distTo(m: number, unit: Settings['distanceUnit'], short: boolean) {
  if (short) return unit === 'km' ? round(m, 1) : round(m / M_PER_YD, 1);
  return unit === 'km' ? round(m / 1000, 2) : round(m / M_PER_MI, 2);
}

export function toMeters(v: number, unit: Settings['distanceUnit'], short: boolean) {
  if (short) return unit === 'km' ? v : v * M_PER_YD;
  return unit === 'km' ? v * 1000 : v * M_PER_MI;
}

export function distLabel(unit: Settings['distanceUnit'], short: boolean) {
  if (short) return unit === 'km' ? 'm' : 'yd';
  return unit;
}

export function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : String(round(n, 2));
}

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function fmtDuration(sec: number) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Long form for summaries: "1h 5min", "45min", "30s" */
export function fmtDurationLong(sec: number) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}h ${m}min`;
  if (m) return s ? `${m}min ${s}s` : `${m}min`;
  return `${sec}s`;
}

/** Microwave-style digits: "130" -> 90s (1:30), "10000" -> 1:00:00 */
export function digitsToSeconds(d: string): number | null {
  const digits = d.replace(/\D/g, '').slice(-6);
  if (!digits) return null;
  const p = digits.padStart(6, '0');
  return Number(p.slice(0, 2)) * 3600 + Number(p.slice(2, 4)) * 60 + Number(p.slice(4, 6));
}

export function secondsToDigits(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h ? `${h}${String(m).padStart(2, '0')}` : m ? String(m) : '') + (h || m ? String(s).padStart(2, '0') : String(s));
}

export type Field = 'weight' | 'reps' | 'duration' | 'distance';

export const FIELDS: Record<ExerciseType, Field[]> = {
  weight_reps: ['weight', 'reps'],
  bodyweight_reps: ['reps'],
  weighted_bodyweight: ['weight', 'reps'],
  assisted_bodyweight: ['weight', 'reps'],
  duration: ['duration'],
  distance_duration: ['distance', 'duration'],
  weight_distance: ['weight', 'distance'],
  weight_duration: ['weight', 'duration'],
};

export const TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Weight & Reps',
  bodyweight_reps: 'Bodyweight Reps',
  weighted_bodyweight: 'Weighted Bodyweight',
  assisted_bodyweight: 'Assisted Bodyweight',
  duration: 'Duration',
  distance_duration: 'Distance & Duration',
  weight_distance: 'Weight & Distance',
  weight_duration: 'Weight & Duration',
};

export function fieldHeader(f: Field, type: ExerciseType, s: Settings) {
  switch (f) {
    case 'weight':
      return (type === 'weighted_bodyweight' ? '+' : type === 'assisted_bodyweight' ? '-' : '') + s.weightUnit.toUpperCase();
    case 'reps':
      return 'REPS';
    case 'duration':
      return 'TIME';
    case 'distance':
      return distLabel(s.distanceUnit, isShortDistance(type)).toUpperCase();
  }
}

/** Compact one-line description of a set, e.g. "80 kg × 8" */
export function fmtSet(set: Partial<WSet>, type: ExerciseType, s: Settings): string {
  const parts: string[] = [];
  const short = isShortDistance(type);
  for (const f of FIELDS[type]) {
    const v = set[f];
    if (v == null) continue;
    if (f === 'weight') {
      const sign = type === 'weighted_bodyweight' ? '+' : type === 'assisted_bodyweight' ? '-' : '';
      parts.push(`${sign}${fmtNum(kgTo(v, s.weightUnit))} ${s.weightUnit}`);
    } else if (f === 'reps') parts.push(`${v}`);
    else if (f === 'duration') parts.push(fmtDuration(v));
    else parts.push(`${fmtNum(distTo(v, s.distanceUnit, short))} ${distLabel(s.distanceUnit, short)}`);
  }
  if (type === 'weight_reps' || type === 'weighted_bodyweight' || type === 'assisted_bodyweight') {
    if (parts.length === 2) return `${parts[0]} × ${parts[1]}`;
    if (set.reps != null && set.weight == null) return `${set.reps} reps`;
  }
  if (type === 'bodyweight_reps' && parts.length) return `${parts[0]} reps`;
  return parts.join(' · ');
}

export function fmtVolume(kg: number, s: Settings) {
  const v = kgTo(kg, s.weightUnit);
  return `${Math.round(v).toLocaleString('en-US')} ${s.weightUnit}`;
}

/** 1234 → 1.2K, 2500000 → 2.5M */
export function compact(n: number) {
  if (Math.abs(n) >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return `${+n.toFixed(1)}`;
}
