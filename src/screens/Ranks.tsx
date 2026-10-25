import { motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExerciseThumb } from '../components/ExerciseImage';
import { RankBadge, Rays, TierBar, TierName } from '../components/RankBadge';
import { RankSetup } from '../components/RankParts';
import { Header, Page, Sheet } from '../components/ui';
import { getExercise } from '../lib/exercises';
import { GROUPS, LEVEL_NAMES, STANDARDS, TIERS, tierIndex } from '../lib/ranks';
import { useRanks } from '../lib/useProgress';

export function Ranks() {
  const nav = useNavigate();
  const { ctx, data } = useRanks();
  const [edit, setEdit] = useState(false);
  const overall = data?.overall ?? null;
  const ranked = data ? [...data.exercises.values()].sort((a, b) => b.score - a.score) : [];
  const tier = overall != null ? TIERS[tierIndex(overall)] : null;
  const next = overall != null ? TIERS[tierIndex(overall) + 1] : null;

  return (
    <Page pushed>
      <Header
        back
        title="Ranks"
        right={
          ctx && (
            <button onClick={() => setEdit(true)} className="press text-accent">
              <SlidersHorizontal size={21} />
            </button>
          )
        }
      />
      <div className="px-4 pb-12">
        {ctx === null && <RankSetup />}

        {data && (
          <>
            <div className="relative flex flex-col items-center overflow-hidden pb-2 pt-4">
              {tier && <Rays color={tier.c[1]} size={340} />}
              <motion.div initial={{ scale: 0.3, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 13 }}>
                <RankBadge score={overall} size={150} />
              </motion.div>
              <div className="label mt-3">Overall rank</div>
              <TierName score={overall} className="text-5xl leading-tight" />
              {overall != null ? (
                <>
                  <div className="font-display text-lg text-muted">
                    <span className="text-white">{overall}</span> / 1000
                  </div>
                  <TierBar score={overall} className="mt-2 w-56" />
                  {next && (
                    <div className="mt-1.5 text-xs text-muted">
                      {next.min - overall} points to <span style={{ color: next.c[1] }}>{next.name}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-1 max-w-[260px] text-center text-sm text-muted">Get ranked in at least 3 muscle groups to unlock your overall rank.</div>
              )}
            </div>

            <div className="label mb-2 mt-6">Muscle groups</div>
            <div className="grid grid-cols-2 gap-2">
              {data.groups.map((g, i) => {
                const label = GROUPS.find((x) => x.id === g.group)!.label;
                return (
                  <motion.button
                    key={g.group}
                    onClick={() => g.exerciseId && nav(`/exercises/${g.exerciseId}`)}
                    className="press flex items-center gap-3 rounded-xl border border-line bg-card p-3 text-left"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                  >
                    <RankBadge score={g.score || null} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-semibold tracking-wide text-white/90">{label}</div>
                      <TierName score={g.score || null} className="text-base leading-tight" />
                      <div className="truncate text-[11px] text-muted">{g.exerciseId ? `${g.score} · ${getExercise(g.exerciseId).name}` : 'Not ranked yet'}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="label mb-2 mt-6">Your lifts</div>
            {ranked.length === 0 && <div className="rounded-xl bg-card p-5 text-center text-sm text-muted">Log a ranked exercise (bench, squat, deadlift, rows, curls…) to get your first rank.</div>}
            <div className="space-y-1.5">
              {ranked.map((r, i) => {
                const ex = getExercise(r.exerciseId);
                return (
                  <motion.button
                    key={r.exerciseId}
                    onClick={() => nav(`/exercises/${r.exerciseId}`)}
                    className="press flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.03 }}
                  >
                    <span className="w-5 text-center font-display text-sm text-muted">{i + 1}</span>
                    <ExerciseThumb ex={ex} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{ex.name}</div>
                      <TierBar score={r.score} className="mt-1.5" />
                    </div>
                    <div className="text-right">
                      <TierName score={r.score} className="block text-sm leading-tight" />
                      <span className="font-display text-xs text-muted">{r.score}</span>
                    </div>
                    <RankBadge score={r.score} size={34} shine={false} />
                  </motion.button>
                );
              })}
            </div>

            <div className="label mb-2 mt-8">How ranks work</div>
            <div className="rounded-xl border border-line bg-card p-4 text-sm text-white/80">
              <p>
                Every working set gets a score from 0 to 1000 based on your estimated one-rep max (Epley) compared with your bodyweight and sex. Each exercise is ranked by its best
                set; warm-ups and sets over 30 reps don’t count. A muscle group takes its best exercise, and your overall rank averages your ranked groups.
              </p>
              <p className="mt-2 text-muted">
                Standards are based on public strength standards ({LEVEL_NAMES.slice(1, 6).join(' → ').toLowerCase()}) — {Object.keys(STANDARDS).length} exercises are ranked.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {TIERS.map((t) => (
                  <div key={t.name} className="flex flex-col items-center rounded-lg bg-card2 py-2">
                    <RankBadge score={t.min} size={40} shine={false} />
                    <div className="mt-1 font-display text-xs font-semibold" style={{ color: t.c[1] }}>
                      {t.name}
                    </div>
                    <div className="text-[10px] text-muted">{t.min === 900 ? '900+' : `${t.min}–${t.min === 0 ? 199 : t.min + 99}`}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <Sheet open={edit} onClose={() => setEdit(false)} title="Sex & bodyweight">
        <div className="px-4 pt-2">
          <RankSetup compact onDone={() => setEdit(false)} />
        </div>
      </Sheet>
    </Page>
  );
}
