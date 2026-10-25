import { format } from 'date-fns';
import type { WorkoutHealth } from '../types';

// Apple Health can't be read from a web app, so a user-made Shortcut does it:
// we copy "GYMLOG-REQ|start|end" to the clipboard and open the Shortcut; it reads heart rate and
// active energy for that window from Health and copies "GYMLOG / KCAL:x / bpm per line" back.
export const SHORTCUT_NAME = 'Gym Log Health';

export function requestText(start: number, end: number) {
  const f = (t: number) => format(t, 'yyyy-MM-dd HH:mm');
  // A minute of slack on both sides catches samples around the start/finish taps.
  return `GYMLOG-REQ|${f(start - 60_000)}|${f(end + 60_000)}`;
}

export function shortcutUrl() {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`;
}

const num = (s: string) => {
  const m = s.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
};

/** Parses the Shortcut's clipboard output. Returns null if it isn't Gym Log data. */
export function parseHealthText(text: string): WorkoutHealth | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length || !/^GYMLOG\b/i.test(lines[0]) || /^GYMLOG-REQ/i.test(lines[0])) return null;
  let calories: number | null = null;
  const hr: number[] = [];
  for (const l of lines.slice(1)) {
    if (/^KCAL/i.test(l)) {
      calories = num(l.slice(4));
      continue;
    }
    const v = num(l);
    if (v != null && v >= 25 && v <= 250) hr.push(Math.round(v));
  }
  if (!hr.length && calories == null) return null;
  return {
    calories: calories != null ? Math.round(calories) : null,
    avgHr: hr.length ? Math.round(hr.reduce((a, b) => a + b, 0) / hr.length) : null,
    maxHr: hr.length ? Math.max(...hr) : null,
    hr: downsample(hr, 120),
  };
}

/** Averages samples into at most `max` buckets so long workouts stay light to store and draw. */
export function downsample(xs: number[], max: number): number[] {
  if (xs.length <= max) return xs;
  const out: number[] = [];
  const size = xs.length / max;
  for (let i = 0; i < max; i++) {
    const part = xs.slice(Math.floor(i * size), Math.floor((i + 1) * size));
    out.push(Math.round(part.reduce((a, b) => a + b, 0) / part.length));
  }
  return out;
}
