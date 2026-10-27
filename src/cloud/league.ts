import { subMonths } from 'date-fns';
import { db } from '../db/db';
import { t } from '../i18n';
import { fairness, leagueSummary, monthId, placeOf, statsOf } from '../lib/compete';
import { typeOf } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { fanfare } from '../lib/sound';
import { toast } from '../state/dialog';
import { useSettings } from '../state/settings';

let checking = false;

/**
 * Once a month (from the 2nd, so friends have had a day to sync) records where you finished in
 * last month's friends league. Places 1–3 are medals; 1st also unlocks the Monthly Champion decoration.
 */
export async function settleLeague(uid: string) {
  const now = new Date();
  const lm = monthId(subMonths(now, 1));
  if (checking || now.getDate() < 2 || (useSettings.getState().medals ?? []).some((m) => m.m === lm)) return;
  checking = true;
  try {
    const so = await import('./social');
    const [me, followers] = await Promise.all([so.getProfile(uid), so.getFollowers(uid)]);
    const ids = [...new Set([...(me?.following ?? []), ...followers.filter((f) => f.status === 'accepted').map((f) => f.uid)])].filter((x) => x !== uid);
    const friends = await so.getProfiles(ids);
    const workouts = await db.workouts.toArray();
    const measures = await db.measures.orderBy('date').reverse().toArray();
    const s = useSettings.getState();
    const mine = leagueSummary(workouts, fairness(measures.find((m) => m.weight)?.weight, s.sex), typeOf, now).pm;
    const rows = [{ uid, pts: mine.pts }, ...friends.map((p) => ({ uid: p.uid, pts: statsOf(p, lm)?.pts ?? 0 }))];
    const place = placeOf(rows, uid);
    const of = rows.filter((r) => r.pts > 0).length;
    const latest = useSettings.getState();
    if ((latest.medals ?? []).some((m) => m.m === lm)) return;
    latest.update({ medals: [...(latest.medals ?? []), { m: lm, place, of }] });
    if (place >= 1 && place <= 3) {
      haptic('success');
      fanfare();
      toast(place === 1 ? t('🏆 You won last month’s friends league!') : t('🏅 You finished #{n} in last month’s friends league', { n: place }));
    }
  } finally {
    checking = false;
  }
}
