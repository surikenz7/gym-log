import { useEffect, useSyncExternalStore } from 'react';
import { PUSH_URL } from '../cloud/config';
import { lang } from '../i18n';

/**
 * Songs for stories and notes: title, artist, cover and a 30-second preview clip that plays in an
 * <audio> element. Search goes to Deezer first (free, no key; JSONP, so it works straight from an
 * iPhone with no relay), then to Apple's iTunes Search API as the fallback.
 */
export interface Song {
  id: number;
  title: string;
  artist: string;
  /** cover image, ~250–300 px */
  art: string;
  /** 30 s preview (mp3 / m4a) */
  url: string;
  /** Deezer track id: Deezer preview links expire after a few minutes, so they're fetched again to play */
  dz?: number;
}

const STORE: Record<string, string> = {
  cs: 'cz',
  sk: 'sk',
  pl: 'pl',
  de: 'de',
  es: 'es',
  fr: 'fr',
  it: 'it',
  pt: 'pt',
  uk: 'ua',
};

interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  previewUrl?: string;
}
interface DeezerTrack {
  id: number;
  title: string;
  preview?: string;
  artist?: { name: string };
  album?: { cover_medium?: string };
}

let seq = 0;
/** Deezer's API sends no CORS headers but supports JSONP (a <script> tag), which needs none. */
function jsonp<T>(url: string, signal?: AbortSignal, ms = 9000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cb = `__gl_dz${seq++}`;
    const w = window as unknown as Record<string, unknown>;
    const s = document.createElement('script');
    const done = () => {
      w[cb] = () => {}; // a late answer after a timeout / abort goes nowhere
      s.remove();
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => (done(), reject(new DOMException('Aborted', 'AbortError')));
    const timer = setTimeout(() => (done(), reject(new Error('timeout'))), ms);
    w[cb] = (d: T) => (done(), resolve(d));
    s.onerror = () => (done(), reject(new Error('search failed')));
    s.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${cb}`;
    signal?.addEventListener('abort', onAbort);
    document.head.appendChild(s);
  });
}

async function deezer(term: string, signal?: AbortSignal): Promise<Song[]> {
  const res = await jsonp<{ data?: DeezerTrack[]; error?: unknown }>(`https://api.deezer.com/search/track?limit=25&q=${encodeURIComponent(term)}`, signal);
  if (!res.data) throw new Error('search failed');
  return res.data
    .filter((r) => r.preview)
    .map((r) => ({
      id: r.id,
      dz: r.id,
      title: r.title,
      artist: r.artist?.name ?? '',
      art: r.album?.cover_medium ?? '',
      url: r.preview!,
    }));
}

/*
 * On iPhones Apple redirects the search to the Music app (musics://), so it goes through our
 * Cloudflare relay; calling Apple directly only works on computers / Android.
 */
async function itunes(term: string, signal?: AbortSignal): Promise<Song[]> {
  const qs = `country=${STORE[lang()] ?? 'us'}&term=${encodeURIComponent(term)}`;
  const urls = [...(PUSH_URL ? [`${PUSH_URL}/music?${qs}`] : []), `https://itunes.apple.com/search?media=music&entity=song&limit=25&${qs}`];
  let error: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal });
      if (res.ok)
        return ((await res.json()) as { results: ITunesTrack[] }).results
          .filter((r) => r.previewUrl)
          .map((r) => ({
            id: r.trackId,
            title: r.trackName,
            artist: r.artistName,
            art: (r.artworkUrl100 ?? '').replace('100x100bb', '300x300bb'),
            url: r.previewUrl!,
          }));
      error = new Error('search failed');
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      error = e;
    }
  }
  throw error;
}

export async function searchSongs(q: string, signal?: AbortSignal): Promise<Song[]> {
  const term = q.trim();
  if (!term) return [];
  try {
    return await deezer(term, signal);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    return itunes(term, signal);
  }
}

/** A Deezer preview link is signed with an expiry (exp=unix seconds); ask for a new one when it's close. */
const expired = (url: string) => {
  const m = /exp=(\d+)/.exec(url);
  return !!m && Number(m[1]) * 1000 < Date.now() + 60_000;
};
const fresh = new Map<number, string>();
async function previewUrl(song: Song): Promise<string> {
  if (!song.dz) return song.url;
  const known = fresh.get(song.dz) ?? song.url;
  if (!expired(known)) return known;
  const t = await jsonp<DeezerTrack>(`https://api.deezer.com/track/${song.dz}`);
  if (!t.preview) throw new Error('no preview');
  fresh.set(song.dz, t.preview);
  return t.preview;
}

/*
 * One shared player, so only one preview plays at a time. iOS only lets audio start from a tap;
 * once the element has played from a tap, later play() calls (next story) are allowed too.
 */
let audio: HTMLAudioElement | null = null;
let current: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export function playSong(song: Song | null | undefined, loop = true) {
  if (!song) return stopSong();
  const a = (audio ??= new Audio());
  const fail = () => {
    if (current !== song.id) return;
    current = null;
    emit();
  };
  const start = (src: string) => {
    if (current !== song.id) return; // something else was picked meanwhile
    if (a.dataset.src !== src) {
      a.src = src;
      a.dataset.src = src;
    }
    a.loop = loop;
    a.onended = fail;
    void a.play().catch(fail);
  };
  const same = current === song.id;
  current = song.id;
  emit();
  if (same && a.dataset.src) return start(a.dataset.src);
  if (song.dz && expired(fresh.get(song.dz) ?? song.url)) {
    // the new link comes a moment later, after the tap — play silence now so iOS still allows it
    a.src = SILENCE;
    a.dataset.src = '';
    void a.play().catch(() => {});
    previewUrl(song).then(start, fail);
  } else start(fresh.get(song.dz ?? -1) ?? song.url);
}

/** Call from a tap that opens something with music, so iOS lets it play a moment later. */
export function primeAudio() {
  audio ??= new Audio();
  if (current != null) return;
  audio.src = SILENCE;
  audio.dataset.src = '';
  void audio.play().catch(() => {});
}

export function stopSong() {
  audio?.pause();
  current = null;
  emit();
}

export function pauseSong(paused: boolean) {
  if (!audio || current == null) return;
  if (paused) audio.pause();
  else void audio.play().catch(() => {});
}

/** id of the song playing now (re-renders when it changes). */
export function usePlaying() {
  return useSyncExternalStore(
    (f) => (listeners.add(f), () => listeners.delete(f)),
    () => current,
  );
}

/** Stops the preview when the component using it goes away. */
export function useStopOnUnmount() {
  useEffect(() => () => stopSong(), []);
}
