import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, ChevronLeft, ClipboardList, Cloud, Dumbbell, Ruler, Sparkles, Upload, UserRound } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { NICK_RE, requestSync, signIn, signUp, useAccount } from '../cloud/account';
import { cloudEnabled } from '../cloud/config';
import { NumInput } from '../components/inputs';
import { Confetti } from '../components/Rewards';
import { Avatar } from '../components/WorkoutFeed';
import { db } from '../db/db';
import { fileToAvatar } from '../lib/avatar';
import { haptic } from '../lib/haptics';
import { uid } from '../lib/id';
import { fanfare } from '../lib/sound';
import { MODES, paletteOf, STYLES, THEMES } from '../lib/theme';
import { kgTo, toKg } from '../lib/units';
import { ask } from '../state/dialog';
import { useSettings } from '../state/settings';
import type { ModeId, StyleId, ThemeId } from '../types';
import { addProgram, PROGRAM_COLORS, PROGRAMS } from './Explore';
import { lang, LANGS, t } from '../i18n';

type Step = 'welcome' | 'account' | 'profile' | 'body' | 'look' | 'start' | 'done';

/** Settings → "Run setup again" opens the flow on demand. */
export const useOnboardingReplay = create<{ open: boolean }>(() => ({ open: false }));

export type OnboardingStart = 'welcome' | 'account' | 'setup';

/**
 * When the welcome flow / login screen has to cover the app:
 *  - logged out (and not a guest) → the login screen (with the intro the very first time)
 *  - no cloud: the intro + setup until done once
 *  - "Run setup again" → just the setup slides
 */
export function useOnboarding(): OnboardingStart | null {
  const onboarded = useSettings((s) => s.onboarded);
  const guest = useSettings((s) => s.guest);
  const status = useAccount((s) => s.status);
  const replay = useOnboardingReplay((s) => s.open);
  if (replay) return cloudEnabled && status === 'signedOut' && !guest ? 'account' : 'setup';
  if (status === 'loading') return null;
  if (cloudEnabled && status === 'signedOut' && !guest) return onboarded ? 'account' : 'welcome';
  if (!onboarded && status !== 'signedIn') return 'welcome';
  return null;
}

/* ------------------------------------------------------------------ pieces */

function Blobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent opacity-30 blur-3xl"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, 90, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-accent2 opacity-20 blur-3xl"
        animate={{ x: [0, -50, 10, 0], y: [0, -60, -20, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/** A barbell that builds itself: the bar slides in, then the plates slam on. */
function AnimatedBarbell({ size = 220 }: { size?: number }) {
  const plate = (x: number, h: number, w: number, delay: number, from: number) => (
    <motion.rect
      x={x}
      y={60 - h / 2}
      width={w}
      height={h}
      rx={w / 3}
      className="fill-accent"
      initial={{ x: from, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18, delay }}
    />
  );
  return (
    <motion.svg width={size} height={size * 0.55} viewBox="0 0 220 120" initial={{ rotate: -8 }} animate={{ rotate: [-8, 0, -3, 0] }} transition={{ duration: 1.6, delay: 1 }}>
      <motion.rect x="10" y="55" width="200" height="10" rx="5" fill="rgb(var(--fg))" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} style={{ originX: '50%' }} />
      {plate(42, 74, 16, 0.45, -60)}
      {plate(60, 56, 12, 0.6, -60)}
      {plate(162, 74, 16, 0.45, 60)}
      {plate(148, 56, 12, 0.6, 60)}
      <motion.rect x="76" y="50" width="6" height="20" rx="2" fill="rgb(var(--fg))" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} />
      <motion.rect x="138" y="50" width="6" height="20" rx="2" fill="rgb(var(--fg))" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} />
    </motion.svg>
  );
}

function Title({ icon, kicker, title, sub }: { icon: ReactNode; kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <motion.div
        className="grad mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_10px_30px_rgb(var(--accent)/0.4)]"
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.05 }}
      >
        {icon}
      </motion.div>
      <motion.div className="label" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        {kicker}
      </motion.div>
      <motion.h1 className="mt-1 font-display text-[34px] font-bold uppercase leading-[1] tracking-tight" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        {title}
      </motion.h1>
      {sub && (
        <motion.p className="mt-2 text-[15px] text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          {sub}
        </motion.p>
      )}
    </div>
  );
}

