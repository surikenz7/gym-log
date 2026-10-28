import { useEffect, useSyncExternalStore } from 'react';
import { PUSH_URL } from '../cloud/config';
import { lang } from '../i18n';

/**
 * Songs for stories and notes, from Apple's free iTunes Search API (no key, CORS-enabled):
 * title, artist, cover and a 30-second preview clip that plays in an <audio> element.
 */
export interface Song {
  id: number;
  title: string;
  artist: string;
  /** cover image, 300×300 */
  art: string;
  /** 30 s preview (m4a) */
  url: string;
}

const STORE: Record<string, string> = { cs: 'cz', sk: 'sk', pl: 'pl', de: 'de', es: 'es', fr: 'fr', it: 'it', pt: 'pt', uk: 'ua' };

interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100?: string;
  previewUrl?: string;
}

/*
 * On iPhones Apple redirects the search to the Music app (musics://), so it goes through our
 * Cloudflare relay; calling Apple directly is only the fallback (works on computers / Android).
 */
async function fetchTracks(term: string, signal?: AbortSignal): Promise<ITunesTrack[]> {
  const qs = `country=${STORE[lang()] ?? 'us'}&term=${encodeURIComponent(term)}`;
  const urls = [...(PUSH_URL ? [`${PUSH_URL}/music?${qs}`] : []), `https://itunes.apple.com/search?media=music&entity=song&limit=25&${qs}`];
  let error: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal });
      if (res.ok) return ((await res.json()) as { results: ITunesTrack[] }).results;
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
  const data = { results: await fetchTracks(term, signal) };
  return data.results
    .filter((r) => r.previewUrl)
    .map((r) => ({ id: r.trackId, title: r.trackName, artist: r.artistName, art: (r.artworkUrl100 ?? '').replace('100x100bb', '300x300bb'), url: r.previewUrl! }));
}

/*
 * One shared player, so only one preview plays at a time. iOS only lets audio start from a tap;
 * once the element has played from a tap, later play() calls (next story) are allowed too.
 */
let audio: HTMLAudioElement | null = null;
let current: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

export function playSong(song: Song | null | undefined, loop = true) {
  if (!song) return stopSong();
  audio ??= new Audio();
  if (current !== song.id) {
    audio.src = song.url;
    current = song.id;
  }
  audio.loop = loop;
  audio.onended = () => {
    current = null;
    emit();
  };
  void audio.play().catch(() => {
    current = null;
    emit();
  });
  emit();
}

const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
/** Call from a tap that opens something with music, so iOS lets it play a moment later. */
export function primeAudio() {
  audio ??= new Audio();
  if (current != null) return;
  audio.src = SILENCE;
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
