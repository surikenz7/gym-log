import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Header, Page } from '../components/ui';
import { ACHIEVEMENTS } from '../lib/progress';
import { useJourney } from '../lib/useProgress';

export function Trophies() {
  const j = useJourney();
  const nav = useNavigate();
  const got = j ? ACHIEVEMENTS.filter((a) => j.unlocked.has(a.id)).length : 0;
  return (
    <Page pushed>
      <Header back title="Trophies" />
      <div className="px-4 pb-12">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="label">Unlocked</div>
            <div className="font-display text-4xl font-bold">
              {got}
              <span className="text-xl text-muted"> / {ACHIEVEMENTS.length}</span>
            </div>
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full bg-accent" initial={{ width: 0 }} animate={{ width: `${(got / ACHIEVEMENTS.length) * 100}%` }} transition={{ duration: 0.8 }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ACHIEVEMENTS.map((a, i) => {
            const u = j?.unlocked.get(a.id);
            const cur = j ? Math.min(j.totals[a.metric], a.goal) : 0;
            return (
              <motion.button
                key={a.id}
                onClick={() => u && nav(`/history/${u.workoutId}`)}
                className={`relative flex flex-col items-center cut-sm border p-2.5 text-center ${u ? 'border-warn/40 bg-gradient-to-b from-warn/15 to-card' : 'border-line bg-card'}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i, 18) * 0.02 }}
              >
                <div className={`text-3xl ${u ? '' : 'opacity-25 grayscale'}`}>{a.icon}</div>
                <div className={`mt-1 font-display text-[13px] font-semibold uppercase leading-tight ${u ? 'text-white' : 'text-white/50'}`}>{a.name}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-muted">{a.desc}</div>
                {u ? (
                  <div className="mt-1 text-[10px] font-semibold text-warn">{format(u.date, 'd MMM yyyy')}</div>
                ) : (
                  a.goal > 1 && (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-white/40" style={{ width: `${(cur / a.goal) * 100}%` }} />
                    </div>
                  )
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