/** Children fade/slide in one after another. */
function Stagger({ children }: { children: ReactNode[] }) {
  return (
    <>
      {children.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.07 }}>
          {c}
        </motion.div>
      ))}
    </>
  );
}

function Choice({ on, onClick, children, className = '' }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      onClick={() => (haptic(), onClick())}
      className={`press relative rounded-2xl p-3 text-left transition-colors ${on ? 'bg-accent/15' : 'bg-card'} ${className}`}
      style={{ boxShadow: on ? 'inset 0 0 0 2px rgb(var(--accent))' : 'inset 0 0 0 1px rgb(var(--line))' }}
    >
      {children}
      {on && (
        <motion.span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent" initial={{ scale: 0 }} animate={{ scale: 1 }}>
          <Check size={12} strokeWidth={4} />
        </motion.span>
      )}
    </button>
  );
}

const field = 'w-full rounded-2xl bg-card px-4 py-3.5 text-[17px] outline-none placeholder:text-muted ring-1 ring-inset ring-line focus:ring-2 focus:ring-accent';

/* ------------------------------------------------------------------ steps */

function AccountStep({ onResult }: { onResult: (r: 'signup' | 'login' | 'guest') => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [nick, setNick] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (mode === 'signup' && !NICK_RE.test(nick)) return setErr('Nickname: 3–20 letters, numbers, _ or .');
    if (pass.length < 6) return setErr('Password needs at least 6 characters');
    setBusy(true);
    try {
      await (mode === 'signup' ? signUp(nick, pass) : signIn(nick, pass));
      if (mode === 'signup') useSettings.getState().update({ name: useSettings.getState().name || nick });
      haptic('success');
      requestSync(null);
      onResult(mode);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const guest = async () => {
    const r = await ask({
      title: t('Continue without an account?'),
      message: t('Your progress will only be saved on this phone — not in the cloud. If you delete the app, lose the phone or switch devices, it’s gone. You can create an account later in Settings.'),
      actions: [
        { label: t('Create an account'), value: 'back', style: 'primary' },
        { label: t('Continue as guest'), value: 'guest', style: 'danger' },
      ],
    });
    if (r === 'guest') onResult('guest');
  };

  return (
    <>
      <Title icon={<Cloud size={28} />} kicker={t('Step 1 · Account')} title={mode === 'signup' ? 'Create your account' : 'Welcome back'} sub={t('Your workouts back up to the cloud, follow you to any phone and let friends see your progress.')} />
      <Stagger>
        {[
          <div key="t" className="relative mb-3 grid grid-cols-2 rounded-2xl bg-card p-1">
            {(['signup', 'login'] as const).map((m) => (
              <button key={m} onClick={() => (setMode(m), setErr(null))} className={`relative z-10 py-2.5 text-sm font-semibold ${mode === m ? 'text-ink' : 'text-white/70'}`}>
                {mode === m && <motion.span layoutId="acct-tab" className="absolute inset-0 -z-10 rounded-xl bg-accent" />}
                {m === 'signup' ? t('New account') : t('I have one')}
              </button>
            ))}
          </div>,
          <input key="n" value={nick} onChange={(e) => setNick(e.target.value.replace(/\s/g, ''))} placeholder={t('Nickname')} autoCapitalize="none" autoCorrect="off" autoComplete="username" className={field} />,
          <input
            key="p"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder={t('Password')}
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className={`${field} mt-2.5`}
          />,
          <div key="e">{err && <div className="mt-2 text-sm text-danger">{err}</div>}</div>,
          <button key="b" onClick={() => void submit()} disabled={busy} className="press grad mt-4 w-full rounded-2xl py-4 font-display text-lg font-bold uppercase tracking-wider disabled:opacity-60">
            {busy ? t('One moment…') : mode === 'signup' ? t('Create account') : t('Log in')}
          </button>,
          <p key="h" className="mt-2 text-center text-xs text-muted">
            {mode === 'signup' ? 'No email needed — just remember your password, it can’t be reset.' : 'Your workouts, routines and settings will download to this phone.'}
          </p>,
          <button key="g" onClick={() => void guest()} className="mt-5 w-full py-2 text-center text-sm font-semibold text-white/60">
            {t('Continue as guest')}
          </button>,
        ]}
      </Stagger>
    </>
  );
}

function ProfileStep() {
  const s = useSettings();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Title icon={<UserRound size={28} />} kicker={t('Step 2 · Profile')} title={t('Who’s lifting?')} sub={t('Your name and photo show on your profile and to your friends.')} />
      <Stagger>
        {[
          <div key="a" className="flex justify-center py-2">
            <button onClick={() => input.current?.click()} className="press relative">
              <Avatar size={128} />
              <span className="grad absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-bg">
                <Camera size={17} />
              </span>
            </button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) s.update({ avatar: await fileToAvatar(f).catch(() => s.avatar ?? null) });
              }}
            />
          </div>,
          <div key="t" className="mb-4 text-center text-xs text-muted">
            {t('Tap to add a photo')}
          </div>,
          <input key="n" value={s.name} onChange={(e) => s.update({ name: e.target.value.slice(0, 30) })} placeholder={t('Your name')} className={`${field} text-center text-xl font-semibold`} />,
        ]}
      </Stagger>
    </>
  );
}

