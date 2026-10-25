import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { ClipboardList, Dumbbell, Home as HomeIcon, Play, Plus, Shield, User } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { tabNav } from '../lib/tabNav';
import { db } from '../db/db';
import { getExercise } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { startWorkout } from '../screens/WorkoutTab';
import { useWorkout } from '../state/workout';
import { Sheet } from './ui';

export const DOCK_TABS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/workout', label: 'Routines', icon: ClipboardList },
  { to: '/ranks', label: 'Ranks', icon: Shield },
  { to: '/profile', label: 'Profile', icon: User },
];

function Tab({ to, label, icon: Icon }: (typeof DOCK_TABS)[number]) {
  const here = DOCK_TABS.findIndex((t) => t.to === useLocation().pathname);
  const there = DOCK_TABS.findIndex((t) => t.to === to);
  return (
    <NavLink
      to={to}
      end={to === '/'}
      replace
      onClick={() => {
        haptic();
        tabNav.dir = Math.sign(there - here);
      }} className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5">
      {({ isActive }) => (
        <>
          {isActive && <motion.div layoutId="dock-active" className="cut-sm absolute inset-x-1 inset-y-1 bg-accent/15" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <Icon size={22} className={`relative ${isActive ? 'text-accent' : 'text-muted'}`} strokeWidth={isActive ? 2.6 : 2} />
          <span className={`relative font-display text-[9px] font-semibold uppercase tracking-[0.14em] ${isActive ? 'text-white' : 'text-muted'}`}>{label}</span>
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
    // Sits on the bottom edge like a native tab bar: the background runs under the home indicator,
    // the buttons stay just above it.
    <div>
      <nav className="relative flex items-stretch px-1" style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom) - 14px), calc(var(--vgap) - 14px), 4px)' }}>
        <div className="cut-top absolute inset-0 bg-card2/95 backdrop-blur-xl" style={{ boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.07)' }} />
        <Tab {...DOCK_TABS[0]} />
        <Tab {...DOCK_TABS[1]} />
        <div className="relative flex w-20 shrink-0 items-center justify-center">
          <motion.button
            onClick={center}
            whileTap={{ scale: 0.9, rotate: -8 }}
            className="hex grad relative -mt-6 flex h-[62px] w-[58px] items-center justify-center shadow-[0_8px_30px_rgb(var(--accent)/0.45)]"
            aria-label={active ? 'Resume workout' : 'Start workout'}
          >
            {active && <span className="hex absolute inset-0 animate-ping bg-accent opacity-30" />}
            <Dumbbell size={26} strokeWidth={2.6} className="relative -rotate-45" />
          </motion.button>
        </div>
        <Tab {...DOCK_TABS[2]} />
        <Tab {...DOCK_TABS[3]} />
      </nav>
      <StartSheet open={sheet} onClose={() => setSheet(false)} />
    </div>
  );
}
