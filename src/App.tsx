import { AnimatePresence, motion } from 'framer-motion';
import { Share, Smartphone } from 'lucide-react';
import { useRef, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { haptic } from './lib/haptics';
import { tabNav } from './lib/tabNav';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { DialogHost, Portal, spring, ToastHost } from './components/ui';
import { Dock, DOCK_TABS } from './components/Dock';
import { RankSync } from './lib/useProgress';
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
import { Trophies } from './screens/Trophies';
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

/** Shown instead of the app when the phone is turned sideways (iOS doesn't let web apps lock rotation). */
function RotateLock() {
  return (
    <div className="rotate-lock fixed inset-0 z-[95] flex-col items-center justify-center gap-4 bg-bg text-center">
      <motion.div animate={{ rotate: [-90, -90, 0, 0] }} transition={{ duration: 2.2, times: [0, 0.3, 0.6, 1], repeat: Infinity }}>
        <Smartphone size={56} className="text-accent" />
      </motion.div>
      <div className="font-display text-2xl font-bold uppercase">Turn your phone upright</div>
    </div>
  );
}

/** Horizontal swipe on a tab page moves to the neighbouring tab; the page follows the finger a little. */
function useTabSwipe(index: number) {
  const nav = useNavigate();
  const main = useRef<HTMLElement>(null);
  const touch = useRef<{ x: number; y: number; t: number; lock?: 'x' | 'y' } | null>(null);
  const setX = (x: number, animate = false) => {
    const el = main.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.25s cubic-bezier(.2,.8,.2,1)' : '';
    el.style.transform = x ? `translateX(${x}px)` : '';
  };
  return {
    ref: main,
    onTouchStart: (e: React.TouchEvent) => {
      const target = e.target as HTMLElement;
      if (index < 0 || e.touches.length > 1 || target.closest('input, textarea, select, .overflow-x-auto, .recharts-wrapper, [data-no-swipe]')) {
        touch.current = null;
        return;
      }
      touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = touch.current;
      if (!s) return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;
      if (!s.lock && Math.hypot(dx, dy) > 10) s.lock = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'x' : 'y';
      if (s.lock !== 'x') return;
      const edge = (dx > 0 && index === 0) || (dx < 0 && index === DOCK_TABS.length - 1);
      setX(dx * (edge ? 0.12 : 0.35));
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = touch.current;
      touch.current = null;
      if (!s || s.lock !== 'x') return;
      const dx = e.changedTouches[0].clientX - s.x;
      const fast = Math.abs(dx) / Math.max(1, Date.now() - s.t) > 0.5;
      const dir = dx < 0 ? 1 : -1;
      const next = DOCK_TABS[index + dir];
      if (next && (Math.abs(dx) > 80 || (fast && Math.abs(dx) > 35))) {
        setX(0);
        tabNav.dir = dir;
        haptic();
        nav(next.to, { replace: true });
      } else setX(0, true);
    },
  };
}

export default function App() {
  const location = useLocation();
  const tabIndex = DOCK_TABS.findIndex((t) => t.to === location.pathname);
  const isTabRoot = tabIndex >= 0;
  const swipe = useTabSwipe(tabIndex);
  return (
    <div className="flex h-full flex-col">
      <RotateLock />
      <main className="relative min-h-0 flex-1" {...swipe}>
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
        {isTabRoot && <Dock />}
      </div>
      <ActiveWorkout />
      <RestWatcher />
      <RankSync />
      <DialogHost />
      <ToastHost />
      <UpdatePrompt />
    </div>
  );
}
