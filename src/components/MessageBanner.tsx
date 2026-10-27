import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBanner } from '../cloud/socialStore';
import { haptic } from '../lib/haptics';
import { beepMessage } from '../lib/sound';
import { Portal } from './ui';
import { Avatar } from './WorkoutFeed';

/** iOS-style banner that slides down when a message arrives while the app is open. */
export function MessageBanner() {
  const banner = useBanner((s) => s.banner);
  const nav = useNavigate();
  useEffect(() => {
    if (!banner) return;
    haptic('success');
    beepMessage();
    const timer = setTimeout(() => useBanner.setState({ banner: null }), 4500);
    return () => clearTimeout(timer);
  }, [banner?.key]);
  return (
    <Portal>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[75] px-3" style={{ paddingTop: 'calc(var(--sat) + 8px)' }}>
        <AnimatePresence>
          {banner && (
            <motion.button
              key={banner.key}
              className="glass pointer-events-auto relative flex w-full items-center gap-3 rounded-3xl px-3 py-2.5 text-left"
              initial={{ y: -120, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -120, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={(_, i) => i.offset.y < -30 && useBanner.setState({ banner: null })}
              onClick={() => {
                useBanner.setState({ banner: null });
                nav(`/chat/${banner.uid}`);
              }}
            >
              <Avatar size={40} src={banner.avatar ?? null} initial={banner.nick} deco={null} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">@{banner.nick}</div>
                <div className="truncate text-sm text-white/80">{banner.text}</div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  );
}
