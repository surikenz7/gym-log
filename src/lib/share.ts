import { db } from '../db/db';
import type { Exercise, Routine, SetType, WExercise } from '../types';
import { getExercise, useLibrary } from './exercises';
import { uid } from './id';

/**
 * Routines travel inside the link itself (no server needed):
 *   https://…/gym-log/#/r/<code>
 * The code is compact JSON, deflate-compressed where the browser supports it, then base64url.
 */

type PackedSet = [SetType, number | null, number | null, number | null, number | null];
interface Packed {
  v: 1;
  n: string;
  notes?: string;
  e: { id: string; rest?: number | null; ss?: string | null; note?: string; s: PackedSet[] }[];
  /** custom exercises the routine uses, so the receiver gets them too */
  c?: Pick<Exercise, 'id' | 'name' | 'type' | 'muscle' | 'equipment'>[];
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export function packRoutine(r: Pick<Routine, 'name' | 'notes' | 'exercises'>): Packed {
  const custom = new Map<string, Packed['c'] extends (infer T)[] | undefined ? T : never>();
  for (const e of r.exercises) {
    const ex = getExercise(e.exerciseId);
    if (ex.custom) custom.set(ex.id, { id: ex.id, name: ex.name, type: ex.type, muscle: ex.muscle, equipment: ex.equipment });
  }
  return {
    v: 1,
    n: r.name,
    ...(r.notes ? { notes: r.notes } : {}),
    e: r.exercises.map((e) => ({
      id: e.exerciseId,
      ...(e.restSec != null ? { rest: e.restSec } : {}),
      ...(e.supersetId ? { ss: e.supersetId.slice(0, 4) } : {}),
      ...(e.notes ? { note: e.notes } : {}),
      s: e.sets.map((s): PackedSet => [s.type, s.weight ?? s.ph?.weight ?? null, s.reps ?? s.ph?.reps ?? null, s.duration ?? s.ph?.duration ?? null, s.distance ?? s.ph?.distance ?? null]),
    })),
    ...(custom.size ? { c: [...custom.values()] } : {}),
  };
}

export async function encodeRoutine(r: Pick<Routine, 'name' | 'notes' | 'exercises'>): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(packRoutine(r)));
  if (typeof CompressionStream !== 'undefined') return 'z' + b64url(await pipe(raw, new CompressionStream('deflate-raw')));
  return 'j' + b64url(raw);
}

export async function decodeRoutine(code: string): Promise<Packed | null> {
  try {
    const kind = code[0];
    let bytes = fromB64url(code.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') return null;
    const p = JSON.parse(new TextDecoder().decode(bytes)) as Packed;
    return p?.v === 1 && Array.isArray(p.e) ? p : null;
  } catch {
    return null;
  }
}

/** "Push Day 💪" → "Push-Day" (readable part of the link) */
export function slugify(name: string) {
  return (
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'routine'
  );
}

export const routineLink = (code: string, name?: string) => `${location.origin}${import.meta.env.BASE_URL}#/r/${name ? `${slugify(name)}/` : ''}${code}`;

/** Pulls the code out of a pasted link (with or without the name part) or a bare code. */
export function codeFromText(text: string): string | null {
  const m = text.trim().match(/#\/r\/(?:[A-Za-z0-9-]+\/)?([zj][A-Za-z0-9_-]+)/) ?? text.trim().match(/^([zj][A-Za-z0-9_-]{8,})$/);
  return m ? m[1] : null;
}

export function unpackExercises(p: Packed): WExercise[] {
  const ss = new Map<string, string>();
  return p.e.map((e) => ({
    id: uid(),
    exerciseId: e.id,
    restSec: e.rest ?? null,
    notes: e.note,
    supersetId: e.ss ? (ss.get(e.ss) ?? ss.set(e.ss, uid()).get(e.ss)!) : null,
    sets: e.s.map(([type, weight, reps, duration, distance]) => ({ id: uid(), type, weight, reps, duration, distance, done: false })),
  }));
}

/** Saves a received routine (and any custom exercises it needs). */
export async function saveSharedRoutine(p: Packed, folderId: string | null = null) {
  for (const c of p.c ?? []) {
    if (!(await db.exercises.get(c.id))) await db.exercises.put({ ...c, secondary: [], custom: true });
  }
  if (p.c?.length) await useLibrary.getState().reload();
  const now = Date.now();
  const routine: Routine = { id: uid(), name: p.n, notes: p.notes, folderId, order: now, createdAt: now, updatedAt: now, exercises: unpackExercises(p) };
  await db.routines.add(routine);
  return routine;
}

/** Share sheet (iOS) with the link, or copy it as a fallback. Returns what happened. */
export async function shareRoutine(r: Pick<Routine, 'name' | 'notes' | 'exercises'>): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = routineLink(await encodeRoutine(r), r.name);
  const text = `💪 ${r.name} — my Gym Log routine`;
  const { useSettings } = await import('../state/settings');
  useSettings.getState().update({ shared: true });
  if (navigator.share) {
    try {
      await navigator.share({ title: r.name, text, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
