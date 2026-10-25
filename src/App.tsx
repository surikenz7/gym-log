import { AnimatePresence, motion } from 'framer-motion';
import { Dumbbell, History as HistoryIcon, ListChecks, Share, User } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { DialogHost, Portal, spring, ToastHost } from './components/ui';
import { ActiveWorkout, MiniWorkoutBar, RestWatcher } from './screens/ActiveWorkout';
import { ExercisePage, Exercises } from './screens/Exercises';
import { HevyImport } from './screens/HevyImport';
import { History } from './screens/History';
import { Profile } from './screens/Profile';
import { RoutineEditor } from './screens/RoutineEditor';
import { Settings } from './screens/Settings';
import { Summary, WorkoutDetail, WorkoutEdit } from './screens/WorkoutDetail';
import { WorkoutTab } from './screens/WorkoutTab';

const TABS = [
  { to: '/', label: 'Workout', icon: Dumbbell },
  { to: '/history', label: 'History', icon: HistoryIcon },
  { to: '/exercises', label: 'Exercises', icon: ListChecks },
  { to: '/profile', label: 'Profile', icon: User },
];

function TabBar() {
  return (
    <nav className="border-t border-line bg-bg/90 pb-safe backdrop-blur-xl">
      <div className="flex">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} replace className="flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2">
            {({ isActive }) => (
              <>
                <motion.div animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -1 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                  <Icon size={24} className={isActive ? 'text-accent' : 'text-muted'} strokeWidth={isActive ? 2.4 : 2} />
                </motion.div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-accent' : 'text-muted'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  return (
    <Portal>
      <AnimatePresence>
        {needRefresh && (
          <motion.button
            onClick={() => updateServiceWorker(true)}
            className="fixed inset-x-4 top-0 z-[70] mt-3 rounded-2xl bg-accent px-4 py-3 text-center text-sm font-semibold shadow-xl"
            style={{ marginTop: 'calc(env(safe-area-inset-top) + 12px)' }}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={spring}
          >
            New version available · tap to update
          </motion.button>
        )}
      </AnimatePresence>
    </Portal>
  );
}

function InstallHint() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('installHintDismissed') === '1';
    } catch {
      return false;
    }
  });
  if (standalone || !ios || dismissed) return null;
  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem('installHintDismissed', '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <motion.div className="mx-3 mb-2 rounded-2xl bg-card2 p-3 text-sm ring-1 ring-line" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <div className="flex items-start gap-3">
        <Share size={20} className="mt-0.5 shrink-0 text-accent" />
        <div className="flex-1">
          Install the app: tap <b>Share</b> then <b>Add to Home Screen</b>. It runs full screen and works offline.
        </div>
        <button onClick={close} className="text-muted">
          ✕
        </button>
      </div>
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();
  const isTabRoot = TABS.some((t) => t.to === location.pathname);
  return (
    <div className="flex h-full flex-col">
      <main className="relative min-h-0 flex-1">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<WorkoutTab />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/history/:id/edit" element={<WorkoutEdit />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/:id" element={<ExercisePage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/import/hevy" element={<HevyImport />} />
          <Route path="/routine/new" element={<RoutineEditor />} />
          <Route path="/routine/:id" element={<RoutineEditor />} />
          <Route path="/summary/:id" element={<Summary />} />
          <Route path="*" element={<WorkoutTab />} />
        </Routes>
      </main>
      <div className="relative">
        {isTabRoot && <InstallHint />}
        <MiniWorkoutBar />
        {isTabRoot && <TabBar />}
      </div>
      <ActiveWorkout />
      <RestWatcher />
      <DialogHost />
      <ToastHost />
      <UpdatePrompt />
    </div>
  );
}