function BodyStep() {
  const s = useSettings();
  const [bw, setBw] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [waist, setWaist] = useState<number | null>(null);
  const [arms, setArms] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const lbs = s.weightUnit === 'lbs';
  const cm = (v: number | null) => (v == null ? null : lbs ? v * 2.54 : v);

  // save as one Measures entry once the user enters something (debounced)
  const entryId = useRef(uid());
  const touched = useRef(false);
  useEffect(() => {
    db.measures
      .orderBy('date')
      .reverse()
      .first()
      .then((m) => m?.weight && setBw(+kgTo(m.weight, s.weightUnit).toFixed(1)));
  }, []);
  useEffect(() => {
    if (!bw || !touched.current) return;
    const t = setTimeout(() => {
      void db.measures.put({ id: entryId.current, date: Date.now(), weight: toKg(bw, s.weightUnit), bodyFat: fat, waist: cm(waist), arms: cm(arms) });
    }, 400);
    return () => clearTimeout(t);
  }, [bw, fat, waist, arms, s.weightUnit]);

  const row = (label: string, v: number | null, set: (n: number | null) => void, unit: string, ph = '0') => (
    <label className="flex items-center gap-3 rounded-2xl bg-card px-4 py-2 ring-1 ring-inset ring-line">
      <span className="flex-1 text-[15px] text-white/80">{label}</span>
      <NumInput value={v} onChange={(n) => ((touched.current = true), set(n))} placeholder={ph} className="!w-24 !text-right text-xl" />
      <span className="w-8 text-sm text-muted">{unit}</span>
    </label>
  );

  return (
    <>
      <Title icon={<Ruler size={28} />} kicker={t('Step 3 · Body')} title={t('Your measurements')} sub={t('Used for strength ranks and to track your progress. Only you can see them.')} />
      <Stagger>
        {[
          <div key="sx" className="grid grid-cols-2 gap-2">
            {(['male', 'female'] as const).map((x) => (
              <Choice key={x} on={s.sex === x} onClick={() => s.update({ sex: x })} className="py-4 text-center font-semibold capitalize">
                {x === 'male' ? `♂ ${t('Male')}` : `♀ ${t('Female')}`}
              </Choice>
            ))}
          </div>,
          <div key="u" className="mt-3 grid grid-cols-2 gap-2">
            {(['kg', 'lbs'] as const).map((u) => (
              <Choice key={u} on={s.weightUnit === u} onClick={() => s.update({ weightUnit: u })} className="py-3 text-center font-semibold">
                {u === 'kg' ? t('Kilograms (kg)') : t('Pounds (lbs)')}
              </Choice>
            ))}
          </div>,
          <div key="bw" className="mt-3">
            {row('Bodyweight', bw, setBw, s.weightUnit)}
          </div>,
          more ? (
            <div key="more" className="mt-2 space-y-2">
              {row('Body fat', fat, setFat, '%', 'optional')}
              {row('Waist', waist, setWaist, lbs ? 'in' : 'cm', 'optional')}
              {row('Arms', arms, setArms, lbs ? 'in' : 'cm', 'optional')}
            </div>
          ) : (
            <button key="m" onClick={() => setMore(true)} className="mt-3 w-full py-2 text-sm font-semibold text-accent">
              + {t('Add body fat, waist & arms')}
            </button>
          ),
        ]}
      </Stagger>
    </>
  );
}

