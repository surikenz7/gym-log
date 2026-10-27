import { firebaseConfig } from './config';

/** Firebase is loaded only when an account feature is used, so it doesn't slow down app start. */
let loading: Promise<Firebase> | null = null;

async function load() {
  const [{ initializeApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const app = initializeApp(firebaseConfig);
  // stays signed in on this device until "Log out"
  const a = auth.initializeAuth(app, { persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence] });
  return { app, auth: a, authApi: auth, db: fs.getFirestore(app), fs };
}

export type Firebase = Awaited<ReturnType<typeof load>>;

export function firebase(): Promise<Firebase> {
  loading ??= load();
  return loading;
}
