import { AnimatePresence, motion } from 'framer-motion';
import { Dumbbell, Home as HomeIcon, Share, User } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { DialogHost, Portal, spring, ToastHost } from './components/ui';
import { haptic } from './lib/haptics';
import { ActiveWorkout, MiniWorkoutBar, RestWatcher } from './screens/ActiveWorkout';
import { CalendarPage } from './screens/CalendarPage';
import { ExercisePage, Exercises } from './screens/Exercises';
import { Explore } from './screens/Explore';
import { HevyImport } from './screens/HevyImport';
import { Home } from './screens/Home';
import { Measures } from './screens/Measures';
import { Profile } from './screens/Profile';
import { Ranks } from './screens/Ranks';
import { RoutineEditor } from './screens/RoutineEditor';
import { Settings } from './screens/Settings';
import { Statistics } from './screens/Statistics';
import { WatchSetup } from './screens/WatchSetup';
import { Trophies } from './screens/Trophies';
import { Summary, WorkoutDetail, WorkoutEdit } from './screens/WorkoutDetail';
import { WorkoutTab } from './screens/WorkoutTab';

// Same three tabs as Hevy (minus the social feed — Home shows your own workouts).
const TABS = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/profile', label: 'Profile', icon: User },
];

function TabBar() {
  return (
    <nav className="border-t border-line bg-bg/90 pb-safe backdrop-blur-xl">
      <div className="flex">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} replace onClick={() => haptic()} className="relative flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2">
            {({ isActive }) => (
              <>
                {isActive && <motion.div layoutId="tab-bar" className="absolute inset-x-6 top-0 h-[3px] bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <motion.div animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -1 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                  <Icon size={24} className={isActive ? 'text-accent' : 'text-muted'} strokeWidth={isActive ? 2.6 : 2} />
                </motion.div>
                <span className={`font-display text-[10px] font-semibold uppercase tracking-[0.12em] ${isActive ? 'text-white' : 'text-muted'}`}>{label}</span>
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
          <Route path="/" element={<Home />} />
          <Route path="/workout" element={<WorkoutTab />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/history/:id/edit" element={<WorkoutEdit />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/:id" element={<ExercisePage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/measures" element={<Measures />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/ranks" element={<Ranks />} />
          <Route path="/trophies" element={<Trophies />} />
          <Route path="/watch-setup" element={<WatchSetup />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/import/hevy" element={<HevyImport />} />
          <Route path="/routine/new" element={<RoutineEditor />} />
          <Route path="/routine/:id" element={<RoutineEditor />} />
          <Route path="/summary/:id" element={<Summary />} />
          <Route path="*" element={<Home />} />
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
