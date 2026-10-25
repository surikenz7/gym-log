import { AnimatePresence, motion } from 'framer-motion';
import { Share } from 'lucide-react';
import { useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TabPager } from './components/TabPager';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { DialogHost, Portal, spring, ToastHost } from './components/ui';
import { Dock, DOCK_TABS } from './components/Dock';
import { RankSync } from './lib/useProgress';
import { ActiveWorkout, MiniWorkoutBar, RestWatcher } from './screens/ActiveWorkout';
import { useWorkout } from './state/workout';
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
import { Trophies } from './screens/Trophies';
import { DecoSync, Decorations } from './screens/Decorations';
import { Summary, WorkoutDetail, WorkoutEdit } from './screens/WorkoutDetail';
import { WorkoutTab } from './screens/WorkoutTab';

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
            className="fixed inset-x-4 top-0 z-[70] mt-3 cut grad px-4 py-3 text-center text-sm font-semibold shadow-xl"
            style={{ marginTop: 'calc(var(--sat) + 12px)' }}
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
    <motion.div className="mx-3 mb-2 cut bg-card2 p-3 text-sm ring-1 ring-line" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
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
  const tabIndex = DOCK_TABS.findIndex((t) => t.to === location.pathname);
  const isTabRoot = tabIndex >= 0;
  // while a pushed page is open the tab strip stays where it was, underneath
  const lastTab = useRef(Math.max(0, tabIndex));
  if (isTabRoot) lastTab.current = tabIndex;
  const miniBar = useWorkout((s) => !!s.active && !s.open);
  return (
    <div className={`relative flex h-full flex-col ${isTabRoot ? 'has-dock' : ''} ${miniBar ? 'has-mini' : ''}`}>
      <main className="relative min-h-0 flex-1">
        <TabPager index={lastTab.current} pages={[<Home key="home" />, <WorkoutTab key="workout" />, <Ranks key="ranks" />, <Profile key="profile" />]} />
        {!isTabRoot && (
          <div className="absolute inset-0 z-10 bg-bg">
            <Routes location={location} key={location.pathname}>
          <Route path="/explore" element={<Explore />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/history/:id/edit" element={<WorkoutEdit />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/:id" element={<ExercisePage />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/measures" element={<Measures />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/trophies" element={<Trophies />} />
          <Route path="/decorations" element={<Decorations />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/import/hevy" element={<HevyImport />} />
          <Route path="/routine/new" element={<RoutineEditor />} />
          <Route path="/routine/:id" element={<RoutineEditor />} />
          <Route path="/summary/:id" element={<Summary />} />
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        )}
      </main>
      {/* floats over the page so content scrolls behind the glass */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
        <div className="pointer-events-auto">
          {isTabRoot && <InstallHint />}
          <MiniWorkoutBar />
          {isTabRoot && <Dock />}
        </div>
      </div>
      <ActiveWorkout />
      <RestWatcher />
      <RankSync />
      <DecoSync />
      <DialogHost />
      <ToastHost />
      <UpdatePrompt />
    </div>
  );
}
