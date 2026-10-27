import { useSettings } from '../state/settings';

// iOS only lets audio play after a user gesture, so the context is unlocked on the first tap.
let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, at: number, len: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + len + 0.05);
}

export function beepRestDone() {
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(880, t, 0.18);
  tone(880, t + 0.25, 0.18);
  tone(1320, t + 0.5, 0.35);
}

export function beepTick() {
  if (!ctx) return;
  tone(660, ctx.currentTime, 0.08);
}

function chord(freq: number, at: number, len: number, type: OscillatorType = 'triangle', vol = 0.25) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + len + 0.05);
}

/** Short rising arpeggio for finishing a workout / a new record. */
export function fanfare(big = false) {
  if (!ctx || useSettings.getState().celebrations === false) return;
  const t = ctx.currentTime;
  const notes = big ? [392, 523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
  notes.forEach((f, i) => chord(f, t + i * 0.09, 0.35));
  const end = t + notes.length * 0.09;
  for (const f of big ? [523.25, 659.25, 783.99, 1046.5] : [783.99, 1046.5]) chord(f, end, big ? 1.1 : 0.6, 'sawtooth', 0.06);
}

/** Short two-note "ding" for an incoming message. */
export function beepMessage() {
  if (!ctx) return;
  const t = ctx.currentTime;
  chord(880, t, 0.18, 'sine', 0.22);
  chord(1318.5, t + 0.09, 0.28, 'sine', 0.18);
}
