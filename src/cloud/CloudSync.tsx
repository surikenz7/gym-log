import { useEffect, useRef } from 'react';
import { db, KV_SETTINGS } from '../db/db';
import { DECORATIONS } from '../lib/decorations';
import { levelFromXp, levelTitle } from '../lib/progress';
import { useJourney, useRanks } from '../lib/useProgress';
import { useSettings } from '../state/settings';
import { initAccount, requestSync, useAccount } from './account';

let dirty: (() => void) | null = null;
let hooked = false;

/** Marks local data as changed whenever a synced table is written. */
function hookTables() {
  if (hooked) return;
  hooked = true;
  for (const t of [db.workouts, db.routines, db.folders, db.exercises, db.measures]) {
    t.hook('creating', () => void dirty?.());
    t.hook('updating', () => void dirty?.());
    t.hook('deleting', () => void dirty?.());
  }
  // of the key-value table only the settings are synced (not the running workout or sync state)
  db.kv.hook('creating', (key) => void (key === KV_SETTINGS && dirty?.()));
  db.kv.hook('updating', (_m, key) => void (key === KV_SETTINGS && dirty?.()));
}

/** Keeps the account restored and the cloud copy up to date (a few seconds after each change). */
export function CloudSync() {
  const status = useAccount((s) => s.status);
  const nick = useAccount((s) => s.nick);
  const journey = useJourney();
  const { data: ranks } = useRanks();
  const settings = useSettings();
  const profile = useRef<Record<string, unknown> | null>(null);

  useEffect(() => void initAccount(), []);

  // public summary shown on your profile to people who follow you
  useEffect(() => {
    if (!journey || !nick) return;
    const lvl = levelFromXp(journey.xp).level;
    profile.current = {
      nick,
      nickLower: nick.toLowerCase(),
      avatar: settings.avatar ?? null,
      deco: settings.deco ?? null,
      theme: settings.theme,
      level: lvl,
      title: levelTitle(lvl),
      overall: ranks?.overall ?? null,
      workouts: journey.totals.workouts,
      streak: journey.totals.streak,
      trophies: journey.unlocked.size,
      volume: Math.round(journey.totals.volume),
      decos: (settings.decos ?? []).filter((d) => DECORATIONS.some((x) => x.id === d)).length,
    };
  }, [journey, ranks?.overall, nick, settings.avatar, settings.deco, settings.theme, settings.decos]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    hookTables();
    let timer = 0;
    const later = (ms: number) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => requestSync(profile.current), ms);
    };
    dirty = () => later(4000);
    later(1500);
    const onVisible = () => document.visibilityState === 'visible' && later(800);
    document.addEventListener('visibilitychange', onVisible);
    addEventListener('online', onVisible);
    return () => {
      dirty = null;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener('online', onVisible);
    };
  }, [status]);

  // republish the profile when level / rank / picture change
  useEffect(() => {
    if (status === 'signedIn' && profile.current) {
      const t = setTimeout(() => requestSync(profile.current), 3000);
      return () => clearTimeout(t);
    }
  }, [status, journey, ranks?.overall, settings.avatar, settings.deco]);

  return null;
}
