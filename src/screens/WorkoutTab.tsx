import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { ChevronDown, ClipboardList, Compass, Copy, FolderInput, FolderPlus, GripVertical, MoreHorizontal, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Empty, Header, Page, Sheet, SheetItem } from '../components/ui';
import { db } from '../db/db';
import { getExercise } from '../lib/exercises';
import { uid } from '../lib/id';
import { ask, confirmDialog, toast } from '../state/dialog';
import { cloneExercises, useWorkout } from '../state/workout';
import type { Folder, Routine } from '../types';

export async function startWorkout(routine?: Routine) {
  const st = useWorkout.getState();
  if (st.active) {
    const r = await ask({
      title: 'Workout in progress',
      message: 'You already have a workout running. Resume it or discard it and start a new one?',
      actions: [
        { label: 'Resume Workout', value: 'resume', style: 'primary' },
        { label: 'Discard & Start New', value: 'new', style: 'danger' },
        { label: 'Cancel', value: 'cancel', style: 'cancel' },
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

function RoutineCard({ r, onMenu }: { r: Routine; onMenu: () => void }) {
  const nav = useNavigate();
  const names = r.exercises.map((e) => getExercise(e.exerciseId).name).join(', ');
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="rounded-2xl bg-card p-4">
      <div className="flex items-start gap-2">
        <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/routine/${r.id}`)}>
          <div className="truncate text-[17px] font-semibold">{r.name}</div>
          <div className="mt-0.5 line-clamp-2 text-sm text-muted">{names || 'No exercises'}</div>
        </button>
        <button onClick={onMenu} className="press -mr-1 -mt-1 p-1.5 text-muted">
          <MoreHorizontal size={22} />
        </button>
      </div>
      <Button className="mt-3 w-full !py-2.5" onClick={() => startWorkout(r)}>
        Start Routine
      </Button>
    </motion.div>
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
    toast('Routine duplicated');
  };

  return (
    <Page>
      <Header title="Workout" large />
      <div className="px-4 pb-6">
        <div className="text-lg font-semibold">Quick Start</div>
        <Button variant="secondary" className="mt-2 w-full" onClick={() => startWorkout()}>
          <Plus size={20} /> Start Empty Workout
        </Button>

        <div className="mt-7 flex items-center justify-between">
          <div className="text-lg font-semibold">Routines</div>
          <button onClick={newFolder} className="press p-1 text-muted">
            <FolderPlus size={22} />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => nav('/routine/new')}>
            <ClipboardList size={18} /> New Routine
          </Button>
          <Button variant="secondary" onClick={() => nav('/explore')}>
            <Compass size={18} /> Explore
          </Button>
        </div>

        {routines && routines.length === 0 && (
          <Empty icon={<ClipboardList size={48} />} title="No routines yet" text="Create as many routines as you like. No limits here." />
        )}

        {groups.map(({ folder, items }) =>
          !folder && items.length === 0 ? null : (
            <div key={folder?.id ?? 'none'} className="mt-5">
              <div className="mb-2 flex items-center gap-1">
                <button className="flex flex-1 items-center gap-1 text-left text-sm font-semibold text-muted" onClick={() => folder && setCollapsed((c) => ({ ...c, [folder.id]: !c[folder.id] }))}>
                  {folder && (
                    <motion.span animate={{ rotate: collapsed[folder.id] ? -90 : 0 }}>
                      <ChevronDown size={18} />
                    </motion.span>
                  )}
                  {folder ? folder.name : folders.length ? 'My Routines' : `My Routines (${items.length})`}
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
                      {items.map((r) => (
                        <RoutineCard key={r.id} r={r} onMenu={() => setMenu(r)} />
                      ))}
                    </AnimatePresence>
                    {folder && items.length === 0 && <div className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">Empty folder</div>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ),
        )}
      </div>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        <SheetItem icon={<Play size={20} />} label="Start Routine" onClick={() => (setMenu(null), startWorkout(menu!))} />
        <SheetItem icon={<Pencil size={20} />} label="Edit Routine" onClick={() => (setMenu(null), nav(`/routine/${menu!.id}`))} />
        <SheetItem icon={<Copy size={20} />} label="Duplicate Routine" onClick={() => (setMenu(null), duplicate(menu!))} />
        <SheetItem icon={<FolderInput size={20} />} label="Move to Folder" onClick={() => (setMenu(null), setMoving(menu))} />
        <SheetItem icon={<GripVertical size={20} />} label="Reorder Routines" onClick={() => (setMenu(null), setReorder((routines ?? []).map((r) => r.id)))} />
        <SheetItem
          danger
          icon={<Trash2 size={20} />}
          label="Delete Routine"
          onClick={async () => {
            const r = menu!;
            setMenu(null);
            if (await confirmDialog('Delete routine?', `"${r.name}" will be deleted. Your workout history stays.`, 'Delete', true)) await db.routines.delete(r.id);
          }}
        />
      </Sheet>

      <Sheet open={!!moving} onClose={() => setMoving(null)} title="Move to Folder">
        <SheetItem label="No folder" onClick={async () => (await db.routines.update(moving!.id, { folderId: null }), setMoving(null))} />
        {folders.map((f) => (
          <SheetItem key={f.id} label={f.name} onClick={async () => (await db.routines.update(moving!.id, { folderId: f.id }), setMoving(null))} />
        ))}
        <SheetItem
          icon={<FolderPlus size={20} />}
          label="New Folder..."
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
        <SheetItem icon={<Plus size={20} />} label="Add New Routine" onClick={() => (setFolderMenu(null), nav(`/routine/new?folder=${folderMenu!.id}`))} />
        <SheetItem
          icon={<Pencil size={20} />}
          label="Rename Folder"
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
          label="Delete Folder"
          onClick={async () => {
            const f = folderMenu!;
            setFolderMenu(null);
            if (!(await confirmDialog('Delete folder?', 'Routines inside will be moved to My Routines.', 'Delete', true))) return;
            await db.routines.where('folderId').equals(f.id).modify({ folderId: null });
            await db.folders.delete(f.id);
          }}
        />
      </Sheet>

      <Sheet open={!!reorder} onClose={() => setReorder(null)} title="Reorder Routines">
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
            Save Order
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
