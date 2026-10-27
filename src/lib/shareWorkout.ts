import { format } from 'date-fns';
import type { Settings, Workout } from '../types';
import { getExercise, typeOf } from './exercises';
import { workoutVolume } from './stats';
import { fmtDurationLong, fmtNum, fmtVolume, kgTo } from './units';

const cssRgb = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `rgb(${v.split(/[\s,]+/).join(' ')})` : fallback;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** Story-sized summary card (1080×1350) in the current theme colours. */
export async function workoutImage(w: Workout, s: Settings, nick?: string, avatar?: string | null): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  const accent = cssRgb('--accent', '#e5262d');
  const bg = cssRgb('--bg', '#0b0b0c');
  const card = cssRgb('--card', '#17171a');
  const display = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'Oswald, Impact, sans-serif';
  await document.fonts?.ready;

  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W);
  glow.addColorStop(0, accent.replace('rgb(', 'rgba(').replace(')', ' / 0.45)'));
  glow.addColorStop(1, 'transparent');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  let y = 110;
  if (nick) {
    const img = avatar ? await loadImage(avatar) : null;
    g.save();
    g.beginPath();
    g.arc(110, y, 46, 0, Math.PI * 2);
    g.fillStyle = accent;
    g.fill();
    g.clip();
    if (img) g.drawImage(img, 64, y - 46, 92, 92);
    g.restore();
    g.fillStyle = '#fff';
    g.font = `700 40px system-ui, sans-serif`;
    g.fillText('@' + nick, 180, y + 14);
    y += 110;
  }
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.font = `600 34px system-ui, sans-serif`;
  g.fillText(format(w.start, 'EEEE, d MMMM yyyy').toUpperCase(), 64, y);
  y += 100;
  g.fillStyle = '#fff';
  g.font = `700 96px ${display}`;
  const title = w.name.toUpperCase();
  let t = title;
  while (g.measureText(t).width > W - 128 && t.length > 4) t = t.slice(0, -2);
  g.fillText(t === title ? t : t + '…', 64, y);
  y += 60;

  const stats: [string, string][] = [
    ['TIME', fmtDurationLong((w.end - w.start) / 1000)],
    ['VOLUME', fmtVolume(workoutVolume(w, typeOf), s)],
    ['SETS', String(w.exercises.reduce((n, e) => n + e.sets.filter((x) => x.type !== 'warmup').length, 0))],
  ];
  const bw = (W - 128 - 40) / 3;
  stats.forEach(([k, v], i) => {
    const x = 64 + i * (bw + 20);
    g.fillStyle = card;
    g.fillRect(x, y, bw, 150);
    g.fillStyle = accent;
    g.fillRect(x, y, 8, 150);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.font = `600 26px system-ui, sans-serif`;
    g.fillText(k, x + 32, y + 50);
    g.fillStyle = '#fff';
    g.font = `700 52px ${display}`;
    g.fillText(v, x + 32, y + 115, bw - 48);
  });
  y += 220;

  const shown = w.exercises.slice(0, 7);
  for (const e of shown) {
    const best = e.sets.filter((x) => x.type !== 'warmup' && x.weight).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
    g.fillStyle = accent;
    g.font = `700 44px ${display}`;
    g.fillText(`${e.sets.length}×`, 64, y);
    g.fillStyle = '#fff';
    g.font = `500 40px system-ui, sans-serif`;
    g.fillText(getExercise(e.exerciseId).name, 160, y, best ? 600 : 850);
    if (best) {
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.textAlign = 'right';
      g.fillText(`${fmtNum(kgTo(best.weight!, s.weightUnit))} ${s.weightUnit} × ${best.reps ?? 0}`, W - 64, y);
      g.textAlign = 'left';
    }
    y += 76;
  }
  if (w.exercises.length > shown.length) {
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.font = `500 34px system-ui, sans-serif`;
    g.fillText(`+${w.exercises.length - shown.length}`, 160, y);
  }

  g.fillStyle = accent;
  g.fillRect(0, H - 110, W, 110);
  g.fillStyle = '#fff';
  g.font = `700 44px ${display}`;
  g.fillText('GYM LOG', 64, H - 40);
  g.font = `500 30px system-ui, sans-serif`;
  g.textAlign = 'right';
  g.fillText('surikenz7.github.io/gym-log', W - 64, H - 44);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

/** Opens the iOS share sheet with the image (falls back to a download). Returns false if cancelled / failed. */
export async function shareWorkout(w: Workout, s: Settings, nick?: string, avatar?: string | null) {
  const blob = await workoutImage(w, s, nick, avatar);
  if (!blob) return false;
  const file = new File([blob], `${w.name.replace(/[^\w-]+/g, '_') || 'workout'}.png`, { type: 'image/png' });
  const text = `${w.name} · ${fmtDurationLong((w.end - w.start) / 1000)} · ${fmtVolume(workoutVolume(w, typeOf), s)}`;
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return true;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return false;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
