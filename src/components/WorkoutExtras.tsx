import { AnimatePresence, motion } from 'framer-motion';
import { Check, ImagePlus, Tag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../cloud/account';
import type { PublicProfile } from '../cloud/social';
import { useSocial } from '../cloud/socialStore';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { fileToJpeg, MAX_WORKOUT_PHOTOS } from '../lib/photo';
import { toast } from '../state/dialog';
import type { Workout } from '../types';
import { ratingFace } from './Rating';
import { Portal, Sheet } from './ui';
import { Avatar } from './WorkoutFeed';

/** Full-screen photo viewer, swipe/tap to close. */
export function PhotoViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  return (
    <Portal>
      <AnimatePresence>
        {src && (
          <motion.div className="fixed inset-0 z-[85] flex items-center justify-center bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
            <motion.img src={src} className="max-h-full max-w-full object-contain" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} drag="y" dragSnapToOrigin onDragEnd={(_, i) => Math.abs(i.offset.y) > 90 && onClose()} />
            <button className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-[#fff]" style={{ top: 'calc(var(--sat) + 12px)' }} onClick={onClose}>
              <X size={22} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Row of workout photos; with onChange you can add (camera / library) and remove them. */
export function PhotoStrip({ photos, onChange }: { photos: string[]; onChange?: (p: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!photos.length && !onChange) return null;
  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" data-no-swipe>
        {photos.map((p, i) => (
          <motion.div key={i} className="relative shrink-0" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <button onClick={() => setView(p)} className="block overflow-hidden rounded-2xl">
              <img src={p} alt="" className="h-36 w-28 object-cover" />
            </button>
            {onChange && (
              <button onClick={() => onChange(photos.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[#fff]">
                <X size={15} />
              </button>
            )}
          </motion.div>
        ))}
        {onChange && photos.length < MAX_WORKOUT_PHOTOS && (
          <button onClick={() => input.current?.click()} className="press flex h-36 w-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-line text-muted">
            <ImagePlus size={26} />
            <span className="text-xs font-semibold">{busy ? '…' : t('Add photo')}</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f || !onChange) return;
          setBusy(true);
          try {
            onChange([...photos, await fileToJpeg(f)]);
          } catch {
            toast(t('Couldn’t read that image'));
          } finally {
            setBusy(false);
          }
        }}
      />
      <PhotoViewer src={view} onClose={() => setView(null)} />
    </div>
  );
}

/** "with @adam, @eva" chips. Friends' own profiles open on tap. */
export function TaggedChips({ tagged }: { tagged?: Workout['tagged'] }) {
  const nav = useNavigate();
  if (!tagged?.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag size={14} className="text-muted" />
      <span className="text-sm text-muted">{t('with')}</span>
      {tagged.map((f) => (
        <button key={f.uid} onClick={() => nav(`/u/${f.uid}`)} className="press rounded-full bg-accent/15 px-2.5 py-0.5 text-sm font-semibold text-accent">
          @{f.nick}
        </button>
      ))}
    </div>
  );
}

export function RatingPill({ rating }: { rating?: number | null }) {
  if (!rating) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-card2 px-2 py-0.5 text-xs font-bold">
      {ratingFace(rating)} {rating}/10
    </span>
  );
}

/** Everyone you follow or who follows you (accepted) — the people you can tag / message. */
export function useFriendProfiles() {
  const uid = useAccount((a) => a.uid);
  const following = useAccount((a) => a.following);
  const followers = useSocial((s) => s.followers);
  const [list, setList] = useState<PublicProfile[] | null>(null);
  const ids = [...new Set([...following, ...followers.filter((f) => f.status === 'accepted').map((f) => f.uid)])].filter((x) => x !== uid);
  const key = ids.sort().join();
  useEffect(() => {
    if (!uid) return setList([]);
    void import('../cloud/social').then((s) => s.getProfiles(ids).then(setList));
  }, [uid, key]);
  return list;
}

/** Sheet to tag friends in a workout. */
export function TagPicker({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: NonNullable<Workout['tagged']>; onChange: (v: NonNullable<Workout['tagged']>) => void }) {
  const friends = useFriendProfiles();
  const on = new Set(value.map((v) => v.uid));
  return (
    <Sheet open={open} onClose={onClose} title={t('Tag friends')}>
      <div className="space-y-1.5 px-4 pt-2">
        {friends === null && <div className="py-6 text-center text-sm text-muted">{t('Loading…')}</div>}
        {friends?.length === 0 && <div className="py-6 text-center text-sm text-muted">{t('Follow friends first — then you can tag them in workouts.')}</div>}
        {friends?.map((f) => {
          const sel = on.has(f.uid);
          return (
            <button
              key={f.uid}
              onClick={() => {
                haptic();
                onChange(sel ? value.filter((v) => v.uid !== f.uid) : [...value, { uid: f.uid, nick: f.nick }]);
              }}
              className={`press flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ${sel ? 'bg-accent/15' : 'bg-card2'}`}
            >
              <div className="p-1">
                <Avatar size={40} src={f.avatar ?? null} initial={f.nick} deco={f.deco ?? null} />
              </div>
              <span className="flex-1 font-semibold">@{f.nick}</span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${sel ? 'bg-accent' : 'border-2 border-line'}`}>{sel && <Check size={14} strokeWidth={3.5} />}</span>
            </button>
          );
        })}
        <button onClick={onClose} className="press grad mt-3 w-full rounded-2xl py-3 font-display text-lg font-bold uppercase tracking-wider">
          {t('Done')}
        </button>
      </div>
    </Sheet>
  );
}

/** "with @adam" + an edit button — tags can be added or removed any time after the workout. */
export function TagEditor({ w }: { w: Workout }) {
  const signedIn = useAccount((a) => a.status === 'signedIn');
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<NonNullable<Workout['tagged']>>(w.tagged ?? []);
  useEffect(() => setValue(w.tagged ?? []), [w.id, open]);
  if (!signedIn) return <TaggedChips tagged={w.tagged} />;
  const close = async () => {
    setOpen(false);
    const before = new Set((w.tagged ?? []).map((f) => f.uid));
    const { db } = await import('../db/db');
    await db.workouts.update(w.id, { tagged: value });
    const added = value.filter((f) => !before.has(f.uid));
    if (!added.length) return;
    const a = useAccount.getState();
    const { notify } = await import('../cloud/social');
    const { useSettings } = await import('../state/settings');
    const avatar = useSettings.getState().avatar ?? null;
    await Promise.all(added.map((f) => notify(f.uid, { kind: 'tag', from: a.uid!, nick: a.nick ?? '', avatar, workoutId: w.id, workoutName: w.name }).catch(() => {})));
    toast(t('Tagged: {names}', { names: added.map((f) => '@' + f.nick).join(', ') }));
  };
  return (
    <>
      {w.tagged?.length ? <TaggedChips tagged={w.tagged} /> : null}
      <button onClick={() => setOpen(true)} className="press flex items-center gap-1.5 rounded-full bg-card2 px-3 py-1 text-sm font-semibold text-accent">
        <Tag size={14} /> {w.tagged?.length ? t('Edit tags') : t('Tag friends')}
      </button>
      <TagPicker open={open} onClose={() => void close()} value={value} onChange={setValue} />
    </>
  );
}
