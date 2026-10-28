/*
 * Gym Log push relay — a free Cloudflare Worker that sends Web Push notifications for new chat messages.
 *
 * It also relays the song search for stories and notes (GET /music?term=…&country=…): Apple's iTunes
 * Search API redirects requests from iPhones to the Music app (musics://), so the app can't call it
 * directly there. Only the search goes through here; the 30-second previews play straight from Apple.
 *
 * The app calls POST /chat { chat } right after sending a message, with the sender's Firebase ID token.
 * The worker reads the chat and the recipient's push subscriptions from Firestore *with that token*, so
 * the security rules decide what it may see: only a member of the chat gets anything sent, and the
 * notification text comes from the chat itself, not from the request.
 *
 * Secrets / vars (see wrangler.toml and CLOUD_SETUP.md):
 *   VAPID_PRIVATE  JWK of the P-256 private key   (wrangler secret put VAPID_PRIVATE)
 *   VAPID_PUBLIC   the public key, base64url       (wrangler.toml)
 *   PROJECT_ID     Firebase project id             (wrangler.toml)
 *   APP_URL        where a tapped notification opens
 */

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) out.set(p, (i += p.length) - p.length);
  return out;
};

const ALLOWED = ['https://surikenz7.github.io', 'http://localhost:5173', 'http://localhost:4173'];
const cors = (origin) => ({
  'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
});

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') ?? '';
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/music') return music(url, origin, reply);
    if (req.method !== 'POST' || url.pathname !== '/chat') return reply({ error: 'not found' }, 404);

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    const { chat } = await req.json().catch(() => ({}));
    if (!token || typeof chat !== 'string' || !/^[\w-]+$/.test(chat)) return reply({ error: 'bad request' }, 400);

    // Firestore accepts the token only if Google signed it, and only shows the chat to its members.
    const doc = await firestoreGet(env, token, `chats/${chat}`);
    if (!doc) return reply({ error: 'no access' }, 403);
    const me = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).user_id;
    const last = doc.last;
    if (!last || last.from !== me || Date.now() - last.at > 60_000) return reply({ sent: 0 });
    const to = doc.members.find((m) => m !== me);
    if (!to) return reply({ sent: 0 });

    const subs = Object.values((await firestoreGet(env, token, `pushSubs/${to}`))?.subs ?? {});
    const nick = doc.nicks?.[me] ?? 'Gym Log';
    const payload = JSON.stringify({ title: `@${nick}`, body: last.text, tag: `chat-${chat}`, url: `${env.APP_URL}#/chat/${me}` });
    const results = await Promise.all(subs.map((s) => sendPush(env, s, payload).catch(() => 0)));
    return reply({ sent: results.filter((r) => r >= 200 && r < 300).length });
  },
};

/* ---------------- song search (iTunes) ---------------- */

async function music(url, origin, reply) {
  const term = (url.searchParams.get('term') ?? '').trim().slice(0, 80);
  const country = /^[a-z]{2}$/.test(url.searchParams.get('country') ?? '') ? url.searchParams.get('country') : 'us';
  if (!term) return reply({ results: [] });
  const api = `https://itunes.apple.com/search?media=music&entity=song&limit=25&country=${country}&term=${encodeURIComponent(term)}`;
  // same search from anyone → answer from Cloudflare's cache for a day
  const cache = caches.default;
  const key = new Request(api);
  let res = await cache.match(key);
  if (!res) {
    const r = await fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GymLog/1.0' } });
    if (!r.ok) return reply({ error: 'search failed' }, 502);
    const results = ((await r.json()).results ?? [])
      .filter((t) => t.previewUrl)
      .map((t) => ({ trackId: t.trackId, trackName: t.trackName, artistName: t.artistName, artworkUrl100: t.artworkUrl100, previewUrl: t.previewUrl }));
    res = new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' } });
    await cache.put(key, res.clone());
  }
  return new Response(res.body, { headers: { ...cors(origin), 'Content-Type': 'application/json' } });
}

/* ---------------- Firestore REST (document JSON → plain values) ---------------- */

async function firestoreGet(env, token, path) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/(default)/documents/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return plain({ mapValue: { fields: (await res.json()).fields ?? {} } });
}

function plain(v) {
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, plain(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(plain);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  return null;
}

/* ---------------- Web Push: VAPID (RFC 8292) + aes128gcm payload encryption (RFC 8291) ---------------- */

async function vapidHeader(env, endpoint) {
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://surikenz7.github.io/gym-log/' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

async function encrypt(sub, payload) {
  const uaPublic = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const peer = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, local.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // one record: payload + 0x02 delimiter (last record), no padding
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(payload), new Uint8Array([2]))));
  const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic);
  return concat(header, cipher);
}

async function sendPush(env, sub, payload) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(env, sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body: await encrypt(sub, payload),
  });
  return res.status;
}
