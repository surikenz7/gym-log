import { create } from 'zustand';
import { db, getKv, setKv } from '../db/db';
import { cloudEnabled, LOGIN_DOMAIN } from './config';
import { firebase } from './firebase';
import { dedupeTotal, describeDedupe, type DedupeResult } from './dedupe';
import { resetSyncState, syncNow } from './sync';

/** Tell the user and take back progress that only existed because of the duplicates. */
export async function afterDedupe(r: DedupeResult) {
  const [{ toast }, { revokeHistoryDecorations }] = await Promise.all([import('../state/dialog'), import('../screens/Decorations')]);
  await revokeHistoryDecorations();
  toast(`🧹 ${describeDedupe(r)}`);
}

const KV_ACCOUNT = 'cloudAccount';

export type CloudStatus = 'off' | 'loading' | 'signedOut' | 'signedIn';

interface AccountState {
  status: CloudStatus;
  uid: string | null;
  nick: string | null;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
  following: string[];
}

export const useAccount = create<AccountState>(() => ({
  status: cloudEnabled ? 'loading' : 'off',
  uid: null,
  nick: null,
  syncing: false,
  lastSync: null,
  error: null,
  following: [],
}));

export const NICK_RE = /^[a-zA-Z0-9_.]{3,20}$/;
const emailOf = (nick: string) => `${nick.trim().toLowerCase()}@${LOGIN_DOMAIN}`;

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('email-already-in-use')) return 'That nickname is taken';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Wrong nickname or password';
  if (code.includes('weak-password')) return 'Password needs at least 6 characters';
  if (code.includes('too-many-requests')) return 'Too many tries — wait a minute';
  if (code.includes('network')) return 'No internet connection';
  return (e as Error)?.message ?? 'Something went wrong';
}

/** Restores the saved session instantly (no network needed), then confirms it with Firebase. */
export async function initAccount() {
  if (!cloudEnabled) return;
  const saved = await getKv<{ uid: string; nick: string }>(KV_ACCOUNT);
  if (saved) useAccount.setState({ status: 'signedIn', uid: saved.uid, nick: saved.nick });
  else useAccount.setState({ status: 'signedOut' });
  if (!saved) return;
  try {
    const { auth, authApi } = await firebase();
    authApi.onAuthStateChanged(auth, (user) => {
      if (!user) {
        void db.kv.delete(KV_ACCOUNT);
        useAccount.setState({ status: 'signedOut', uid: null, nick: null });
      }
    });
  } catch {
    /* offline: keep the cached session */
  }
}

async function remember(uid: string, nick: string) {
  await setKv(KV_ACCOUNT, { uid, nick });
  useAccount.setState({ status: 'signedIn', uid, nick, error: null });
}

export async function signUp(nick: string, password: string) {
  if (!NICK_RE.test(nick)) throw new Error('Nickname: 3–20 letters, numbers, _ or .');
  try {
    const { auth, authApi, db: fdb, fs } = await firebase();
    const cred = await authApi.createUserWithEmailAndPassword(auth, emailOf(nick), password);
    await fs.setDoc(fs.doc(fdb, 'users', cred.user.uid), { nick: nick.trim(), nickLower: nick.trim().toLowerCase(), following: [], createdAt: Date.now() }, { merge: true });
    await resetSyncState();
    await remember(cred.user.uid, nick.trim());
  } catch (e) {
    throw new Error(friendly(e));
  }
}

export async function signIn(nick: string, password: string) {
  try {
    const { auth, authApi, db: fdb, fs } = await firebase();
    const cred = await authApi.signInWithEmailAndPassword(auth, emailOf(nick), password);
    const prof = await fs.getDoc(fs.doc(fdb, 'users', cred.user.uid));
    await resetSyncState();
    await remember(cred.user.uid, (prof.data()?.nick as string) ?? nick.trim());
  } catch (e) {
    throw new Error(friendly(e));
  }
}

export async function signOut() {
  try {
    const { auth, authApi } = await firebase();
    await authApi.signOut(auth);
  } catch {
    /* ignore */
  }
  await db.kv.delete(KV_ACCOUNT);
  await resetSyncState();
  useAccount.setState({ status: 'signedOut', uid: null, nick: null, lastSync: null, following: [] });
}

let running: Promise<void> | null = null;
let again = false;

/** Runs a sync (coalescing overlapping requests). `profile` is the public summary to publish. */
export function requestSync(profile: Record<string, unknown> | null) {
  const { uid, status } = useAccount.getState();
  if (status !== 'signedIn' || !uid || !navigator.onLine) return;
  if (running) {
    again = true;
    return;
  }
  running = (async () => {
    useAccount.setState({ syncing: true });
    try {
      // make sure Firebase has restored the login before touching protected data
      const { auth } = await firebase();
      await auth.authStateReady();
      if (!auth.currentUser) return;
      const res = await syncNow(uid, profile);
      if (dedupeTotal(res.deduped)) await afterDedupe(res.deduped);
      const { getProfile } = await import('./social');
      const me = await getProfile(uid);
      useAccount.setState({ lastSync: Date.now(), error: null, following: me?.following ?? [] });
    } catch (e) {
      useAccount.setState({ error: friendly(e) });
    } finally {
      useAccount.setState({ syncing: false });
      running = null;
      if (again) {
        again = false;
        requestSync(profile);
      }
    }
  })();
}
