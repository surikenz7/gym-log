import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { useAccount } from '../cloud/account';
import { db } from '../db/db';
import { Check, Gift, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/WorkoutFeed';
import { Header, Page } from '../components/ui';
import { DECORATIONS, decoById, earnedDecorations, fmtPct, HISTORY_BASED, rarityOf, redeemCode, type Decoration } from '../lib/decorations';
import { typeOf } from '../lib/exercises';
import { computeJourney } from '../lib/progress';
import { haptic } from '../lib/haptics';
import { useAllWorkouts } from '../lib/hooks';
import { fanfare } from '../lib/sound';
import { useJourney, useRanks } from '../lib/useProgress';
import { toast } from '../state/dialog';
import { useSettings } from '../state/settings';

/** Removes history-based decorations that the (cleaned-up) history no longer earns. */
export async function revokeHistoryDecorations() {
  const workouts = await db.workouts.toArray();
  const earned = new Set(earnedDecorations(computeJourney(workouts, typeOf), workouts, null));
  const s = useSettings.getState();
  const keep = (s.decos ?? []).filter((id) => !HISTORY_BASED.has(id) || earned.has(id));
  if (keep.length === (s.decos ?? []).length) return;
  s.update({ decos: keep, deco: s.deco && keep.includes(s.deco) ? s.deco : null });
}

export function unlockDecoration(id: string) {
  const s = useSettings.getState();
  const have = s.decos ?? [];
  if (have.includes(id)) return false;
  s.update({ decos: [...have, id] });
  return true;
}

/** Keeps the unlocked list in step with history and ranks, and celebrates new unlocks. */
export function DecoSync() {
  const journey = useJourney();
  const workouts = useAllWorkouts();
  const { data, loading, ctx } = useRanks();
  const settings = useSettings();
  const routines = useLiveQuery(() => db.routines.count(), []);
  const measures = useLiveQuery(() => db.measures.count(), []);
  const account = useAccount((a) => a.status === 'signedIn');
  const following = useAccount((a) => a.following.length);
  const first = useRef(true);
  useEffect(() => {
    if (!journey || !workouts || loading || routines === undefined || measures === undefined) return;
    const s = useSettings.getState();
    const have = new Set(s.decos ?? []);
    const extras = { name: !!s.name.trim(), avatar: !!s.avatar, routines, measures, ranked: !!ctx, account, following, shared: !!s.shared };
    const fresh = earnedDecorations(journey, workouts, data?.overall ?? null, extras).filter((id) => !have.has(id));
    const firstRun = first.current;
    first.current = false;
    if (!fresh.length) return;
    s.update({ decos: [...have, ...fresh] });
    // stay quiet during the welcome flow and while an account's history is being restored
    const acct = useAccount.getState();
    if (!s.onboarded || (acct.status === 'signedIn' && (acct.syncing || !acct.lastSync))) return;
    if (firstRun && s.decos === undefined) {
      toast(`🎁 ${fresh.length} avatar decoration${fresh.length === 1 ? '' : 's'} unlocked — Settings → Decorations`);
      return;
    }
    haptic('success');
    fanfare();
    toast(`🎁 New decoration: ${fresh.map((id) => decoById(id)?.name).join(', ')}`);
  }, [journey, workouts, data?.overall, loading, ctx, routines, measures, account, following, settings.name, settings.avatar, settings.shared]);
  return null;
}

function Card({ d, unlocked, equipped, onTap, i }: { d: Decoration; unlocked: boolean; equipped: boolean; onTap: () => void; i: number }) {
  const r = rarityOf(d.pct);
  const secret = !unlocked && (d.kind === 'egg' || d.kind === 'code');
  return (
    <motion.button
      onClick={onTap}
      className="press cut-sm relative flex flex-col items-center bg-card px-2 pb-2.5 pt-4 text-center"
      style={{ boxShadow: equipped ? 'inset 0 0 0 2px rgb(var(--accent))' : `inset 0 0 0 1px ${unlocked ? r.color + '55' : 'rgb(var(--line))'}` }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 12) * 0.025 }}
    >
      <div className={unlocked ? '' : 'opacity-35 grayscale'}>
        <Avatar size={52} deco={d.id} />
      </div>
      {!unlocked && (
        <span className="absolute right-2 top-2 text-muted">
          <Lock size={13} />
        </span>
      )}
      {equipped && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
          <Check size={12} strokeWidth={4} />
        </span>
      )}
      <div className="mt-4 text-[13px] font-semibold leading-tight">{secret ? '???' : d.name}</div>
      <div className="mt-0.5 text-[10px] leading-tight text-muted">{secret ? d.hint : d.how}</div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold" style={{ color: r.color }}>
        {r.label} · {fmtPct(d.pct)}
      </div>
    </motion.button>
  );
}

export function Decorations() {
  const s = useSettings();
  const unlocked = new Set(s.decos ?? []);
  const [code, setCode] = useState('');
  const sorted = [...DECORATIONS].sort((a, b) => Number(unlocked.has(b.id)) - Number(unlocked.has(a.id)) || b.pct - a.pct);

  const redeem = async () => {
    const id = await redeemCode(code);
    if (!id) {
      haptic();
      return toast('That code doesn’t work');
    }
    setCode('');
    if (!unlockDecoration(id)) return toast(`You already have ${decoById(id)!.name}`);
    haptic('success');
    fanfare(true);
    s.update({ deco: id });
    toast(`🔓 Unlocked & equipped: ${decoById(id)!.name}`);
  };

  const tap = (d: Decoration) => {
    if (!unlocked.has(d.id)) return toast(d.kind === 'code' ? 'Unlock it with a secret code' : d.kind === 'egg' ? `Hint: ${d.hint}` : `Locked — ${d.how}`);
    haptic();
    s.update({ deco: s.deco === d.id ? null : d.id });
  };

  const current = s.deco ? decoById(s.deco) : null;
  return (
    <Page pushed>
      <Header back title="Decorations" />
      <div className="px-4 pb-12">
        <div className="flex flex-col items-center pb-2 pt-10">
          <motion.div key={s.deco ?? 'none'} initial={{ scale: 0.85, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}>
            <Avatar size={112} />
          </motion.div>
          <div className="mt-7 font-display text-xl font-bold">{current ? current.name : 'No decoration'}</div>
          {current && (
            <div className="text-xs font-semibold" style={{ color: rarityOf(current.pct).color }}>
              {rarityOf(current.pct).label} · only ~{fmtPct(current.pct)} of lifters
            </div>
          )}
          <div className="mt-1 text-sm text-muted">
            {unlocked.size} / {DECORATIONS.length} unlocked
          </div>
        </div>

        <div className="cut mt-4 flex items-center gap-2 bg-card p-2 pl-4">
          <Gift size={18} className="shrink-0 text-accent" />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void redeem()}
            placeholder="Secret code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2 uppercase tracking-widest outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-muted"
          />
          <button onClick={() => void redeem()} className="press grad rounded-lg px-4 py-2 text-sm font-bold">
            Redeem
          </button>
        </div>

        <div className="mt-2 px-1 text-[11px] leading-snug text-muted">
          Percentages estimate how many lifters ever earn each decoration — they’re not live counts. Rank decorations stay yours even if your rank drops later.
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {sorted.map((d, i) => (
            <Card key={d.id} d={d} i={i} unlocked={unlocked.has(d.id)} equipped={s.deco === d.id} onTap={() => tap(d)} />
          ))}
        </div>
      </div>
    </Page>
  );
}
