import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardPaste, Flame, Heart, HeartPulse, MoreHorizontal, Watch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { haptic } from '../lib/haptics';
import { parseHealthText, requestText, shortcutUrl } from '../lib/health';
import { toast } from '../state/dialog';
import type { Workout } from '../types';
import { HeartRateChart } from './charts';
import { Button, Sheet, SheetItem } from './ui';

export function WatchCard({ w }: { w: Workout }) {
  const nav = useNavigate();
  const [waiting, setWaiting] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const h = w.health;

  // Coming back from the Shortcuts app: nudge the paste button.
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && waiting && haptic();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [waiting]);

  const request = async () => {
    try {
      await navigator.clipboard.writeText(requestText(w.start, w.end));
    } catch {
      toast('Couldn’t copy the workout time — try again');
      return;
    }
    setWaiting(true);
    window.location.href = shortcutUrl();
  };

  const save = async (text: string) => {
    const health = parseHealthText(text);
    if (!health) {
      toast('No Gym Log data found — run the Shortcut first');
      return false;
    }
    await db.workouts.update(w.id, { health });
    setWaiting(false);
    setManual(null);
    haptic('success');
    toast('❤️ Apple Watch data added');
    return true;
  };

  const paste = async () => {
    try {
      await save(await navigator.clipboard.readText());
    } catch {
      setManual('');
    }
  };

  if (h) {
    const minutes = (w.end - w.start) / 60000;
    return (
      <motion.div className="cut bg-card p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-3 flex items-center gap-2">
          <Watch size={18} className="text-muted" />
          <span className="flex-1 font-semibold">Apple Watch</span>
          <button onClick={() => setMenu(true)} className="press text-muted">
            <MoreHorizontal size={20} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            [<Heart key="a" size={14} />, 'Avg HR', h.avgHr ? `${h.avgHr} bpm` : '–'],
            [<HeartPulse key="m" size={14} />, 'Max HR', h.maxHr ? `${h.maxHr} bpm` : '–'],
            [<Flame key="c" size={14} />, 'Calories', h.calories != null ? `${h.calories} kcal` : '–'],
          ].map(([icon, l, v]) => (
            <div key={l as string}>
              <div className="flex items-center gap-1 text-xs text-muted">
                {icon}
                {l}
              </div>
              <div className="font-semibold">{v}</div>
            </div>
          ))}
        </div>
        {h.hr && h.hr.length > 2 && (
          <div className="mt-3">
            <HeartRateChart hr={h.hr} minutes={minutes} />
          </div>
        )}
        <Sheet open={menu} onClose={() => setMenu(false)} title="Apple Watch data">
          <SheetItem label="Fetch again from Apple Health" onClick={() => (setMenu(false), request())} />
          <SheetItem
            danger
            label="Remove heart rate & calories"
            onClick={async () => {
              setMenu(false);
              await db.workouts.update(w.id, { health: undefined });
            }}
          />
        </Sheet>
      </motion.div>
    );
  }

  return (
    <div className="cut bg-card p-4">
      <div className="flex items-center gap-2">
        <Watch size={18} className="text-muted" />
        <span className="font-semibold">Apple Watch</span>
      </div>
      <div className="mt-1 text-sm text-muted">Add heart rate and calories from Apple Health to this workout.</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" className="!py-2.5 text-sm" onClick={request}>
          <Heart size={16} className="text-rose-500" /> Get from Health
        </Button>
        <Button variant={waiting ? 'primary' : 'secondary'} className="!py-2.5 text-sm" onClick={paste}>
          <ClipboardPaste size={16} /> Paste data
        </Button>
      </div>
      <AnimatePresence>
        {waiting && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-2 text-xs text-muted">After the Shortcut finishes, come back here and tap “Paste data”.</div>
          </motion.div>
        )}
      </AnimatePresence>
      {manual != null && (
        <div className="mt-3 space-y-2">
          <textarea
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            rows={3}
            placeholder="Long-press here and choose Paste"
            className="w-full resize-none rounded-xl bg-card2 p-3 text-sm outline-none placeholder:text-muted"
          />
          <Button className="w-full !py-2.5 text-sm" onClick={() => save(manual)}>
            Save
          </Button>
        </div>
      )}
      <button onClick={() => nav('/watch-setup')} className="mt-3 text-sm font-medium text-accent">
        One-time setup guide →
      </button>
    </div>
  );
}
