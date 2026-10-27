import { firebase } from './firebase';
import { PUSH_URL, VAPID_PUBLIC } from './config';

/*
 * Push notifications for new messages, also when the app is closed.
 * The phone's push subscription is stored in Firestore (pushSubs/{uid}); after sending a message the
 * app pings a small Cloudflare Worker (push-worker/) which encrypts and delivers the notification.
 * On iPhone this works only for the app added to the Home Screen (iOS 16.4+).
 */

export type PushState = 'on' | 'off' | 'denied' | 'needs-install' | 'unsupported';

export const pushConfigured = !!PUSH_URL;

const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIos() && !standalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

const keyOf = async (endpoint: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

async function save(uid: string, sub: PushSubscription) {
  const j = sub.toJSON();
  const { db, fs } = await firebase();
  await fs.setDoc(fs.doc(db, 'pushSubs', uid), { subs: { [await keyOf(sub.endpoint)]: { endpoint: sub.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth, at: Date.now() } } }, { merge: true });
}

const urlKey = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Asks for permission (must be called from a tap) and registers this phone for notifications. */
export async function enablePush(uid: string): Promise<PushState> {
  if ((await Notification.requestPermission()) !== 'granted') return pushState();
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlKey(VAPID_PUBLIC) }));
  await save(uid, sub);
  return 'on';
}

export async function disablePush(uid: string) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const key = await keyOf(sub.endpoint);
  await sub.unsubscribe().catch(() => {});
  const { db, fs } = await firebase();
  await fs.updateDoc(fs.doc(db, 'pushSubs', uid), { [`subs.${key}`]: fs.deleteField() }).catch(() => {});
}

/** On sign-in: keeps the stored subscription current (browsers rotate them now and then). */
export async function refreshPush(uid: string) {
  if (!pushConfigured || (await pushState()) !== 'on') return;
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (sub) await save(uid, sub).catch(() => {});
}

/** Tells the relay that a message was just sent in this chat, so the other person gets a notification. */
export async function pingChat(chat: string) {
  if (!pushConfigured) return;
  const token = await (await firebase()).auth.currentUser?.getIdToken();
  if (!token) return;
  await fetch(`${PUSH_URL}/chat`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ chat }), keepalive: true }).catch(() => {});
}
