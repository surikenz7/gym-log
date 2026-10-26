import { formatDistanceToNowStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { Cloud, CloudOff, Download, Flame, LogOut, RefreshCw, Search, Trophy, UserCheck, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RankBadge, TierName } from '../components/RankBadge';
import { Avatar, WorkoutCard } from '../components/WorkoutFeed';
import { Button, Header, Page, Sheet } from '../components/ui';
import { NICK_RE, requestSync, signIn, signOut, signUp, useAccount } from '../cloud/account';
import { cloudEnabled } from '../cloud/config';
import type { PublicProfile } from '../cloud/social';
import { haptic } from '../lib/haptics';
import { packRoutine, saveSharedRoutine } from '../lib/share';
import { confirmDialog, toast } from '../state/dialog';
import type { Routine, Workout } from '../types';

const social = () => import('../cloud/social');

/** Log in / create account sheet: nickname + password, nothing else. */
export function AccountSheet({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: 'signup' | 'login' }) {
  const [nick, setNick] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) setErr(null);
  }, [open]);
  const submit = async () => {
    setErr(null);
    if (mode === 'signup' && !NICK_RE.test(nick)) return setErr('Nickname: 3–20 letters, numbers, _ or .');
    if (pass.length < 6) return setErr('Password needs at least 6 characters');
    setBusy(true);
    try {
      await (mode === 'signup' ? signUp(nick, pass) : signIn(nick, pass));
      haptic('success');
      toast(mode === 'signup' ? `Welcome, ${nick}! Your data is backing up to the cloud.` : `Logged in as ${nick}`);
      setPass('');
      onClose();
      requestSync(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const input = 'w-full rounded-xl bg-card2 px-4 py-3 outline-none placeholder:text-muted';
  return (
    <Sheet open={open} onClose={onClose} title={mode === 'signup' ? 'Create account' : 'Log in'}>
      <div className="space-y-2.5 px-4 pt-2">
        <input value={nick} onChange={(e) => setNick(e.target.value.replace(/\s/g, ''))} placeholder="Nickname" autoCapitalize="none" autoCorrect="off" autoComplete="username" className={input} />
        <input
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className={input}
        />
        {err && <div className="text-sm text-danger">{err}</div>}
        <Button className="w-full !py-3.5" onClick={() => void submit()} disabled={busy}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </Button>
        <p className="pb-2 text-center text-xs text-muted">
          {mode === 'signup'
            ? 'No email needed. Remember your password — without an email it can’t be reset. You stay logged in on this phone.'
            : 'Your workouts, routines and settings download to this device.'}
        </p>
      </div>
    </Sheet>
  );
}

/** Settings → Account section. */
export function AccountSection() {
  const a = useAccount();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<'signup' | 'login' | null>(null);
  if (!cloudEnabled)
    return (
      <div className="flex items-start gap-3 px-4 py-3 text-sm text-muted">
        <CloudOff size={20} className="mt-0.5 shrink-0" />
        Accounts and cloud backup aren’t switched on in this version yet.
      </div>
    );
  if (a.status !== 'signedIn')
    return (
      <>
        <div className="px-4 py-3 text-sm text-white/80">Create a free account to back up everything to the cloud, use it on other devices and follow friends.</div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <Button onClick={() => setSheet('signup')}>Create account</Button>
          <Button variant="secondary" onClick={() => setSheet('login')}>
            Log in
          </Button>
        </div>
        <AccountSheet open={!!sheet} mode={sheet ?? 'login'} onClose={() => setSheet(null)} />
      </>
    );
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3">
        <Cloud size={20} className="text-accent" />
        <div className="flex-1">
          <div className="font-semibold">@{a.nick}</div>
          <div className="text-xs text-muted">
            {a.syncing ? 'Syncing…' : a.error ? `Not synced: ${a.error}` : a.lastSync ? `Backed up ${formatDistanceToNowStrict(a.lastSync, { addSuffix: true })}` : 'Waiting to sync'}
          </div>
        </div>
        <button onClick={() => requestSync(null)} className={`press p-2 text-muted ${a.syncing ? 'animate-spin' : ''}`} aria-label="Sync now">
          <RefreshCw size={18} />
        </button>
      </div>
      <button onClick={() => nav('/friends')} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-card2">
        <Users size={20} className="text-accent" />
        <span className="flex-1">Friends</span>
        <span className="text-sm text-muted">{a.following.length}</span>
      </button>
      <button
        onClick={async () => {
          if (await confirmDialog('Log out?', 'Your data stays on this phone. Log in again any time to keep syncing.', 'Log out')) await signOut();
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-danger active:bg-card2"
      >
        <LogOut size={20} /> Log out
      </button>
    </>
  );
}

function ProfileRow({ p, i }: { p: PublicProfile; i: number }) {
  const nav = useNavigate();
  return (
    <motion.button
      onClick={() => nav(`/u/${p.uid}`)}
      className="press cut-sm flex w-full items-center gap-3 bg-card p-3 text-left"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
    >
      <div className="p-1.5">
        <Avatar size={44} src={p.avatar ?? null} initial={p.nick} deco={p.deco ?? null} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">@{p.nick}</div>
        <div className="text-xs text-muted">
          LVL {p.level ?? 1} · {p.title ?? 'Rookie'}
          {p.streak ? ` · 🔥 ${p.streak}` : ''}
        </div>
      </div>
      {p.overall != null && <RankBadge score={p.overall} size={34} shine={false} />}
    </motion.button>
  );
}

export function Friends() {
  const a = useAccount();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<PublicProfile | null | undefined>(undefined);
  const [list, setList] = useState<PublicProfile[] | null>(null);

  useEffect(() => {
    if (a.status !== 'signedIn') return;
    void social().then((s) => s.getProfiles(a.following).then(setList));
  }, [a.status, a.following.join()]);

  const search = async () => {
    if (!q.trim()) return;
    setFound(undefined);
    const p = await (await social()).findUser(q.replace(/^@/, '')).catch(() => null);
    setFound(p && p.uid !== a.uid ? p : null);
  };

  if (a.status !== 'signedIn')
    return (
      <Page pushed>
        <Header back title="Friends" />
        <div className="px-6 py-16 text-center text-muted">Create an account in Settings to follow friends.</div>
      </Page>
    );

  return (
    <Page pushed>
      <Header back title="Friends" />
      <div className="px-4 pb-12">
        <div className="cut flex items-center gap-2 bg-card p-2 pl-4">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value.replace(/\s/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder="Find a friend by nickname"
            autoCapitalize="none"
            autoCorrect="off"
            className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-muted"
          />
          <button onClick={() => void search()} className="press grad rounded-lg px-4 py-2 text-sm font-bold">
            Find
          </button>
        </div>
        {found === null && <div className="mt-3 text-center text-sm text-muted">Nobody with that nickname.</div>}
        {found && (
          <div className="mt-3">
            <ProfileRow p={found} i={0} />
          </div>
        )}

        <div className="label mb-2 mt-6">Following · {a.following.length}</div>
        {list === null && <div className="text-sm text-muted">Loading…</div>}
        {list?.length === 0 && <div className="cut bg-card p-5 text-center text-sm text-muted">Search your friend’s nickname above and follow them to see their workouts and routines.</div>}
        <div className="space-y-2">
          {list?.map((p, i) => (
            <ProfileRow key={p.uid} p={p} i={i} />
          ))}
        </div>
        <div className="mt-6 text-center text-xs text-muted">
          Your profile: <b className="text-white">@{a.nick}</b> — tell friends to search for it.
        </div>
      </div>
    </Page>
  );
}

/** A friend's profile, like Hevy: stats, routines you can copy, recent workouts. */
export function FriendProfile() {
  const { uid } = useParams();
  const a = useAccount();
  const [p, setP] = useState<PublicProfile | null | undefined>(undefined);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const following = a.following.includes(uid!);

  useEffect(() => {
    void (async () => {
      const s = await social();
      setP(await s.getProfile(uid!).catch(() => null));
      s.getWorkouts(uid!)
        .then(setWorkouts)
        .catch(() => setWorkouts([]));
      s.getRoutines(uid!)
        .then(setRoutines)
        .catch(() => setRoutines([]));
    })();
  }, [uid]);

  const toggleFollow = async () => {
    const s = await social();
    await s.follow(a.uid!, uid!, !following);
    useAccount.setState({ following: following ? a.following.filter((x) => x !== uid) : [...a.following, uid!] });
    haptic(following ? 'light' : 'success');
  };

  if (p === undefined) return <Page pushed><Header back title="Profile" /></Page>;
  if (p === null)
    return (
      <Page pushed>
        <Header back title="Profile" />
        <div className="px-6 py-16 text-center text-muted">Couldn’t load this profile.</div>
      </Page>
    );

  return (
    <Page pushed>
      <Header back title={`@${p.nick}`} />
      <div className="px-4 pb-12">
        <div className="flex flex-col items-center pt-8">
          <Avatar size={104} src={p.avatar ?? null} initial={p.nick} deco={p.deco ?? null} />
          <div className="mt-6 font-display text-3xl font-bold">@{p.nick}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="grad rounded px-1.5 py-0.5 font-display text-xs font-bold">LVL {p.level ?? 1}</span>
            <span className="font-display text-sm uppercase tracking-wider text-white/70">{p.title}</span>
          </div>
          {p.uid !== a.uid && (
            <Button variant={following ? 'secondary' : 'primary'} className="mt-4 !px-6" onClick={() => void toggleFollow()}>
              {following ? <UserCheck size={18} /> : <UserPlus size={18} />} {following ? 'Following' : 'Follow'}
            </Button>
          )}
        </div>

        <div className="cut mt-5 grid grid-cols-3 divide-x divide-line bg-card py-3 text-center">
          <div>
            <div className="font-display text-2xl font-bold">{p.workouts ?? 0}</div>
            <div className="label !text-[10px]">Workouts</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold">
              <Flame size={18} className="text-orange-500" /> {p.streak ?? 0}
            </div>
            <div className="label !text-[10px]">Week streak</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold">
              <Trophy size={17} className="text-warn" /> {p.trophies ?? 0}
            </div>
            <div className="label !text-[10px]">Trophies</div>
          </div>
        </div>

        <div className="cut mt-3 flex items-center gap-4 bg-card p-4">
          <RankBadge score={p.overall ?? null} size={60} />
          <div>
            <div className="label">Overall rank</div>
            <TierName score={p.overall ?? null} className="text-2xl" />
            {p.overall != null && <div className="font-display text-xs text-muted">{p.overall} pts</div>}
          </div>
        </div>

        <div className="label mb-2 mt-6">Routines</div>
        {routines === null && <div className="text-sm text-muted">Loading…</div>}
        {routines?.length === 0 && <div className="text-sm text-muted">No routines yet.</div>}
        <div className="space-y-2">
          {routines?.map((r) => (
            <div key={r.id} className="cut-sm flex items-center gap-3 bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.name}</div>
                <div className="text-xs text-muted">
                  {r.exercises.length} exercises · {r.exercises.reduce((n, e) => n + e.sets.length, 0)} sets
                </div>
              </div>
              <button
                onClick={async () => {
                  await saveSharedRoutine(packRoutine(r));
                  haptic('success');
                  toast(`Saved “${r.name}” to your routines`);
                }}
                className="press flex items-center gap-1.5 rounded-lg bg-card2 px-3 py-2 text-sm font-semibold"
              >
                <Download size={16} /> Save
              </button>
            </div>
          ))}
        </div>

        <div className="label mb-2 mt-6">Recent workouts</div>
        {workouts === null && <div className="text-sm text-muted">Loading…</div>}
        {workouts?.length === 0 && <div className="text-sm text-muted">No workouts shared yet.</div>}
        <div className="space-y-2">
          {workouts?.map((w, i) => (
            <WorkoutCard key={w.id} w={w} prs={0} index={i} friend />
          ))}
        </div>
      </div>
    </Page>
  );
}
