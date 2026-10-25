import { differenceInCalendarWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, getYear, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Page } from '../components/ui';
import { useAllWorkouts } from '../lib/hooks';
import type { Workout } from '../types';

function Month({ month, byDay, onDay }: { month: Date; byDay: Map<string, Workout[]>; onDay: (ws: Workout[]) => void }) {
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const count = days.filter((d) => isSameMonth(d, month) && byDay.has(format(d, 'yyyy-MM-dd'))).length;
  return (
    <div className="rounded-2xl bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <div className="font-semibold">{format(month, 'MMMM')}</div>
        <div className="text-xs text-muted">{count ? `${count} day${count === 1 ? '' : 's'}` : ''}</div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-muted">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-sm">
        {days.map((d) => {
          const ws = byDay.get(format(d, 'yyyy-MM-dd'));
          const inMonth = isSameMonth(d, month);
          const today = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className="flex justify-center">
              <button
                disabled={!ws || !inMonth}
                onClick={() => ws && onDay(ws)}
                className={`flex h-8 w-8 items-center justify-center rounded-full ${!inMonth ? 'invisible' : ''} ${ws ? 'bg-accent font-semibold' : ''} ${today && !ws ? 'ring-1 ring-accent' : ''}`}
              >
                {format(d, 'd')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarPage() {
  const nav = useNavigate();
  const workouts = useAllWorkouts() ?? [];
  const [year, setYear] = useState(getYear(new Date()));
  const [dir, setDir] = useState(0);
  const byDay = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of workouts) {
      const k = format(w.start, 'yyyy-MM-dd');
      m.set(k, [...(m.get(k) ?? []), w]);
    }
    return m;
  }, [workouts]);
  const yearCount = workouts.filter((w) => getYear(w.start) === year).length;
  const streak = useMemo(() => {
    const weeks = new Set(workouts.map((w) => differenceInCalendarWeeks(new Date(), w.start, { weekStartsOn: 1 })));
    let n = 0;
    for (let i = weeks.has(0) ? 0 : 1; weeks.has(i); i++) n++;
    return n;
  }, [workouts]);
  const thisYear = getYear(new Date());
  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)).filter((m) => year < thisYear || m <= new Date()).reverse();
  const go = (d: number) => {
    setDir(d);
    setYear((y) => y + d);
  };

  return (
    <Page pushed>
      <Header back title="Calendar" />
      <div className="px-4 pb-12">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-card p-4">
            <div className="text-xs text-muted">Workouts in {year}</div>
            <div className="text-xl font-semibold">{yearCount}</div>
          </div>
          <div className="rounded-2xl bg-card p-4">
            <div className="text-xs text-muted">Week streak</div>
            <div className="text-xl font-semibold">{streak} 🔥</div>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => go(-1)} className="press p-2 text-accent">
            <ChevronLeft size={22} />
          </button>
          <div className="text-lg font-semibold">{year}</div>
          <button onClick={() => go(1)} disabled={year >= thisYear} className="press p-2 text-accent disabled:opacity-30">
            <ChevronRight size={22} />
          </button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={year}
            className="space-y-3"
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.18 }}
          >
            {months.map((m) => (
              <Month key={m.toISOString()} month={startOfMonth(m)} byDay={byDay} onDay={(ws) => nav(`/history/${ws[0].id}`)} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </Page>
  );
}
