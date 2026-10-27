import { motion } from 'framer-motion';
import { Copy, Download, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExerciseThumb, muscleColor } from '../components/ExerciseImage';
import { Button, Header, Page } from '../components/ui';
import { getExercise } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { decodeRoutine, routineLink, saveSharedRoutine } from '../lib/share';
import { toast } from '../state/dialog';
import type { Exercise } from '../types';
import { t } from '../i18n';

type Packed = NonNullable<Awaited<ReturnType<typeof decodeRoutine>>>;

const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;

/** Preview of a routine someone shared by link, with "Save to my routines". */
export function SharedRoutine() {
  const { code } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState<Packed | null | undefined>(undefined);
  useEffect(() => void decodeRoutine(code ?? '').then(setP), [code]);

  if (p === undefined) return <Page pushed><Header back="/workout" title={t('Shared routine')} /></Page>;
  if (p === null)
    return (
      <Page pushed>
        <Header back="/workout" title={t('Shared routine')} />
        <div className="px-6 py-16 text-center text-muted">{t('This link is broken or incomplete. Ask your friend to send it again.')}</div>
      </Page>
    );

  const custom = new Map((p.c ?? []).map((c) => [c.id, c]));
  const exOf = (id: string): Exercise => {
    const c = custom.get(id);
    return c ? { ...c, secondary: [], custom: true } : getExercise(id);
  };
  const sets = p.e.reduce((n, e) => n + e.s.length, 0);
  // On iPhone a link opens in Safari, which has separate storage from the Home Screen app
  const inSafari = !standalone() && /iPhone|iPad|iPod/.test(navigator.userAgent);

  const save = async () => {
    const r = await saveSharedRoutine(p);
    haptic('success');
    toast(`Saved “${r.name}” to your routines`);
    nav('/workout', { replace: true });
  };

  return (
    <Page pushed>
      <Header back="/workout" title={t('Shared routine')} />
      <div className="px-4 pb-12">
        <motion.div className="cut grad relative overflow-hidden p-5" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-xs font-bold uppercase tracking-widest opacity-80">{t('A friend shared a routine')}</div>
          <div className="mt-1 font-display text-3xl font-bold uppercase leading-tight">{p.n}</div>
          <div className="mt-1 text-sm opacity-85">
            {p.e.length} exercises · {sets} sets
          </div>
          {p.notes && <div className="mt-2 text-sm opacity-90">{p.notes}</div>}
        </motion.div>

        {inSafari ? (
          <div className="cut mt-3 space-y-3 bg-card p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <Link2 size={18} className="text-accent" /> {t('Open it in your Gym Log app')}
            </div>
            <p className="text-white/80">iPhone opens links in Safari, which can’t see the app on your Home Screen. Copy the link, then in the app go to Routines → <b>{t('Paste link')}</b>.</p>
            <Button
              className="w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(routineLink(code!, p.n));
                toast(t('Copied — now open Gym Log → Routines → Paste link'));
              }}
            >
              <Copy size={18} /> {t('Copy link')}
            </Button>
            <button onClick={save} className="w-full py-1 text-center text-xs text-muted underline">
              {t('Save it in this Safari copy instead')}
            </button>
          </div>
        ) : (
          <Button className="mt-3 w-full !py-3.5 text-lg" onClick={save}>
            <Download size={20} /> {t('Save to my routines')}
          </Button>
        )}

        <div className="label mb-2 mt-6">{t('Exercises')}</div>
        <div className="space-y-2">
          {p.e.map((e, i) => {
            const ex = exOf(e.id);
            return (
              <motion.div key={i} className="cut-sm flex items-center gap-3 bg-card p-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <ExerciseThumb ex={ex} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{ex.name}</div>
                  <div className="text-xs" style={{ color: muscleColor(ex.muscle) }}>
                    {ex.muscle}
                  </div>
                </div>
                <div className="text-right font-display text-lg font-bold">
                  {e.s.length}
                  <span className="text-xs font-normal text-muted"> {t('sets')}</span>
                  {e.s[0]?.[2] ? <div className="text-[11px] font-normal text-muted">× {e.s[0][2]} reps</div> : null}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
