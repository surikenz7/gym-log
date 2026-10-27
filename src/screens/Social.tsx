import { formatDistanceToNowStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { Cloud, CloudOff, Lock, LogOut, RefreshCw, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../i18n';
import { useSettings } from '../state/settings';
import { Button, Sheet } from '../components/ui';
import { backupNow, NICK_RE, requestSync, signIn, signOut, signUp, useAccount } from '../cloud/account';
import { cloudEnabled } from '../cloud/config';
import { haptic } from '../lib/haptics';
import { confirmDialog, toast } from '../state/dialog';

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
/** Private profile: people must request to follow, and only approved followers see workouts. */
function PrivateRow() {
  const on = useSettings((s) => !!s.privateProfile);
  const a = useAccount();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Lock size={20} className="text-accent" />
      <div className="flex-1">
        <div>{t('Private profile')}</div>
        <div className="text-xs text-muted">{on ? t('Only followers you approve see your workouts') : t('Anyone can follow you and see your workouts')}</div>
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const { setPrivate } = await import('../cloud/social');
            await setPrivate({ uid: a.uid!, nick: a.nick ?? '', avatar: useSettings.getState().avatar ?? null }, !on);
            useSettings.getState().update({ privateProfile: !on });
            haptic();
          } catch {
            toast(t('No internet connection'));
          } finally {
            setBusy(false);
          }
        }}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${on ? 'bg-done' : 'bg-line'} ${busy ? 'opacity-60' : ''}`}
      >
        <motion.span className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-[#fff] shadow" animate={{ left: on ? 22 : 2 }} transition={{ type: 'spring', stiffness: 700, damping: 35 }} />
      </button>
    </div>
  );
}

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
      <button onClick={() => nav('/social')} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-card2">
        <Users size={20} className="text-accent" />
        <span className="flex-1">{t('Friends & messages')}</span>
        <span className="text-sm text-muted">{a.following.length}</span>
      </button>
      <PrivateRow />
      <button
        onClick={async () => {
          if (!(await confirmDialog('Log out?', 'Everything is backed up to your account and will be removed from this phone. Log back in any time to get it all back.', 'Log out'))) return;
          if (!(await backupNow()) && !(await confirmDialog('Not backed up', 'Couldn’t reach the cloud, so changes since the last backup would be lost. Log out anyway?', 'Log out anyway', true))) return;
          await signOut();
        }}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-danger active:bg-card2"
      >
        <LogOut size={20} /> Log out
      </button>
    </>
  );
}
