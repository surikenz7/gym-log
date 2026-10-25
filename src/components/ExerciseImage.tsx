import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { imageUrl } from '../lib/exercises';
import type { Exercise } from '../types';

const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#ef4444', Shoulders: '#f97316', Triceps: '#f59e0b', Biceps: '#eab308', Forearms: '#84cc16',
  Lats: '#22c55e', 'Upper Back': '#14b8a6', 'Lower Back': '#06b6d4', Traps: '#0ea5e9', Abs: '#3b82f6',
  Quadriceps: '#6366f1', Hamstrings: '#8b5cf6', Glutes: '#a855f7', Calves: '#d946ef', Cardio: '#ec4899',
};

export function muscleColor(m: string) {
  return MUSCLE_COLORS[m] ?? '#64748b';
}

/** Round thumbnail (first frame), falls back to an initial on a muscle-coloured disc. */
export function ExerciseThumb({ ex, size = 44 }: { ex: Exercise; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!ex.img || failed) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ ...style, background: muscleColor(ex.muscle) + '33', color: muscleColor(ex.muscle) }}
      >
        {ex.custom ? ex.name.slice(0, 1).toUpperCase() : <Dumbbell size={size * 0.45} />}
      </div>
    );
  }
  return (
    <img
      src={imageUrl(ex.img, 0)}
      loading="lazy"
      decoding="async"
      alt=""
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-white object-cover"
      style={style}
    />
  );
}

/** Animated demo: crossfades between the start and end frames. */
export function ExerciseDemo({ ex }: { ex: Exercise }) {
  const [frame, setFrame] = useState<0 | 1>(0);
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f ? 0 : 1)), 1100);
    return () => clearInterval(t);
  }, []);
  if (!ex.img) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-card2 text-muted">
        <Dumbbell size={56} />
      </div>
    );
  }
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white">
      {loaded < 2 && <div className="absolute inset-0 animate-pulse bg-card2" />}
      {([0, 1] as const).map((f) => (
        <motion.img
          key={f}
          src={imageUrl(ex.img!, f)}
          alt=""
          onLoad={() => setLoaded((n) => n + 1)}
          className="absolute inset-0 h-full w-full object-contain"
          animate={{ opacity: frame === f ? 1 : 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
