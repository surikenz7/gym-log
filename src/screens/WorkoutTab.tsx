import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronDown, ClipboardList, Compass, Copy, Dumbbell, FolderInput, FolderPlus, GripVertical, Link2, MoreHorizontal, Pencil, Plus, Share2, Sparkles, Trash2 } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Empty, Header, Page, Sheet, SheetItem } from '../components/ui';
import { db } from '../db/db';
import { ExerciseThumb, muscleColor } from '../components/ExerciseImage';
import { getExercise } from '../lib/exercises';
import { useAllWorkouts } from '../lib/hooks';
import { codeFromText, shareRoutine } from '../lib/share';
import { PROGRAM_COLORS, PROGRAMS } from './Explore';
import { uid } from '../lib/id';
import { ask, confirmDialog, toast } from '../state/dialog';
import { cloneExercises, useWorkout } from '../state/workout';
import type { Folder, Routine } from '../types';
import { t } from '../i18n';

export async function startWorkout(routine?: Routine) {
  const st = useWorkout.getState();
  if (st.active) {
    const r = await ask({
      title: t('Workout in progress'),
      message: t('You already have a workout running. Resume it or discard it and start a new one?'),
      actions: [
        { label: t('Resume Workout'), value: 'resume', style: 'primary' },
        { label: t('Discard & Start New'), value: 'new', style: 'danger' },
        { label: t('Cancel'), value: 'cancel', style: 'cancel' },
      ],
    });
    if (r === 'resume') return st.setOpen(true);
    if (r !== 'new') return;
  }
  st.start(routine);
}

async function promptName(title: string, initial = ''): Promise<string | null> {
  const v = window.prompt(title, initial);
  return v?.trim() ? v.trim() : null;
}

/** Muscles a routine trains most, by number of sets. */
function routineMuscles(r: Routine) {
  const count = new Map<string, number>();
  for (const e of r.exercises) {
    const m = getExercise(e.exerciseId).muscle;
    count.set(m, (count.get(m) ?? 0) + Math.max(1, e.sets.length));
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

function RoutineCard({ r, last, onMenu, index }: { r: Routine; last?: number; onMenu: () => void; index: number }) {
  const nav = useNavigate();
  const muscles = routineMuscles(r);
  const color = muscleColor(muscles[0] ?? 'Other');
  const sets = r.exercises.reduce((n, e) => n + e.sets.length, 0);
  const minutes = Math.round((sets * 2.5 + r.exercises.length) / 5) * 5;
  const exs = r.exercises.map((e) => getExercise(e.exerciseId));
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index, 6) * 0.04 }}
      className="cut relative overflow-hidden bg-card"
      style={{ backgroundImage: `linear-gradient(135deg, ${color}2e, transparent 55%)` }}
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <button className="block w-full px-4 pb-3 pt-3.5 text-left" onClick={() => nav(`/routine/${r.id}`)}>
        <div className="flex items-start gap-2 pr-16">
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[22px] font-bold uppercase leading-tight">{r.name}</div>
            <div className="mt-0.5 text-xs text-muted">
              {r.exercises.length} exercise{r.exercises.length === 1 ? '' : 's'} · {sets} sets · ~{minutes || 5} min
            </div>
          </div>
        </div>
        {muscles.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {muscles.slice(0, 4).map((m) => (
              <span key={m} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: muscleColor(m) + '26', color: muscleColor(m) }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: muscleColor(m) }} />
                {t(m)}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex -space-x-2.5">
            {exs.slice(0, 6).map((ex, i) => (
              <div key={i} className="rounded-full ring-2 ring-card">
                <ExerciseThumb ex={ex} size={30} />
              </div>
            ))}
            {exs.length > 6 && (
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-card2 text-[10px] font-bold ring-2 ring-card">+{exs.length - 6}</div>
            )}
          </div>
          <div className="text-right text-[11px] text-muted">{last ? `Done ${formatDistanceToNowStrict(last, { addSuffix: true })}` : 'Not done yet'}</div>
        </div>
      </button>
      <div className="absolute right-2 top-2 flex">
        <button
          onClick={async () => {
            const how = await shareRoutine(r);
            if (how === 'copied') toast(t('Link copied — send it to a friend'));
          }}
          className="press p-2 text-muted"
          aria-label={t('Share routine')}
        >
          <Share2 size={19} />
        </button>
        <button onClick={onMenu} className="press p-2 text-muted" aria-label={t('Routine menu')}>
          <MoreHorizontal size={21} />
        </button>
      </div>
    </motion.div>
  );
}


