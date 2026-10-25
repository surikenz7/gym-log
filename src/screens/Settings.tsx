import { motion } from 'framer-motion';
import { Check, ChevronRight, Download, ImageDown, Shield, Trash2, Upload, Watch } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { REST_OPTIONS } from '../components/ExerciseCard';
import { RankSetup } from '../components/RankParts';
import { Header, Page, Sheet } from '../components/ui';
import { db } from '../db/db';
import { exportBackup, importBackup } from '../import/backup';
import { BUILTIN, imageUrl, useLibrary } from '../lib/exercises';
import { THEMES } from '../lib/theme';
import { fmtDurationLong, fmtNum, kgTo } from '../lib/units';
import { useLatestBodyweight } from '../lib/useProgress';
import type { ThemeId } from '../types';
import { AvatarPicker } from './Profile';
import { confirmDialog, toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import { useWorkout } from '../state/workout';

function Section({ title, children, foot }: { title: string; children: ReactNode; foot?: string }) {
  return (
    <div>
      <div className="label px-4 pb-1.5">{title}</div>
      <div className="divide-y divide-line overflow-hidden cut bg-card">{children}</div>
      {foot && <div className="px-4 pt-1.5 text-xs text-muted">{foot}</div>}
    </div>
  );
}

function Row({ label, children, onClick, icon }: { label: ReactNode; children?: ReactNode; onClick?: () => void; icon?: ReactNode }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${onClick ? 'active:bg-card2' : ''}`}>
      {icon && <span className="text-accent">{icon}</span>}
      <span className="flex-1">{label}</span>
      {children}
    </C>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative h-[31px] w-[51px] rounded-full transition-colors ${on ? 'bg-done' : 'bg-line'}`}>
      <motion.span className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow" animate={{ left: on ? 22 : 2 }} transition={{ type: 'spring', stiffness: 700, damping: 35 }} />
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="relative flex rounded-lg bg-card2 p-0.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`relative z-10 min-w-[52px] px-3 py-1 text-sm font-semibold ${value === o ? 'text-ink' : ''}`}>
          {value === o && <motion.span layoutId={`seg-${options.join()}`} className="absolute inset-0 -z-10 rounded-md bg-accent" />}
          {o}
        </button>
      ))}
    </div>
  );
}

async function downloadImages(onProgress: (done: number, total: number) => void) {
  const urls = BUILTIN.filter((e) => e.img).flatMap((e) => [imageUrl(e.img!, 0), imageUrl(e.img!, 1)]);
  const cache = await caches.open('exercise-images');
  let done = 0;
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++];
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) await cache.put(url, res);
        }
      } catch {
        /* offline or blocked; skip */
      }
      onProgress(++done, urls.length);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

