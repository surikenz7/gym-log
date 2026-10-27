import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { haptic } from '../lib/haptics';
import { t } from '../i18n';

const FACES = ['😫', '😣', '😕', '😐', '🙂', '😊', '😄', '💪', '🔥', '🏆'];
const WORDS = ['Brutal', 'Rough', 'Meh', 'Okay', 'Decent', 'Good', 'Great', 'Strong', 'Beast mode', 'Perfect'];
export const ratingFace = (r: number) => FACES[Math.min(9, Math.max(0, r - 1))];
export const ratingWord = (r: number) => t(WORDS[Math.min(9, Math.max(0, r - 1))]);

/**
 * 1–10 slider that snaps to each step with a tick of haptics, like a native picker.
 * `value` null = not rated yet (thumb waits in the middle, greyed).
 */
export function RatingSlider({ value, onChange }: { value: number | null | undefined; onChange: (v: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<number | null>(value ?? null);
  const [dragging, setDragging] = useState(false);
  const x = useMotionValue(0); // 0..1 along the track
  const fill = useTransform(x, (p) => `${p * 100}%`);
  const left = useTransform(x, (p) => `calc(${p * 100}% - ${p * 36}px)`);

  const pos = (r: number) => (r - 1) / 9;
  useEffect(() => {
    if (!dragging) x.set(pos(v ?? 5.5));
  }, []);

  const fromPointer = (clientX: number) => {
    const el = track.current!;
    const b = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - b.left - 18) / (b.width - 36)));
  };
  const setFrom = (p: number, live: boolean) => {
    const r = Math.round(p * 9) + 1;
    if (r !== v) {
      haptic();
      setV(r);
    }
    if (live) x.set(p);
    else animate(x, pos(r), { type: 'spring', stiffness: 700, damping: 32 });
    return r;
  };

  return (
    <div className="select-none">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="label">{t('How was it?')}</div>
          <motion.div key={v ?? 'none'} className="font-display text-2xl font-bold" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 25 }}>
            {v ? ratingWord(v) : t('Slide to rate')}
          </motion.div>
        </div>
        <motion.div key={`f${v}`} className="text-5xl leading-none" initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 700, damping: 14 }}>
          {v ? ratingFace(v) : '🤔'}
        </motion.div>
      </div>
      <div
        ref={track}
        className="relative h-12 touch-none"
        data-no-swipe
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setDragging(true);
          setFrom(fromPointer(e.clientX), true);
        }}
        onPointerMove={(e) => dragging && setFrom(fromPointer(e.clientX), true)}
        onPointerUp={(e) => {
          setDragging(false);
          const r = setFrom(fromPointer(e.clientX), false);
          haptic('success');
          onChange(r);
        }}
        onPointerCancel={() => setDragging(false)}
      >
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
          <motion.div className="grad h-full rounded-full" style={{ width: fill, opacity: v ? 1 : 0.25 }} />
        </div>
        <div className="pointer-events-none absolute inset-x-[18px] top-1/2 flex -translate-y-1/2 justify-between">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${v && i < v ? 'bg-ink/60' : 'bg-white/25'}`} />
          ))}
        </div>
        <motion.div
          className="grad absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full font-display text-sm font-bold shadow-[0_4px_14px_rgb(var(--accent)/0.5)]"
          style={{ left, opacity: v ? 1 : 0.6 }}
          animate={{ scale: dragging ? 1.25 : 1 }}
          transition={{ type: 'spring', stiffness: 600, damping: 20 }}
        >
          {v ?? '?'}
        </motion.div>
      </div>
      <div className="mt-1 flex justify-between px-1 text-[10px] font-semibold text-muted">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}
