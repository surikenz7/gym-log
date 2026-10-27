import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { ClipboardList, Dumbbell, Home as HomeIcon, Play, Plus, Shield, User } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { db } from '../db/db';
import { getExercise } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { startWorkout } from '../screens/WorkoutTab';
import { useWorkout } from '../state/workout';
import { useSettings } from '../state/settings';
import { useBadges } from '../cloud/socialStore';
import { Sheet } from './ui';

export const DOCK_TABS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/workout', label: 'Routines', icon: ClipboardList },
  { to: '/ranks', label: 'Ranks', icon: Shield },
  { to: '/profile', label: 'Profile', icon: User },
];

function Tab({ to, label, icon: Icon }: (typeof DOCK_TABS)[number]) {
  const labels = useSettings((s) => s.tabLabels !== false);
  const badge = useBadges().total;
  return (
    <NavLink
      to={to}
      end={to === '/'}
      replace
      onClick={() => haptic()}
      className="relative flex h-full flex-1 flex-col items-center justify-center gap-[3px]"
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.div layoutId="dock-active" className="glass-lens absolute inset-y-[5px] inset-x-0 rounded-full" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
          <span className="relative">
            <Icon size={23} className={isActive ? 'text-accent' : 'text-white/75'} strokeWidth={isActive ? 2.4 : 2} />
            {to === '/profile' && badge > 0 && (
              <motion.span className="absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-[#fff]" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                {badge}
              </motion.span>
            )}
          </span>
          {labels && <span className={`relative text-[10px] font-semibold leading-none tracking-[0.01em] ${isActive ? 'text-accent' : 'text-white/75'}`}>{label}</span>}
        </>
      )}
    </NavLink>
  );
}

/** Quick start: empty workout or any routine, straight from the dock. */
export function StartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), []) ?? [];
  const go = (r?: (typeof routines)[number]) => {
    onClose();
    void startWorkout(r);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Start training">
      <div className="space-y-2 px-4 pt-2">
        <button onClick={() => go()} className="press cut grad stripes flex w-full items-center gap-3 px-4 py-4 text-left">
          <Plus size={24} strokeWidth={3} />
          <div>
            <div className="font-display text-xl font-bold uppercase leading-none">Empty workout</div>
            <div className="mt-1 text-xs opacity-80">Add exercises as you go</div>
          </div>
        </button>
        {routines.length > 0 && <div className="label pt-3">Routines</div>}
        {routines.map((r) => (
          <button key={r.id} onClick={() => go(r)} className="press cut flex w-full items-center gap-3 bg-card2 px-4 py-3 text-left">
            <Play size={18} className="shrink-0 text-accent" fill="currentColor" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-lg font-semibold uppercase leading-tight">{r.name}</div>
              <div className="truncate text-xs text-muted">{r.exercises.map((e) => getExercise(e.exerciseId).name).join(' · ')}</div>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** Floating dock: four tabs around a raised "train" button. */
export function Dock() {
  const active = useWorkout((s) => s.active);
  const setOpen = useWorkout((s) => s.setOpen);
  const [sheet, setSheet] = useState(false);
  const center = () => {
    haptic('success');
    if (active) setOpen(true);
    else setSheet(true);
  };
  return (
    // iOS 26-style floating Liquid Glass capsule: full width with the same 16pt gap to the
    // sides and to the bottom edge (tuned on iPhone 15 Pro: 393×852pt, 55pt display corners).
    <div className="px-4 pb-4">
      <nav className="glass relative flex h-[64px] items-center rounded-full px-[5px]">
        <Tab {...DOCK_TABS[0]} />
        <Tab {...DOCK_TABS[1]} />
        <div className="relative flex w-[66px] shrink-0 items-center justify-center">
          <motion.button
            onClick={center}
            whileTap={{ scale: 0.88 }}
            className="grad relative flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-[0_6px_20px_rgb(var(--accent)/0.5),inset_0_1px_1px_rgb(255_255_255/0.45)]"
            aria-label={active ? 'Resume workout' : 'Start workout'}
          >
            {active && <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-30" />}
            <Dumbbell size={25} strokeWidth={2.6} className="relative -rotate-45" />
          </motion.button>
        </div>
        <Tab {...DOCK_TABS[2]} />
        <Tab {...DOCK_TABS[3]} />
      </nav>
      <StartSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}