export function Settings() {
  const s = useSettings();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<{ done: number; total: number } | null>(null);
  const [rankSheet, setRankSheet] = useState(false);
  const bw = useLatestBodyweight();
  const [storage, setStorage] = useState<{ persisted: boolean; usage: number } | null>(null);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;

  useEffect(() => {
    void (async () => {
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      const est = await navigator.storage?.estimate?.();
      setStorage({ persisted, usage: est?.usage ?? 0 });
    })();
  }, [img]);

  return (
    <Page pushed>
      <Header back title="Settings" />
      <div className="space-y-6 px-4 pb-12 pt-2">
        <Section title="Profile">
          <div className="flex items-center gap-4 px-4 py-3">
            <AvatarPicker size={56} />
            <div className="text-sm text-muted">Tap to add a profile picture from your photos or camera.</div>
          </div>
          <Row label="Name">
            <input
              value={s.name}
              onChange={(e) => s.update({ name: e.target.value })}
              placeholder="Your name"
              className="w-40 bg-transparent text-right outline-none placeholder:text-muted"
            />
          </Row>
          <Row label="Sex & bodyweight" icon={<Shield size={20} />} onClick={() => setRankSheet(true)}>
            <span className="text-sm text-muted">
              <span className="capitalize">{s.sex ?? 'Not set'}</span>
              {bw ? ` · ${fmtNum(kgTo(bw, s.weightUnit))} ${s.weightUnit}` : ''}
            </span>
            <ChevronRight size={18} className="text-muted" />
          </Row>
        </Section>

        <Section title="Look" foot="Changes the accent, highlights, background and cards across the whole app.">
          <div className="grid grid-cols-4 gap-2 p-3">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const t = THEMES[id];
              const on = s.theme === id;
              return (
                <button key={id} onClick={() => s.update({ theme: id })} className="press flex flex-col items-center gap-1.5">
                  <span
                    className="cut-sm relative flex h-16 w-full flex-col justify-end overflow-hidden p-1.5"
                    style={{ background: t.bg, boxShadow: on ? `inset 0 0 0 2px ${t.accent}` : `inset 0 0 0 1px ${t.line}` }}
                  >
                    <span className="absolute inset-x-0 top-0 h-6" style={{ background: `linear-gradient(120deg, ${t.accent}, ${t.accent2})` }} />
                    <span className="relative flex gap-1">
                      <span className="h-3 flex-1" style={{ background: t.card }} />
                      <span className="h-3 w-3" style={{ background: t.done }} />
                    </span>
                    {on && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full" style={{ background: t.ink, color: t.accent }}>
                        <Check size={11} strokeWidth={4} />
                      </span>
                    )}
                  </span>
                  <span className={`font-display text-[11px] font-semibold uppercase tracking-wider ${on ? 'text-white' : 'text-muted'}`}>{t.name}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Units">
          <Row label="Weight">
            <Segmented value={s.weightUnit} options={['kg', 'lbs']} onChange={(weightUnit) => s.update({ weightUnit })} />
          </Row>
          <Row label="Distance">
            <Segmented value={s.distanceUnit} options={['km', 'mi']} onChange={(distanceUnit) => s.update({ distanceUnit })} />
          </Row>
        </Section>

        <Section title="Workout" foot="The rest timer plays a sound when it’s done while the app is open. Vibration works on iOS 18 and newer.">
          <Row label="Default rest timer">
            <select value={s.defaultRest} onChange={(e) => s.update({ defaultRest: Number(e.target.value) })} className="appearance-none rounded-lg bg-card2 px-3 py-1.5 text-sm font-semibold outline-none">
              {REST_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r ? fmtDurationLong(r) : 'Off'}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Rest timer sound">
            <Toggle on={s.sound} onChange={(sound) => s.update({ sound })} />
          </Row>
          <Row label="Keep screen on during workout">
            <Toggle on={s.keepAwake} onChange={(keepAwake) => s.update({ keepAwake })} />
          </Row>
          <Row label="Vibration feedback">
            <Toggle on={s.haptics} onChange={(haptics) => s.update({ haptics })} />
          </Row>
          <Row label="Show RPE column">
            <Toggle on={s.showRpe} onChange={(showRpe) => s.update({ showRpe })} />
          </Row>
        </Section>

        <Section title="Apple Watch" foot="Adds heart rate and calories from Apple Health to your workouts via a free Shortcut.">
          <Row label="Set up heart rate & calories" icon={<Watch size={20} />} onClick={() => nav('/watch-setup')}>
            <ChevronRight size={18} className="text-muted" />
          </Row>
        </Section>

        <Section title="Data" foot="Everything is stored only on this phone. Export a backup now and then (e.g. to iCloud Drive) so you never lose your history.">
          <Row label="Export backup" icon={<Download size={20} />} onClick={() => exportBackup().catch((e) => toast(String(e.message ?? e)))} />
          <Row label="Restore from backup" icon={<Upload size={20} />} onClick={() => fileRef.current?.click()} />
          <Row label="Import from Hevy (CSV)" icon={<Upload size={20} />} onClick={() => nav('/import/hevy')}>
            <ChevronRight size={18} className="text-muted" />
          </Row>
        </Section>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const r = await importBackup(await f.text());
              toast(`Restored ${r.workouts} workouts, ${r.routines} routines`);
            } catch (err) {
              toast((err as Error).message);
            }
          }}
        />

        <Section title="Offline" foot="Exercise pictures load from the internet the first time and are then saved. Download them all once on Wi-Fi to have every picture in the gym (~65 MB).">
          <Row label={img ? (img.done < img.total ? `Downloading… ${img.done}/${img.total}` : 'All images downloaded ✓') : 'Download all exercise images'} icon={<ImageDown size={20} />} onClick={img && img.done < img.total ? undefined : () => downloadImages((done, total) => setImg({ done, total }))} />
          {img && img.done < img.total && (
            <div className="px-4 pb-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-card2">
                <motion.div className="h-full bg-accent" animate={{ width: `${(img.done / img.total) * 100}%` }} />
              </div>
            </div>
          )}
          <Row label="Storage used">
            <span className="text-sm text-muted">{storage ? `${(storage.usage / 1e6).toFixed(1)} MB${storage.persisted ? ' · protected' : ''}` : '…'}</span>
          </Row>
          {!standalone && (
            <div className="px-4 py-3 text-sm text-warn">Tip: add this app to your Home Screen (Share → Add to Home Screen) so iOS keeps your data safe.</div>
          )}
        </Section>

        <Section title="Danger zone">
          <Row
            label={<span className="text-danger">Delete all data</span>}
            icon={<Trash2 size={20} className="text-danger" />}
            onClick={async () => {
              if (!(await confirmDialog('Delete everything?', 'All workouts, routines and custom exercises will be permanently deleted. Export a backup first!', 'Delete All', true))) return;
              await Promise.all([db.workouts.clear(), db.routines.clear(), db.folders.clear(), db.exercises.clear(), db.measures.clear()]);
              useWorkout.getState().discard();
              await useLibrary.getState().reload();
              toast('All data deleted');
            }}
          />
        </Section>

        <Sheet open={rankSheet} onClose={() => setRankSheet(false)} title="Sex & bodyweight">
          <div className="px-4 pt-2">
            <RankSetup compact onDone={() => setRankSheet(false)} />
            <div className="mt-3 text-center text-xs text-muted">Used only for strength ranks. Bodyweight is saved to Measures.</div>
          </div>
        </Sheet>

        <div className="text-center text-xs text-muted">
          Gym Log · v{__APP_VERSION__}
          <br />
          Exercise data & images: free-exercise-db (public domain)
        </div>
      </div>
    </Page>
  );
}