const STYLE_FONT: Record<StyleId, React.CSSProperties> = {
  raw: { fontFamily: 'Oswald, sans-serif', fontWeight: 700, textTransform: 'uppercase' },
  elegant: { fontFamily: "'Playfair Display', serif", fontWeight: 600 },
  minimal: { fontFamily: '-apple-system, system-ui, sans-serif', fontWeight: 600 },
  playful: { fontFamily: 'Fredoka, ui-rounded, sans-serif', fontWeight: 600 },
  cyber: { fontFamily: "'Exo 2', sans-serif", fontWeight: 800, fontStyle: 'italic', textTransform: 'uppercase' },
  frost: { fontFamily: '-apple-system, system-ui, sans-serif', fontWeight: 700 },
  tactical: { fontFamily: "'Black Ops One', Impact, sans-serif", textTransform: 'uppercase' },
  brutal: { fontFamily: 'Anton, Impact, sans-serif', textTransform: 'uppercase' },
  terminal: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 },
};

function LookStep() {
  const s = useSettings();
  return (
    <>
      <Title icon={<Sparkles size={28} />} kicker={t('Step 4 · Look')} title={t('Make it yours')} sub={t('Everything changes live — you can tweak it any time in Settings.')} />
      <Stagger>
        {[
          <div key="st" className="grid grid-cols-2 gap-2">
            {(Object.keys(STYLES) as StyleId[]).map((id) => (
              <Choice key={id} on={s.style === id} onClick={() => s.update({ style: id })}>
                <div className="text-2xl leading-none" style={STYLE_FONT[id]}>
                  Aa
                </div>
                <div className="mt-1.5 text-sm font-semibold" style={STYLE_FONT[id]}>
                  {t(STYLES[id].name)}
                </div>
                <div className="text-[11px] leading-tight text-muted">{t(STYLES[id].desc)}</div>
              </Choice>
            ))}
          </div>,
          <div key="md" className="mt-3 grid grid-cols-4 gap-2">
            {(Object.keys(MODES) as ModeId[]).map((id) => {
              const p = paletteOf(s.theme, id);
              return (
                <button key={id} onClick={() => (haptic(), s.update({ mode: id }))} className="press flex flex-col items-center gap-1">
                  <span className="h-11 w-full rounded-xl" style={{ background: `linear-gradient(160deg, ${p.card}, ${p.bg})`, boxShadow: s.mode === id ? `inset 0 0 0 2px ${p.accent}` : `inset 0 0 0 1px ${p.line}` }} />
                  <span className={`text-[11px] font-semibold ${s.mode === id ? 'text-white' : 'text-muted'}`}>{t(MODES[id].name)}</span>
                </button>
              );
            })}
          </div>,
          <div key="cl" className="mt-4 grid grid-cols-8 gap-2">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => (
              <button
                key={id}
                onClick={() => (haptic(), s.update({ theme: id }))}
                className="press aspect-square rounded-full"
                style={{ background: `linear-gradient(135deg, ${THEMES[id].accent}, ${THEMES[id].accent2})`, boxShadow: s.theme === id ? '0 0 0 2px rgb(var(--bg)), 0 0 0 4px rgb(var(--fg))' : undefined }}
                aria-label={THEMES[id].name}
              />
            ))}
          </div>,
          <div key="nm" className="mt-2 text-center text-xs text-muted">
            {THEMES[s.theme].name} · {STYLES[s.style].name} · {MODES[s.mode].name}
          </div>,
        ]}
      </Stagger>
    </>
  );
}

