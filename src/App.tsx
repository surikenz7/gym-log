import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useSettings } from './state/settings';
import { Share } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Onboarding, useOnboarding, type OnboardingStart } from './screens/Onboarding';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TabPager } from './components/TabPager';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { DialogHost, Portal, spring, ToastHost } from './components/ui';
import { Dock, DOCK_TABS } from './components/Dock';
import { RankSync } from './lib/useProgress';
import { ActiveWorkout, MiniWorkoutBar, RestWatcher } from './screens/ActiveWorkout';
import { useWorkout } from './state/workout';
import { ExercisePage, Exercises } from './screens/Exercises';
import { Home } from './screens/Home';
import { Profile } from './screens/Profile';
import { Levels } from './screens/Levels';
import { Ranks } from './screens/Ranks';
import { Compete } from './screens/Compete';
import { RoutineEditor } from './screens/RoutineEditor';
import { DecoSync } from './screens/Decorations';
import { CloudSync } from './cloud/CloudSync';
import { SocialSync } from './cloud/socialStore';
import { MessageBanner } from './components/MessageBanner';
import { Summary, WorkoutDetail, WorkoutEdit } from './screens/WorkoutDetail';
import { WorkoutTab } from './screens/WorkoutTab';
import { t } from './i18n';
// screens you open now and then are loaded the first time they're needed
const CalendarPage = lazy(() => import('./screens/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const Explore = lazy(() => import('./screens/Explore').then((m) => ({ default: m.Explore })));
const HevyImport = lazy(() => import('./screens/HevyImport').then((m) => ({ default: m.HevyImport })));
const Measures = lazy(() => import('./screens/Measures').then((m) => ({ default: m.Measures })));
const Statistics = lazy(() => import('./screens/Statistics').then((m) => ({ default: m.Statistics })));
const Trophies = lazy(() => import('./screens/Trophies').then((m) => ({ default: m.Trophies })));
const Decorations = lazy(() => import('./screens/Decorations').then((m) => ({ default: m.Decorations })));
const Social = lazy(() => import('./screens/SocialHub').then((m) => ({ default: m.Social })));
const FriendProfile = lazy(() => import('./screens/SocialHub').then((m) => ({ default: m.FriendProfile })));
const FriendWorkout = lazy(() => import('./screens/SocialHub').then((m) => ({ default: m.FriendWorkout })));
const Chat = lazy(() => import('./screens/SocialHub').then((m) => ({ default: m.Chat })));
const SharedRoutine = lazy(() => import('./screens/SharedRoutine').then((m) => ({ default: m.SharedRoutine })));
const StoryEditor = lazy(() => import('./screens/StoryEditor').then((m) => ({ default: m.StoryEditor })));
const StoryViewer = lazy(() => import('./screens/StoryViewer').then((m) => ({ default: m.StoryViewer })));
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })));


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
            {t('New version available · tap to update')}
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
          Install the app: tap <b>{t('Share')}</b> then <b>{t('Add to Home Screen')}</b>. It runs full screen and works offline.
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
  const reduceMotion = useSettings((s) => !!s.reduceMotion);
  const needsOnboarding = useOnboarding();
  const [onboarding, setOnboarding] = useState<OnboardingStart | null>(null);
  useEffect(() => {
    // once open, the flow stays until it's finished (signing up mid-way doesn't close it)
    if (needsOnboarding) setOnboarding((o) => o ?? needsOnboarding);
  }, [needsOnboarding]);
  // Dock / pages stay underneath; the flow covers them until it's finished
  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'never'}>
    <div className={`relative flex h-full flex-col ${isTabRoot ? 'has-dock' : ''} ${miniBar ? 'has-mini' : ''}`}>
      <main className="relative min-h-0 flex-1">
        {isTabRoot && <div className="top-fade" />}
        <TabPager index={lastTab.current} pages={[<Home key="home" />, <WorkoutTab key="workout" />, <Compete key="compete" />, <Profile key="profile" />]} />
        {!isTabRoot && (
          <div className="absolute inset-0 z-10 bg-bg">
            <Suspense fallback={null}>
            <Routes location={location} key={location.pathname}>
          <Route path="/explore" element={<Explore />} />
          <Route path="/ranks" element={<Ranks />} />
          <Route path="/levels" element={<Levels />} />
          <Route path="/history/:id" element={<WorkoutDetail />} />
          <Route path="/history/:id/edit" element={<WorkoutEdit />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/exercises/:id" element={<ExercisePage />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/measures" element={<Measures />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/trophies" element={<Trophies />} />
          <Route path="/decorations" element={<Decorations />} />
          <Route path="/friends" element={<Navigate to="/social" replace />} />
          <Route path="/social" element={<Social />} />
          <Route path="/u/:uid" element={<FriendProfile />} />
          <Route path="/u/:uid/w/:wid" element={<FriendWorkout />} />
          <Route path="/chat/:uid" element={<Chat />} />
          <Route path="/story/new" element={<StoryEditor />} />
          <Route path="/stories/:uid" element={<StoryViewer />} />
          <Route path="/r/:code" element={<SharedRoutine />} />
          <Route path="/r/:slug/:code" element={<SharedRoutine />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/import/hevy" element={<HevyImport />} />
          <Route path="/routine/new" element={<RoutineEditor />} />
          <Route path="/routine/:id" element={<RoutineEditor />} />
          <Route path="/summary/:id" element={<Summary />} />
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
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
      <AnimatePresence>{onboarding && <Onboarding key={onboarding} start={onboarding} onDone={() => setOnboarding(null)} />}</AnimatePresence>
      <CloudSync />
      <SocialSync />
      <MessageBanner />
      <DialogHost />
      <ToastHost />
      <UpdatePrompt />
    </div>
    </MotionConfig>
  );
}
