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