function StartStep({ pick, setPick }: { pick: number | 'hevy' | null; setPick: (p: number | 'hevy' | null) => void }) {
  return (
    <>
      <Title icon={<ClipboardList size={28} />} kicker={t('Step 5 · Training')} title={t('How do you start?')} sub={t('Grab a proven program, bring your Hevy history, or build your own routines later.')} />
      <Stagger>
        {[
          ...PROGRAMS.map((p, i) => {
            const [a, b] = PROGRAM_COLORS[i % PROGRAM_COLORS.length];
            return (
              <Choice key={p.name} on={pick === i} onClick={() => setPick(pick === i ? null : i)} className="mb-2 flex w-full items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#fff]" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
                  <Dumbbell size={20} />
                </span>
                <span className="min-w-0 pr-6">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{p.level}</span>
                </span>
              </Choice>
            );
          }),
          <Choice key="hevy" on={pick === 'hevy'} onClick={() => setPick(pick === 'hevy' ? null : 'hevy')} className="mb-2 flex w-full items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card2">
              <Upload size={20} />
            </span>
            <span className="pr-6">
              <span className="block font-semibold">{t('Import from Hevy')}</span>
              <span className="block text-xs text-muted">{t('Bring your whole workout history')}</span>
            </span>
          </Choice>,
        ]}
      </Stagger>
    </>
  );
}

function DoneStep() {
  const s = useSettings();
  const nick = useAccount((a) => a.nick);
  useEffect(() => {
    haptic('success');
    fanfare(true);
  }, []);
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <Confetti />
      <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.15 }}>
        <Avatar size={150} ring="rgb(var(--accent))" />
      </motion.div>
      <motion.div className="mt-8 font-display text-[44px] font-bold uppercase leading-none" initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.45 }}>
        {t('You’re all set')}{s.name ? ',' : '!'}
        {s.name && (
          <>
            <br />
            <span className="text-grad">{s.name}</span>
          </>
        )}
      </motion.div>
      <motion.div className="mt-3 flex items-center gap-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <span className="grad rounded-full px-3 py-1 font-display text-sm font-bold">LVL 1</span>
        <span className="font-display text-sm uppercase tracking-wider text-white/70">{t('Rookie')}</span>
      </motion.div>
      <motion.p className="mt-4 max-w-[290px] text-[15px] text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}>
        {nick ? t('Signed in as @{nick} — everything you log is backed up.', { nick }) : t('Guest mode — your data stays on this phone.')} {t('Tap the big button in the middle of the tab bar to start your first workout.')}
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------------ flow */

const SETUP: Step[] = ['profile', 'body', 'look', 'start', 'done'];

