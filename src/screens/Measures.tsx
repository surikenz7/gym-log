import { format } from 'date-fns';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Ruler, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ProgressChart } from '../components/charts';
import { NumInput } from '../components/inputs';
import { Button, Empty, Header, Page, Sheet } from '../components/ui';
import { db } from '../db/db';
import { uid } from '../lib/id';
import { fmtNum, kgTo, round, toKg } from '../lib/units';
import { confirmDialog } from '../state/dialog';
import { useSettings } from '../state/settings';
import { MEASURE_FIELDS, type Measure, type MeasureField, type Settings } from '../types';

const LABELS: Record<MeasureField, string> = {
  weight: 'Bodyweight',
  bodyFat: 'Body fat',
  waist: 'Waist',
  chest: 'Chest',
  hips: 'Hips',
  shoulders: 'Shoulders',
  arms: 'Arms',
  thighs: 'Thighs',
  calves: 'Calves',
  neck: 'Neck',
};

const CM_PER_IN = 2.54;

function unitOf(f: MeasureField, s: Settings) {
  if (f === 'weight') return s.weightUnit;
  if (f === 'bodyFat') return '%';
  return s.weightUnit === 'lbs' ? 'in' : 'cm';
}

/** stored (kg / cm / %) -> display */
function toDisplay(f: MeasureField, v: number, s: Settings) {
  if (f === 'weight') return kgTo(v, s.weightUnit);
  if (f === 'bodyFat') return round(v, 1);
  return s.weightUnit === 'lbs' ? round(v / CM_PER_IN, 1) : round(v, 1);
}

function fromDisplay(f: MeasureField, v: number, s: Settings) {
  if (f === 'weight') return toKg(v, s.weightUnit);
  if (f === 'bodyFat') return v;
  return s.weightUnit === 'lbs' ? v * CM_PER_IN : v;
}

function MeasureSheet({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Measure | null }) {
  const s = useSettings();
  const [date, setDate] = useState('');
  const [vals, setVals] = useState<Partial<Record<MeasureField, number | null>>>({});
  useEffect(() => {
    if (!open) return;
    setDate(format(editing?.date ?? Date.now(), "yyyy-MM-dd'T'HH:mm"));
    const v: Partial<Record<MeasureField, number | null>> = {};
    for (const f of MEASURE_FIELDS) if (editing?.[f] != null) v[f] = toDisplay(f, editing[f]!, s);
    setVals(v);
  }, [open, editing]);

  const save = async () => {
    const m: Measure = { id: editing?.id ?? uid(), date: new Date(date).getTime() || Date.now() };
    for (const f of MEASURE_FIELDS) if (vals[f] != null) m[f] = fromDisplay(f, vals[f]!, s);
    await db.measures.put(m);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit Measurement' : 'Log Measurement'} tall>
      <div className="px-4 pt-2">
        <label className="block rounded-xl bg-card2 px-3 py-2">
          <div className="text-xs text-muted">Date</div>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-transparent outline-none" />
        </label>
        <div className="mt-3 divide-y divide-line overflow-hidden rounded-xl bg-card2">
          {MEASURE_FIELDS.map((f) => (
            <div key={f} className="flex items-center gap-3 px-3 py-1.5">
              <span className="flex-1">{LABELS[f]}</span>
              <div className="w-24">
                <NumInput value={vals[f]} placeholder="–" onChange={(v) => setVals((x) => ({ ...x, [f]: v }))} className="!text-right" />
              </div>
              <span className="w-8 text-sm text-muted">{unitOf(f, s)}</span>
            </div>
          ))}
        </div>
        <Button className="mt-4 w-full" onClick={save}>
          Save
        </Button>
        {editing && (
          <Button
            variant="danger"
            className="mt-2 w-full"
            onClick={async () => {
              if (!(await confirmDialog('Delete measurement?', format(editing.date, 'd MMM yyyy'), 'Delete', true))) return;
              await db.measures.delete(editing.id);
              onClose();
            }}
          >
            <Trash2 size={18} /> Delete
          </Button>
        )}
      </div>
    </Sheet>
  );
}

export function Measures() {
  const s = useSettings();
  const list = useLiveQuery(() => db.measures.orderBy('date').reverse().toArray(), []) ?? [];
  const [sheet, setSheet] = useState<{ editing: Measure | null } | null>(null);
  const used = useMemo(() => MEASURE_FIELDS.filter((f) => list.some((m) => m[f] != null)), [list]);
  const [field, setField] = useState<MeasureField>('weight');
  const active = used.includes(field) ? field : (used[0] ?? 'weight');
  const latest = (f: MeasureField) => list.find((m) => m[f] != null)?.[f];

  return (
    <Page pushed>
      <Header
        back
        title="Measures"
        right={
          <button onClick={() => setSheet({ editing: null })} className="press text-accent">
            <Plus size={26} />
          </button>
        }
      />
      <div className="space-y-4 px-4 pb-12">
        {list.length === 0 ? (
          <Empty icon={<Ruler size={48} />} title="No measurements yet" text="Track your bodyweight, body fat and measurements over time.">
            <Button onClick={() => setSheet({ editing: null })}>
              <Plus size={18} /> Log Measurement
            </Button>
          </Empty>
        ) : (
          <>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {used.map((f) => (
                <button
                  key={f}
                  onClick={() => setField(f)}
                  className={`press shrink-0 rounded-2xl px-4 py-2.5 text-left ${f === active ? 'bg-accent' : 'bg-card'}`}
                >
                  <div className={`text-xs ${f === active ? 'text-white/80' : 'text-muted'}`}>{LABELS[f]}</div>
                  <div className="font-semibold">
                    {fmtNum(toDisplay(f, latest(f)!, s))} {unitOf(f, s)}
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-2xl bg-card p-3">
              <ProgressChart
                key={active}
                data={[...list]
                  .reverse()
                  .filter((m) => m[active] != null)
                  .map((m) => ({ date: m.date, value: toDisplay(active, m[active]!, s) }))}
                fmt={(v) => `${fmtNum(v)} ${unitOf(active, s)}`}
              />
            </div>
            <div>
              <div className="mb-2 font-semibold">History</div>
              <div className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
                <AnimatePresence initial={false}>
                  {list.map((m) => (
                    <motion.button
                      key={m.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      onClick={() => setSheet({ editing: m })}
                      className="block w-full px-4 py-3 text-left active:bg-card2"
                    >
                      <div className="text-sm text-muted">{format(m.date, 'EEEE, d MMM yyyy')}</div>
                      <div className="mt-0.5 text-sm">
                        {MEASURE_FIELDS.filter((f) => m[f] != null)
                          .map((f) => `${LABELS[f]} ${fmtNum(toDisplay(f, m[f]!, s))} ${unitOf(f, s)}`)
                          .join(' · ')}
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>
      <MeasureSheet open={!!sheet} editing={sheet?.editing ?? null} onClose={() => setSheet(null)} />
    </Page>
  );
}
