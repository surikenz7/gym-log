import { format, parse, subMonths } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, Info, MessageCircle, Scale, Swords, UserPlus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccount } from '../cloud/account';
import type { PublicProfile, Quest } from '../cloud/social';
import { useBadges, useSocial } from '../cloud/socialStore';
import { RankBadge, TierName } from '../components/RankBadge';
import { Avatar } from '../components/WorkoutFeed';
import { Header, Page, Sheet } from '../components/ui';
import { t } from '../i18n';
import {
  averageWeek,
  daysLeft,
  fairness,
  leagueSummary,
  monthId,
  monthlyBadges,
  monthlyChallenge,
  questGoal,
  questKindOf,
  statsOf,
  weekId,
  weeklyChallenges,
  type Challenge,
  type PeriodStats,
  type QuestKind,
} from '../lib/compete';
import { getExercise, typeOf } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { useAllWorkouts } from '../lib/hooks';
import { fanfare } from '../lib/sound';
import { prCounts } from '../lib/stats';
import { compact, kgTo } from '../lib/units';
import { useLatestBodyweight, useRanks } from '../lib/useProgress';
import { tierOf } from '../lib/ranks';
import { confirmDialog, toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import type { Settings, Workout } from '../types';

const social = () => import('../cloud/social');
const muscleOf = (id: string) => getExercise(id).muscle;
const meRef = () => {
  const a = useAccount.getState();
  return { uid: a.uid!, nick: a.nick ?? '', avatar: useSettings.getState().avatar ?? null };
};
const vol = (kg: number, s: Settings) => `${compact(kgTo(kg, s.weightUnit))} ${s.weightUnit}`;

/* ------------------------------------------------------------------ medals */

const MEDAL = {
  gold: ['#fff3b0', '#f2b705', '#9a6200'],
  silver: ['#ffffff', '#b8c2cc', '#5b6672'],
  bronze: ['#ffd7b0', '#c27a3a', '#6e3a12'],
  quest: ['#c7d2fe', '#4f46e5', '#1e1b4b'],
} as const;
export type MedalKind = keyof typeof MEDAL;

/** Round medal on a ribbon with the month on it. */
export function MonthBadge({ m, kind, size = 64, locked }: { m: string; kind: MedalKind; size?: number; locked?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [a, b, c] = MEDAL[kind];
  const d = parse(m, 'yyyy-MM', new Date());
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 80 100" style={locked ? { filter: 'grayscale(1)', opacity: 0.35 } : undefined}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset=".5" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      </defs>
      <path d="M22 0 L36 34 L44 34 L30 0 Z" fill={kind === 'quest' ? '#4f46e5' : '#2563eb'} />
      <path d="M58 0 L44 34 L36 34 L50 0 Z" fill={kind === 'quest' ? '#a5b4fc' : '#e5262d'} />
      <circle cx="40" cy="62" r="32" fill={`url(#g${id})`} stroke={c} strokeWidth="2.5" />
      <circle cx="40" cy="62" r="25" fill="none" stroke="#ffffff70" strokeWidth="1.5" />
      <text x="40" y="61" textAnchor="middle" fontSize="15" fontWeight="900" fill={c} fontFamily="system-ui, sans-serif">
        {kind === 'gold' ? '1ST' : kind === 'silver' ? '2ND' : kind === 'bronze' ? '3RD' : '★'}
      </text>
      <text x="40" y="78" textAnchor="middle" fontSize="11" fontWeight="800" fill={c} fontFamily="system-ui, sans-serif">
        {format(d, 'MMM yy').toUpperCase()}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ challenges */

function challengeText(c: Challenge, s: Settings) {
  switch (c.kind) {
    case 'sessions':
      return t('Train {n} times', { n: c.target });
    case 'volume':
      return t('Lift {v} in total', { v: vol(c.target, s) });
    case 'sets':
      return t('Complete {n} working sets', { n: c.target });
    case 'weekend':
      return t('Train on the weekend');
    case 'pr':
      return c.target === 1 ? t('Set a personal record') : t('Set {n} personal records', { n: c.target });
    case 'legs':
      return c.target === 1 ? t('Train legs') : t('Train legs {n} times', { n: c.target });
    case 'minutes':
      return t('Train for {n} minutes', { n: c.target });
    case 'exercises':
      return t('Do {n} different exercises', { n: c.target });
    case 'weeks':
      return t('Train every week of the month');
  }
}
const ICON: Record<Challenge['kind'], string> = { sessions: '🏋️', volume: '🧱', sets: '🔁', weekend: '☀️', pr: '⚡', legs: '🦵', minutes: '⏱️', exercises: '🎯', weeks: '📅' };
const shown = (c: Challenge, s: Settings) => (c.kind === 'volume' ? `${vol(Math.min(c.value, c.target), s)} / ${vol(c.target, s)}` : `${Math.min(c.value, c.target)} / ${c.target}`);

function Bar({ value, target, color = 'grad' }: { value: number; target: number; color?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (value / Math.max(1, target)) * 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
    </div>
  );
}

function ChallengeRow({ c, s, i }: { c: Challenge; s: Settings; i: number }) {
  const done = c.value >= c.target;
  return (
    <motion.div className="flex items-center gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${done ? 'grad' : 'bg-card2'}`}>{done ? <Check size={22} strokeWidth={3} /> : ICON[c.kind]}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-[15px] font-semibold ${done ? 'text-muted line-through' : ''}`}>{challengeText(c, s)}</span>
          <span className="shrink-0 font-display text-xs font-semibold text-muted">{shown(c, s)}</span>
        </div>
        <div className="mt-1.5">
          <Bar value={c.value} target={c.target} />
        </div>
      </div>
    </motion.div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="label flex items-center gap-2">
        <span className="h-3 w-1 bg-accent" /> {children}
      </div>
      {right && <div className="text-xs text-muted">{right}</div>}
    </div>
  );
}

function WeeklyChallenges({ list, s }: { list: Challenge[]; s: Settings }) {
  const done = list.filter((c) => c.value >= c.target).length;
  const left = daysLeft('week');
  return (
    <div className="cut bg-card p-4">
      <SectionTitle right={t('{n} days left', { n: left })}>{t('Weekly challenges')}</SectionTitle>
      <div className="space-y-3.5">
        {list.map((c, i) => (
          <ChallengeRow key={c.kind} c={c} s={s} i={i} />
        ))}
      </div>
      <div className={`mt-4 rounded-xl px-3 py-2 text-center text-sm font-semibold ${done === list.length ? 'grad' : 'bg-card2 text-muted'}`}>
        {done === list.length ? t('All done this week — beast! 🔥') : t('{done} of {n} done', { done, n: list.length })}
      </div>
    </div>
  );
}

function MonthlyCard({ c, s }: { c: Challenge; s: Settings }) {
  const done = c.value >= c.target;
  return (
    <div className="cut relative overflow-hidden bg-card p-4">
      <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 85% 30%, #6366f1, transparent 60%)' }} />
      <div className="relative">
        <SectionTitle right={t('{n} days left', { n: daysLeft('month') })}>{t('Monthly challenge')}</SectionTitle>
        <div className="flex items-center gap-4">
          <motion.div animate={done ? { rotate: [0, -8, 8, 0] } : {}} transition={{ duration: 0.8 }}>
            <MonthBadge m={monthId(new Date())} kind="quest" size={64} locked={!done} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-xl font-bold uppercase leading-tight">{challengeText(c, s)}</div>
            <div className="mt-0.5 text-xs text-muted">{done ? t('Badge earned!') : t('Finish it to earn this month’s badge')}</div>
            <div className="mt-2">
              <Bar value={c.value} target={c.target} color="bg-indigo-500" />
            </div>
            <div className="mt-1 text-right font-display text-xs text-muted">{shown(c, s)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ friends */

/** Profiles of everyone you follow or who follows you, refreshed whenever this tab is opened. */
function useLeagueFriends(active: boolean) {
  const uid = useAccount((a) => a.uid);
  const following = useAccount((a) => a.following);
  const followers = useSocial((s) => s.followers);
  const [list, setList] = useState<PublicProfile[] | null>(null);
  const ids = [...new Set([...following, ...followers.filter((f) => f.status === 'accepted').map((f) => f.uid)])].filter((x) => x !== uid);
  const key = ids.sort().join();
  useEffect(() => {
    if (!uid || !active) return;
    void social().then((s) => s.getProfiles(ids).then(setList));
  }, [uid, key, active]);
  return list;
}

const QUEST_TEXT = (kind: QuestKind, goal: number, s: Settings) =>
  kind === 'sessions' ? t('Train {n} times together', { n: goal }) : kind === 'sets' ? t('Complete {n} sets together', { n: goal }) : t('Lift {v} together', { v: vol(goal, s) });
const pick = (kind: QuestKind, p: Pick<PeriodStats, 'n' | 's' | 'v'> | null) => (p ? (kind === 'sessions' ? p.n : kind === 'sets' ? p.s : p.v) : 0);

function FriendsQuest({ friends, mine, workouts, s }: { friends: PublicProfile[] | null; mine: PeriodStats; workouts: Workout[]; s: Settings }) {
  const uid = useAccount((a) => a.uid)!;
  const week = weekId(new Date());
  const quest = useSocial((st) => st.quests.find((q) => q.week === week));
  const [picker, setPicker] = useState(false);
  const nav = useNavigate();

  const start = async (p: PublicProfile) => {
    setPicker(false);
    const kind = questKindOf(week);
    try {
      await (await social()).startQuest(meRef(), p, week, kind, questGoal(kind, averageWeek(workouts, typeOf)));
      haptic('success');
      toast(t('Quest started with @{nick}', { nick: p.nick }));
    } catch {
      toast(t('No internet connection'));
    }
  };

  if (!quest)
    return (
      <div className="cut relative overflow-hidden bg-card p-4">
        <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at 15% 20%, #38bdf8, transparent 55%), radial-gradient(circle at 90% 90%, #f97316, transparent 55%)' }} />
        <div className="relative">
          <SectionTitle>{t('Friends Quest')}</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="text-5xl">🤝</div>
            <div className="text-sm text-white/85">{t('Team up with a friend: one shared goal for the week. Finish it together to earn the Dynamic Duo decoration.')}</div>
          </div>
          <button onClick={() => (friends?.length ? setPicker(true) : nav('/social?tab=friends'))} className="press cut-sm grad mt-4 w-full py-3 font-display font-bold uppercase tracking-wider">
            {friends?.length ? t('Start a quest') : t('Find friends first')}
          </button>
        </div>
        <Sheet open={picker} onClose={() => setPicker(false)} title={t('Pick your partner')}>
          <div className="space-y-1.5 px-4 pt-2">
            {(friends ?? []).map((p) => (
              <button key={p.uid} onClick={() => void start(p)} className="press cut-sm flex w-full items-center gap-3 bg-card2 p-2.5 text-left">
                <div className="p-1">
                  <Avatar size={40} src={p.avatar ?? null} initial={p.nick} deco={p.deco ?? null} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">@{p.nick}</div>
                  <div className="text-xs text-muted">{t('{n} sessions this week', { n: statsOf(p, week)?.n ?? 0 })}</div>
                </div>
                <ChevronRight size={18} className="text-muted" />
              </button>
            ))}
          </div>
        </Sheet>
      </div>
    );
  return <ActiveQuest q={quest} uid={uid} friends={friends} mine={mine} s={s} />;
}

function ActiveQuest({ q, uid, friends, mine, s }: { q: Quest; uid: string; friends: PublicProfile[] | null; mine: PeriodStats; s: Settings }) {
  const other = q.members.find((m) => m !== uid)!;
  const p = friends?.find((f) => f.uid === other);
  const a = pick(q.kind, mine);
  const b = pick(q.kind, p ? statsOf(p, q.week) : null);
  const done = a + b >= q.goal;
  useEffect(() => {
    if (done && !q.done && p) {
      void social().then((so) => so.finishQuest(q.id));
      haptic('success');
      fanfare();
    }
  }, [done, q.done, !!p]);
  const fmt = (x: number) => (q.kind === 'volume' ? vol(x, s) : String(x));
  const leave = async () => {
    if (await confirmDialog(t('Leave the quest?'), t('You can start a new one with someone else.'), t('Leave'), true)) await (await social()).leaveQuest(q.id);
  };
  return (
    <div className="cut relative overflow-hidden bg-card p-4">
      <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at 10% 10%, rgb(var(--accent)), transparent 55%), radial-gradient(circle at 95% 95%, #38bdf8, transparent 55%)' }} />
      <div className="relative">
        <SectionTitle
          right={
            !done ? (
              <button onClick={leave} className="flex items-center gap-1">
                {t('{n} days left', { n: daysLeft('week') })} <X size={14} />
              </button>
            ) : undefined
          }
        >
          {t('Friends Quest')}
        </SectionTitle>
        <div className="font-display text-xl font-bold uppercase leading-tight">{QUEST_TEXT(q.kind, q.goal, s)}</div>
        <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-white/10">
          <motion.div className="grad h-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (a / q.goal) * 100)}%` }} transition={{ duration: 0.8 }} />
          <motion.div className="h-full bg-sky-400" initial={{ width: 0 }} animate={{ width: `${Math.min(100 - Math.min(100, (a / q.goal) * 100), (b / q.goal) * 100)}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
        </div>
        <div className="mt-1 text-right font-display text-xs text-muted">
          {fmt(Math.min(a + b, q.goal))} / {fmt(q.goal)}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { u: uid, nick: t('You'), avatar: useSettings.getState().avatar, v: a, c: 'bg-accent' },
            { u: other, nick: '@' + q.nicks[other], avatar: p?.avatar ?? q.avatars?.[other] ?? null, v: b, c: 'bg-sky-400' },
          ].map((m) => (
            <div key={m.u} className="flex items-center gap-2 rounded-xl bg-card2 p-2">
              <Avatar size={34} src={m.avatar ?? null} initial={m.nick.replace('@', '')} deco={null} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{m.nick}</div>
                <div className="flex items-center gap-1 text-xs text-muted">
                  <span className={`h-2 w-2 rounded-full ${m.c}`} /> {fmt(m.v)}
                </div>
              </div>
            </div>
          ))}
        </div>
        {done && (
          <motion.div className="mt-3 rounded-xl bg-done/15 px-3 py-2 text-center text-sm font-semibold text-done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            {t('Quest complete! 🎉 Great teamwork.')}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ league */

type Metric = 'pts' | 'n' | 'v';

function League({ friends, cur, s, coefSet }: { friends: PublicProfile[] | null; cur: ReturnType<typeof leagueSummary>; s: Settings; coefSet: boolean }) {
  const uid = useAccount((a) => a.uid)!;
  const nav = useNavigate();
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const [metric, setMetric] = useState<Metric>('pts');
  const [info, setInfo] = useState(false);
  const id = period === 'week' ? cur.wk.id : cur.mo.id;
  const mine = period === 'week' ? cur.wk : cur.mo;
  const rows = [
    { uid, nick: t('You'), avatar: useSettings.getState().avatar ?? null, deco: s.deco ?? null, st: mine, fair: coefSet, me: true },
    ...(friends ?? []).map((p) => ({ uid: p.uid, nick: '@' + p.nick, avatar: p.avatar ?? null, deco: p.deco ?? null, st: statsOf(p, id), fair: !!p.fair, me: false })),
  ]
    .map((r) => ({ ...r, val: r.st ? r.st[metric] : 0 }))
    .sort((a, b) => b.val - a.val || (a.me ? -1 : 1));
  const top = rows[0]?.val ?? 0;
  const lm = monthId(subMonths(new Date(), 1));
  const last = (s.medals ?? []).find((m) => m.m === lm);
  const fmt = (v: number) => (metric === 'v' ? vol(v, s) : metric === 'pts' ? `${v.toLocaleString('en-US')} ${t('pts')}` : String(v));

  return (
    <div className="cut bg-card p-4">
      <SectionTitle
        right={
          <button onClick={() => setInfo(true)} className="flex items-center gap-1">
            <Info size={14} /> {t('How it works')}
          </button>
        }
      >
        {t('Friends league')}
      </SectionTitle>
      <div className="mb-2 grid grid-cols-2 rounded-xl bg-card2 p-1">
        {(['week', 'month'] as const).map((p) => (
          <button key={p} onClick={() => setPeriod(p)} className={`relative z-10 py-1.5 text-sm font-semibold ${period === p ? 'text-ink' : 'text-white/70'}`}>
            {period === p && <motion.span layoutId="league-period" className="absolute inset-0 -z-10 rounded-lg bg-accent" />}
            {p === 'week' ? t('This week') : t('This month')}
          </button>
        ))}
      </div>
      <div className="mb-3 flex gap-1.5">
        {(
          [
            ['pts', t('Points')],
            ['n', t('Sessions')],
            ['v', t('Volume')],
          ] as [Metric, string][]
        ).map(([m, label]) => (
          <button key={m} onClick={() => setMetric(m)} className={`rounded-full px-3 py-1 text-xs font-semibold ${metric === m ? 'bg-accent text-ink' : 'bg-card2 text-white/70'}`}>
            {label}
          </button>
        ))}
      </div>
      {!coefSet && (
        <button onClick={() => nav('/ranks')} className="press mb-3 flex w-full items-center gap-2 rounded-xl bg-warn/15 px-3 py-2 text-left text-xs text-warn">
          <Scale size={16} className="shrink-0" /> {t('Set your sex and bodyweight so your points are balanced fairly.')}
        </button>
      )}
      {friends === null && <div className="py-4 text-center text-sm text-muted">{t('Loading…')}</div>}
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {rows.map((r, i) => (
            <motion.button
              layout
              key={r.uid}
              onClick={() => !r.me && nav(`/u/${r.uid}`)}
              className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ${r.me ? 'bg-accent/15 ring-1 ring-accent/50' : 'bg-card2'}`}
            >
              <div className="w-7 shrink-0 text-center font-display text-lg font-bold">{r.val > 0 && i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
              <Avatar size={36} src={r.avatar} initial={r.nick.replace('@', '')} deco={null} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate text-sm font-semibold">
                  {r.nick}
                  {!r.fair && metric === 'pts' && <Scale size={12} className="shrink-0 text-muted" aria-label={t('Not balanced')} />}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div className={`h-full rounded-full ${r.me ? 'grad' : 'bg-sky-400'}`} initial={{ width: 0 }} animate={{ width: `${top ? (r.val / top) * 100 : 0}%` }} transition={{ duration: 0.7 }} />
                </div>
              </div>
              <div className="shrink-0 text-right font-display text-sm font-bold">{fmt(r.val)}</div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      {friends?.length === 0 && (
        <button onClick={() => nav('/social?tab=friends')} className="press mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-card2 py-3 text-sm font-semibold text-accent">
          <UserPlus size={16} /> {t('Add friends to compete')}
        </button>
      )}
      <div className="mt-3 text-center text-xs text-muted">
        {period === 'month' ? t('Ends in {n} days · top 3 win a medal, #1 the Monthly Champion decoration', { n: daysLeft('month') }) : t('Resets in {n} days', { n: daysLeft('week') })}
      </div>
      {last && last.place > 0 && (
        <div className="mt-2 text-center text-xs font-semibold">
          {t('Last month: #{n} of {of}', { n: last.place, of: last.of })} {['🥇', '🥈', '🥉'][last.place - 1] ?? ''}
        </div>
      )}
      <Sheet open={info} onClose={() => setInfo(false)} title={t('Friends league')}>
        <div className="space-y-3 px-5 pb-4 pt-2 text-sm text-white/85">
          <p>{t('Everyone you follow and everyone who follows you is in your league. It runs every week and every month.')}</p>
          <p>
            <b>{t('Points')}</b>: {t('1 point for every 100 kg you lift + 20 points for every session.')}
          </p>
          <p>{t('To keep it fair, lifted weight is adjusted for bodyweight and sex with the DOTS formula used in powerlifting — a lighter lifter or a woman gets more points for the same weight. Your bodyweight itself is not shown to anyone.')}</p>
          <p>{t('At the end of each month the top 3 get a medal for their trophy cabinet. The winner also unlocks the Monthly Champion decoration.')}</p>
        </div>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ trophy cabinet */

function Cabinet({ badges, medals }: { badges: string[]; medals: NonNullable<Settings['medals']> }) {
  const items = [
    ...medals.filter((m) => m.place >= 1 && m.place <= 3).map((m) => ({ m: m.m, kind: (['gold', 'silver', 'bronze'] as const)[m.place - 1] as MedalKind })),
    ...badges.filter((m) => m !== monthId(new Date())).map((m) => ({ m, kind: 'quest' as MedalKind })),
  ].sort((a, b) => b.m.localeCompare(a.m));
  return (
    <div className="cut bg-card p-4">
      <SectionTitle right={items.length ? String(items.length) : undefined}>{t('Trophy cabinet')}</SectionTitle>
      {items.length === 0 ? (
        <div className="text-sm text-muted">{t('League medals and monthly challenge badges collect here.')}</div>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1" data-no-swipe>
          {items.map((x, i) => (
            <motion.div key={x.m + x.kind} className="shrink-0" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: Math.min(i, 8) * 0.05, type: 'spring' }}>
              <MonthBadge m={x.m} kind={x.kind} size={58} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ screen */

export function Compete() {
  const nav = useNavigate();
  const loc = useLocation();
  const status = useAccount((a) => a.status);
  const signedIn = status === 'signedIn';
  const settings = useSettings();
  const workouts = useAllWorkouts();
  const bw = useLatestBodyweight();
  const { ctx, data: ranks } = useRanks();
  const badges = useBadges();
  const friends = useLeagueFriends(signedIn && loc.pathname === '/compete');
  const ws = workouts ?? [];
  const coef = fairness(bw, settings.sex);
  const cx = { typeOf, muscleOf };
  const prs = useMemo(() => prCounts(ws, typeOf), [workouts]);
  const weekly = useMemo(() => weeklyChallenges(ws, cx, new Date(), prs), [workouts, prs]);
  const monthly = useMemo(() => monthlyChallenge(ws, cx, new Date(), prs), [workouts, prs]);
  const monthBadges = useMemo(() => monthlyBadges(ws, cx), [workouts]);
  const cur = useMemo(() => leagueSummary(ws, coef, typeOf), [workouts, coef]);
  const overall = ranks?.overall ?? null;

  return (
    <Page>
      <Header
        large
        title={t('Compete')}
        right={
          <>
            <button onClick={() => nav('/social?tab=friends')} className="press text-white" aria-label={t('Friends')}>
              <UserPlus size={22} />
            </button>
            <button onClick={() => nav('/social?tab=messages')} className="press relative text-white" aria-label={t('Messages')}>
              <MessageCircle size={22} />
              {badges.total > 0 && <span className="absolute -right-1.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-[#fff]">{badges.total}</span>}
            </button>
          </>
        }
      />
      <div className="space-y-3 px-4 pb-10">
        <button onClick={() => nav('/ranks')} className="press cut relative flex w-full items-center gap-3 overflow-hidden bg-card p-3 text-left">
          {overall != null && <div className="absolute inset-0 opacity-25" style={{ background: `radial-gradient(circle at 15% 50%, ${tierOf(overall).c[1]}, transparent 65%)` }} />}
          <RankBadge score={ctx === null ? null : overall} size={48} />
          <div className="relative min-w-0 flex-1">
            <div className="label !text-[9px]">{t('Strength rank')}</div>
            {ctx === null ? <div className="text-sm text-white/80">{t('Tap to unlock')}</div> : <TierName score={overall} className="block truncate text-xl leading-tight" />}
          </div>
          <Swords size={18} className="relative text-muted" />
          <ChevronRight size={18} className="relative text-muted" />
        </button>

        <WeeklyChallenges list={weekly} s={settings} />

        {signedIn ? (
          <>
            <FriendsQuest friends={friends} mine={cur.wk} workouts={ws} s={settings} />
            <League friends={friends} cur={cur} s={settings} coefSet={!!(bw && settings.sex)} />
          </>
        ) : (
          <div className="cut bg-card p-5 text-center">
            <div className="text-4xl">🏆</div>
            <div className="mt-2 font-display text-xl font-bold uppercase">{t('Compete with friends')}</div>
            <div className="mt-1 text-sm text-muted">{t('Create an account to join weekly and monthly leagues and team up in Friends Quests.')}</div>
            <button onClick={() => nav('/settings')} className="press cut-sm grad mt-4 w-full py-3 font-display font-bold uppercase tracking-wider">
              {t('Create account')}
            </button>
          </div>
        )}

        <MonthlyCard c={monthly} s={settings} />
        <Cabinet badges={monthBadges} medals={settings.medals ?? []} />
      </div>
    </Page>
  );
}