export function Onboarding({ start, onDone }: { start: OnboardingStart; onDone: () => void }) {
  const nav = useNavigate();
  const [steps] = useState<Step[]>(() =>
    start === 'setup' ? SETUP : start === 'account' ? ['account', ...SETUP] : ['welcome', ...(cloudEnabled ? (['account'] as Step[]) : []), ...SETUP],
  );
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [pick, setPick] = useState<number | 'hevy' | null>(null);
  const step = steps[i];

  const go = (d: number) => {
    haptic();
    setDir(d);
    setI((x) => Math.max(0, Math.min(steps.length - 1, x + d)));
  };

  const finish = async () => {
    if (typeof pick === 'number') await addProgram(PROGRAMS[pick]);
    useSettings.getState().update({ onboarded: true });
    useOnboardingReplay.setState({ open: false });
    onDone();
    if (pick === 'hevy') nav('/import/hevy');
  };

  /** Logging in goes straight to the app; a new account (or a first-time guest) gets the setup. */
  const afterAccount = (r: 'signup' | 'login' | 'guest') => {
    if (r === 'guest') useSettings.getState().update({ guest: true });
    if (r === 'login' || (r === 'guest' && useSettings.getState().onboarded)) {
      useSettings.getState().update({ onboarded: true });
      useOnboardingReplay.setState({ open: false });
      nav('/', { replace: true });
      onDone();
      return;
    }
    go(1);
  };

  const isSetup = step !== 'welcome' && step !== 'done';
  const setupSteps: Step[] = steps.filter((s) => s !== 'welcome' && s !== 'done');
  const setupIndex = setupSteps.indexOf(step);

  return (
    <motion.div className="fixed inset-0 z-[55] flex flex-col overflow-hidden bg-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.35 }}>
      <Blobs />

      {isSetup && (
        <div className="relative z-10 flex items-center gap-3 px-5 pt-safe">
          <button onClick={() => go(-1)} className={`press -ml-2 p-2 text-white/70 ${i === 0 ? 'invisible' : ''}`} aria-label={t('Back')}>
            <ChevronLeft size={26} />
          </button>
          <div className="flex flex-1 gap-1.5 py-4">
            {setupSteps.map((s, k) => (
              <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full bg-accent" initial={false} animate={{ width: k < setupIndex ? '100%' : k === setupIndex ? '100%' : '0%' }} transition={{ duration: 0.45, ease: 'easeOut' }} style={{ opacity: k === setupIndex ? 1 : 0.55 }} />
              </div>
            ))}
          </div>
          {step !== 'account' && (
            <button onClick={() => void finish()} className="text-sm font-semibold text-white/50">
              {t('Skip')}
            </button>
          )}
        </div>
      )}

      <div className="relative z-10 min-h-0 flex-1">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            className="scroll-area absolute inset-0 px-6 pb-8"
            variants={{
              enter: (d: number) => ({ x: d > 0 ? '60%' : '-60%', opacity: 0, scale: 0.96 }),
              center: { x: 0, opacity: 1, scale: 1 },
              exit: (d: number) => ({ x: d > 0 ? '-40%' : '40%', opacity: 0, scale: 0.96 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            {step === 'welcome' && (
              <div className="flex h-full flex-col items-center justify-center text-center pt-safe">
                <motion.div className="no-scrollbar -mx-6 mb-10 flex max-w-[100vw] gap-1.5 overflow-x-auto px-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }}>
                  {LANGS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => useSettings.getState().update({ lang: l.id })}
                      className={`press shrink-0 rounded-full px-2.5 py-1 text-lg ${lang() === l.id ? 'bg-accent/25 ring-1 ring-accent' : 'bg-card'}`}
                      aria-label={l.name}
                    >
                      {l.flag}
                    </button>
                  ))}
                </motion.div>
                <AnimatedBarbell />
                <motion.div className="mt-8 font-display text-[56px] font-bold uppercase leading-none tracking-tight" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, type: 'spring', stiffness: 200, damping: 18 }}>
                  Gym<span className="text-grad">Log</span>
                </motion.div>
                <motion.p className="mt-3 max-w-[280px] text-[16px] text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                  {t('Log every rep. Climb the ranks. Train with friends.')}
                </motion.p>
                <motion.div className="mt-8 flex flex-wrap justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
                  {['Unlimited routines', 'Strength ranks', 'Cloud backup', 'Free forever'].map((label, k) => (
                    <motion.span key={label} className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-line" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.45 + k * 0.08, type: 'spring', stiffness: 400, damping: 15 }}>
                      {t(label)}
                    </motion.span>
                  ))}
                </motion.div>
              </div>
            )}
            {step === 'account' && (
              <div className="pt-2">
                <AccountStep onResult={afterAccount} />
              </div>
            )}
            {step === 'profile' && (
              <div className="pt-2">
                <ProfileStep />
              </div>
            )}
            {step === 'body' && (
              <div className="pt-2">
                <BodyStep />
              </div>
            )}
            {step === 'look' && (
              <div className="pt-2">
                <LookStep />
              </div>
            )}
            {step === 'start' && (
              <div className="pt-2">
                <StartStep pick={pick} setPick={setPick} />
              </div>
            )}
            {step === 'done' && <DoneStep />}
          </motion.div>
        </AnimatePresence>
      </div>

      {step !== 'account' && (
        <motion.div className="relative z-10 px-6 pt-2" style={{ paddingBottom: 'max(var(--sab), 20px)' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: step === 'welcome' ? 1.6 : 0.1 }}>
          <button
            onClick={() => (step === 'done' ? void finish() : go(1))}
            className="press grad w-full rounded-2xl py-4 font-display text-lg font-bold uppercase tracking-wider shadow-[0_10px_30px_rgb(var(--accent)/0.35)]"
          >
            {step === 'welcome' ? t('Get started') : step === 'done' ? t('Let’s lift') : step === 'start' && pick === null ? t('Skip for now') : t('Continue')}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