/** Ready-made programs as a swipeable row of colourful cards. */
function ProgramCarousel() {
  const nav = useNavigate();
  return (
    <div className="overflow-x-auto no-scrollbar -mx-4 mt-2 flex snap-x snap-mandatory gap-2.5 px-4 pb-1" data-no-swipe>
      {PROGRAMS.map((p, i) => {
        const [a, b] = PROGRAM_COLORS[i % PROGRAM_COLORS.length];
        return (
          <motion.button
            key={p.name}
            onClick={() => nav('/explore')}
            className="press cut relative h-[118px] w-[200px] shrink-0 snap-start overflow-hidden p-3 text-left text-[#fff]"
            style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Dumbbell size={74} className="absolute -bottom-3 -right-3 rotate-[-25deg] opacity-20" />
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">{p.routines.length} {t('routines')}</div>
            <div className="mt-0.5 font-display text-xl font-bold uppercase leading-tight">{p.name}</div>
            <div className="mt-1 line-clamp-2 text-[11px] leading-snug opacity-85">{p.level}</div>
          </motion.button>
        );
      })}
    </div>
  );
}

function QuickTile({ icon, label, sub, onClick, color }: { icon: ReactNode; label: string; sub: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="press cut-sm flex flex-col items-start gap-2 bg-card p-3 text-left">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[#fff]" style={{ background: color }}>
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        <span className="block text-[11px] leading-tight text-muted">{sub}</span>
      </span>
    </button>
  );
}

function ReorderRow({ r }: { r: Routine }) {
  const c = useDragControls();
  return (
    <Reorder.Item value={r.id} dragListener={false} dragControls={c} className="flex items-center gap-3 bg-card px-4 py-3" whileDrag={{ scale: 1.03, zIndex: 10 }}>
      <div className="flex-1 truncate font-medium">{r.name}</div>
      <div className="touch-none p-1 text-muted" onPointerDown={(e) => c.start(e)}>
        <GripVertical size={20} />
      </div>
    </Reorder.Item>
  );
}

export function WorkoutTab() {
  const nav = useNavigate();
  const routines = useLiveQuery(() => db.routines.orderBy('order').toArray(), []);
  const folders = useLiveQuery(() => db.folders.orderBy('order').toArray(), []) ?? [];
  const [menu, setMenu] = useState<Routine | null>(null);
  const [folderMenu, setFolderMenu] = useState<Folder | null>(null);
  const [moving, setMoving] = useState<Routine | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [reorder, setReorder] = useState<string[] | null>(null);
  const workouts = useAllWorkouts();
  const lastDone = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of workouts ?? []) if (w.routineId && !m.has(w.routineId)) m.set(w.routineId, w.start);
    return m;
  }, [workouts]);

  const pasteLink = async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = window.prompt('Paste the routine link') ?? '';
    }
    const code = codeFromText(text);
    if (!code) return toast(t('Copy a Gym Log routine link first'));
    nav(`/r/${code}`);
  };

  const groups: { folder: Folder | null; items: Routine[] }[] = [
    ...folders.map((f) => ({ folder: f, items: (routines ?? []).filter((r) => r.folderId === f.id) })),
    { folder: null, items: (routines ?? []).filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId)) },
  ];

  const newFolder = async () => {
    const name = await promptName('Folder name');
    if (name) await db.folders.add({ id: uid(), name, order: Date.now() });
  };

  const duplicate = async (r: Routine) => {
    const copy: Routine = { ...r, id: uid(), name: `${r.name} (copy)`, order: Date.now(), createdAt: Date.now(), updatedAt: Date.now(), exercises: cloneExercises(r.exercises, false) };
    await db.routines.add(copy);
    toast(t('Routine duplicated'));
  };

  return (
    <Page>
      <Header
        title={t('Routines')}
        large
        right={
          <button onClick={newFolder} className="press p-1 text-accent" aria-label={t('New folder')}>
            <FolderPlus size={22} />
          </button>
        }
      />
      <div className="px-4 pb-6">
        <div className="grid grid-cols-3 gap-2">
          <QuickTile icon={<Plus size={20} strokeWidth={2.6} />} label={t('New')} sub={t('Build your own')} color="rgb(var(--accent))" onClick={() => nav('/routine/new')} />
          <QuickTile icon={<Compass size={20} />} label={t('Explore')} sub={t('Ready programs')} color="#6366f1" onClick={() => nav('/explore')} />
          <QuickTile icon={<Link2 size={20} />} label={t('Paste link')} sub={t('From a friend')} color="#22c55e" onClick={pasteLink} />
        </div>

        <div className="label mt-6 flex items-center gap-2">
          <Sparkles size={13} className="text-accent" /> {t('Programs')}
        </div>
        <ProgramCarousel />

        {routines && routines.length === 0 && (
          <Empty icon={<ClipboardList size={48} />} title={t('No routines yet')} text={t('Create as many as you like, with no limits. Or grab a program above, or paste a link from a friend.')} />
        )}

        {groups.map(({ folder, items }) =>
          !folder && items.length === 0 ? null : (
            <div key={folder?.id ?? 'none'} className="mt-5">
              <div className="mb-2 flex items-center gap-1">
                <button className="label flex flex-1 items-center gap-1 text-left" onClick={() => folder && setCollapsed((c) => ({ ...c, [folder.id]: !c[folder.id] }))}>
                  {folder && (
                    <motion.span animate={{ rotate: collapsed[folder.id] ? -90 : 0 }}>
                      <ChevronDown size={18} />
                    </motion.span>
                  )}
                  {folder ? folder.name : `My routines (${items.length})`}
                  {folder && <span className="font-normal"> ({items.length})</span>}
                </button>
                {folder && (
                  <button onClick={() => setFolderMenu(folder)} className="press p-1 text-muted">
                    <MoreHorizontal size={20} />
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {!(folder && collapsed[folder.id]) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-2 overflow-hidden">
                    <AnimatePresence>
                      {items.map((r, i) => (
                        <RoutineCard key={r.id} r={r} index={i} last={lastDone.get(r.id)} onMenu={() => setMenu(r)} />
                      ))}
                    </AnimatePresence>
                    {folder && items.length === 0 && <div className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">{t('Empty folder')}</div>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ),
        )}
      </div>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        <SheetItem icon={<Pencil size={20} />} label={t('Edit Routine')} onClick={() => (setMenu(null), nav(`/routine/${menu!.id}`))} />
        <SheetItem
          icon={<Share2 size={20} />}
          label={t('Share Routine')}
          onClick={async () => {
            const r = menu!;
            setMenu(null);
            if ((await shareRoutine(r)) === 'copied') toast(t('Link copied — send it to a friend'));
          }}
        />
        <SheetItem icon={<Copy size={20} />} label={t('Duplicate Routine')} onClick={() => (setMenu(null), duplicate(menu!))} />
        <SheetItem icon={<FolderInput size={20} />} label={t('Move to Folder')} onClick={() => (setMenu(null), setMoving(menu))} />
        <SheetItem icon={<GripVertical size={20} />} label={t('Reorder Routines')} onClick={() => (setMenu(null), setReorder((routines ?? []).map((r) => r.id)))} />
        <SheetItem
          danger
          icon={<Trash2 size={20} />}
          label={t('Delete Routine')}
          onClick={async () => {
            const r = menu!;
            setMenu(null);
            if (await confirmDialog(t('Delete routine?'), `"${r.name}" will be deleted. Your workout history stays.`, 'Delete', true)) await db.routines.delete(r.id);
          }}
        />
      </Sheet>

      <Sheet open={!!moving} onClose={() => setMoving(null)} title={t('Move to Folder')}>
        <SheetItem label={t('No folder')} onClick={async () => (await db.routines.update(moving!.id, { folderId: null }), setMoving(null))} />
        {folders.map((f) => (
          <SheetItem key={f.id} label={f.name} onClick={async () => (await db.routines.update(moving!.id, { folderId: f.id }), setMoving(null))} />
        ))}
        <SheetItem
          icon={<FolderPlus size={20} />}
          label={t('New Folder...')}
          onClick={async () => {
            const name = await promptName('Folder name');
            if (!name) return;
            const id = uid();
            await db.folders.add({ id, name, order: Date.now() });
            await db.routines.update(moving!.id, { folderId: id });
            setMoving(null);
          }}
        />
      </Sheet>

      <Sheet open={!!folderMenu} onClose={() => setFolderMenu(null)} title={folderMenu?.name}>
        <SheetItem icon={<Plus size={20} />} label={t('Add New Routine')} onClick={() => (setFolderMenu(null), nav(`/routine/new?folder=${folderMenu!.id}`))} />
        <SheetItem
          icon={<Pencil size={20} />}
          label={t('Rename Folder')}
          onClick={async () => {
            const f = folderMenu!;
            setFolderMenu(null);
            const name = await promptName('Folder name', f.name);
            if (name) await db.folders.update(f.id, { name });
          }}
        />
        <SheetItem
          danger
          icon={<Trash2 size={20} />}
          label={t('Delete Folder')}
          onClick={async () => {
            const f = folderMenu!;
            setFolderMenu(null);
            if (!(await confirmDialog(t('Delete folder?'), t('Routines inside will be moved to My Routines.'), t('Delete'), true))) return;
            await db.routines.where('folderId').equals(f.id).modify({ folderId: null });
            await db.folders.delete(f.id);
          }}
        />
      </Sheet>

      <Sheet open={!!reorder} onClose={() => setReorder(null)} title={t('Reorder Routines')}>
        {reorder && (
          <Reorder.Group axis="y" values={reorder} onReorder={setReorder} className="divide-y divide-line">
            {reorder.map((id) => {
              const r = routines?.find((x) => x.id === id);
              return r ? <ReorderRow key={id} r={r} /> : null;
            })}
          </Reorder.Group>
        )}
        <div className="px-4 pt-4">
          <Button
            className="w-full"
            onClick={async () => {
              await db.transaction('rw', db.routines, () => Promise.all(reorder!.map((id, i) => db.routines.update(id, { order: i }))));
              setReorder(null);
            }}
          >
            {t('Save Order')}
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
