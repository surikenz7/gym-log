import { format, parse } from 'date-fns';
import { ChevronLeft, ChevronRight, ImagePlus, LayoutGrid, Music } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from '../cloud/account';
import { useSocial } from '../cloud/socialStore';
import { t } from '../i18n';
import { monthlyBadges, monthlyChallenge, weeklyChallenges } from '../lib/compete';
import { getExercise, typeOf } from '../lib/exercises';
import { useAllWorkouts } from '../lib/hooks';
import { ACHIEVEMENTS, levelFromXp, levelTitle } from '../lib/progress';
import { workoutVolume } from '../lib/stats';
import { LAYOUTS, type CardLayer } from '../lib/storyCanvas';
import { fmtDurationLong, fmtVolume } from '../lib/units';
import { useJourney } from '../lib/useProgress';
import { challengeText, ICON, QUEST_EMOJI, questText } from '../screens/Compete';
import { useSettings } from '../state/settings';
import type { Workout } from '../types';
import { Sheet } from './ui';

export type CardData = Pick<CardLayer, 'title' | 'sub' | 'stats' | 'accent' | 'label' | 'icon'>;

const EMOJIS = ['💪', '🏋️', '🔥', '⚡', '🏆', '🥇', '💯', '🙌', '😤', '🥵', '😎', '🤝', '❤️', '🎯', '🚀', '⏱️', '🥗', '🍗', '💤', '🧠', '👑', '🦍', '😈', '✅', '📈', '🫡', '🤯', '🥶', '☀️', '🌙', '🎧', '📸'];
const GOLD = '#f5b301';
const SKY = '#38bdf8';
const muscleOf = (id: string) => getExercise(id).muscle;
const accentNow = () => `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().split(/[\s,]+/).join(' ')})`;

type Pane = 'main' | 'workouts' | 'trophies' | 'challenges' | 'quests' | 'layouts';
interface Item {
  key: string;
  icon: string;
  title: string;
  sub: string;
  card: CardData;
}

/** Stickers: music, photos & collages, time, emoji, and cards for workouts, trophies, challenges and quests. */
export function StoryStickers({
  open,
  onClose,
  onCard,
  onEmoji,
  onMusic,
  onPhotos,
  onCollage,
  onTime,
  start = 'main',
}: {
  start?: 'main' | 'layouts';
  open: boolean;
  onClose: () => void;
  onCard: (c: CardData) => void;
  onEmoji: (e: string) => void;
  onMusic: () => void;
  onPhotos: () => void;
  onCollage: (layout: number) => void;
  onTime: () => void;
}) {
  const [pane, setPane] = useState<Pane>('main');
  useEffect(() => {
    if (open) setPane(start);
  }, [open]);
  const s = useSettings();
  const workouts = useAllWorkouts();
  const journey = useJourney();
  const quests = useSocial((st) => st.quests);
  const uid = useAccount((a) => a.uid);
  const close = () => {
    onClose();
    setTimeout(() => setPane('main'), 300);
  };

  const lists = useMemo(() => {
    const ws: Workout[] = [...(workouts ?? [])].sort((a, b) => b.start - a.start);
    const accent = accentNow();
    const workoutItems: Item[] = ws.slice(0, 30).map((w) => {
      const sets = w.exercises.reduce((n, e) => n + e.sets.filter((x) => x.type !== 'warmup').length, 0);
      return {
        key: w.id,
        icon: '🏋️',
        title: w.name,
        sub: format(w.start, 'EEE d MMM yyyy'),
        card: {
          title: w.name,
          sub: format(w.start, 'EEEE d MMMM'),
          accent,
          stats: [
            [t('Time'), fmtDurationLong((w.end - w.start) / 1000)],
            [t('Volume'), fmtVolume(workoutVolume(w, typeOf), s)],
            [t('Sets'), String(sets)],
          ],
        },
      };
    });

    const trophyItems: Item[] = ACHIEVEMENTS.flatMap((a) => {
      const u = journey?.unlocked.get(a.id);
      return u ? [{ at: u.date, a }] : [];
    })
      .sort((x, y) => y.at - x.at)
      .map(({ at, a }) => ({
        key: a.id,
        icon: a.icon,
        title: a.name,
        sub: `${t(a.desc)} · ${format(at, 'd MMM yyyy')}`,
        card: { label: t('Trophy unlocked'), icon: a.icon, title: a.name, sub: `${t(a.desc)} · ${format(at, 'd MMM yyyy')}`, stats: [], accent: GOLD },
      }));

    const cx = { typeOf, muscleOf };
    const challengeItems: Item[] = [];
    weeklyChallenges(ws, cx)
      .filter((c) => c.value >= c.target)
      .forEach((c) => {
        const text = challengeText(c, s);
        challengeItems.push({ key: 'w' + c.kind, icon: ICON[c.kind], title: text, sub: t('This week'), card: { label: t('Weekly challenge complete'), icon: ICON[c.kind], title: text, sub: format(new Date(), "'W'w · yyyy"), stats: [], accent } });
      });
    for (const m of monthlyBadges(ws, cx)) {
      const c = monthlyChallenge(ws, cx, parse(m, 'yyyy-MM', new Date()));
      const month = format(parse(m, 'yyyy-MM', new Date()), 'LLLL yyyy');
      const text = challengeText(c, s);
      challengeItems.push({ key: 'm' + m, icon: ICON[c.kind], title: text, sub: month, card: { label: t('Monthly challenge complete'), icon: '🏅', title: text, sub: month, stats: [], accent: GOLD } });
    }
    for (const md of [...(s.medals ?? [])].reverse()) {
      if (md.place < 1 || md.place > 3) continue;
      const icon = ['🥇', '🥈', '🥉'][md.place - 1];
      const month = format(parse(md.m, 'yyyy-MM', new Date()), 'LLLL yyyy');
      const title = t('Place {n} of {of}', { n: md.place, of: md.of });
      challengeItems.push({ key: 'l' + md.m, icon, title, sub: month, card: { label: t('Friends league'), icon, title, sub: month, stats: [], accent: GOLD } });
    }
    const lvl = levelFromXp(journey?.xp ?? 0).level;
    const levelCard: CardData = { label: t('Level {n}', { n: lvl }), icon: '⭐', title: t(levelTitle(lvl)), sub: t('{n} XP total', { n: (journey?.xp ?? 0).toLocaleString() }), stats: [], accent: GOLD };

    const questItems: Item[] = quests.map((q) => {
      const other = q.members.find((m) => m !== uid) ?? '';
      const title = questText(q.kind, q.goal, s);
      const sub = t('with @{nick}', { nick: q.nicks[other] ?? '' });
      return { key: q.id, icon: QUEST_EMOJI[q.kind] ?? '🤝', title, sub: `${sub}${q.done ? ' · ✓' : ''}`, card: { label: q.done ? t('Friends Quest complete') : t('Friends Quest'), icon: QUEST_EMOJI[q.kind] ?? '🤝', title, sub, stats: [], accent: SKY } };
    });
    return { workoutItems, trophyItems, challengeItems, questItems, levelCard };
  }, [workouts, journey, quests, s.weightUnit, s.medals, open]);

  const pick = (c: CardData) => {
    onCard(c);
    close();
  };
  const tile = 'press flex flex-col items-center gap-1 rounded-xl bg-card2 py-3 text-xs font-semibold disabled:opacity-40';
  const list = (items: Item[], empty: string) => (
    <div className="space-y-1.5">
      {items.length === 0 && <div className="py-10 text-center text-sm text-muted">{empty}</div>}
      {items.map((it) => (
        <button key={it.key} onClick={() => pick(it.card)} className="press flex w-full items-center gap-3 rounded-xl bg-card2 p-2.5 text-left">
          <span className="w-9 shrink-0 text-center text-2xl">{it.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{it.title}</div>
            <div className="truncate text-xs text-muted">{it.sub}</div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-muted" />
        </button>
      ))}
    </div>
  );
  const titles: Record<Pane, string> = { main: t('Stickers'), workouts: t('Workouts'), trophies: t('Trophies'), challenges: t('Challenges'), quests: t('Friends Quests'), layouts: t('Collage') };

  return (
    <Sheet
      open={open}
      onClose={close}
      tall={pane !== 'main'}
      title={
        pane === 'main' ? (
          titles.main
        ) : (
          <span className="relative block">
            <button onClick={() => setPane('main')} className="absolute -left-1 top-1/2 -translate-y-1/2 text-accent" aria-label={t('Back')}>
              <ChevronLeft size={24} />
            </button>
            {titles[pane]}
          </span>
        )
      }
    >
      <div className="px-4 pb-6">
        {pane === 'main' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => (close(), onMusic())} className={tile}>
                <Music size={22} className="text-accent" /> {t('Music')}
              </button>
              <button onClick={() => (close(), onPhotos())} className={tile}>
                <ImagePlus size={22} className="text-accent" /> {t('Photos')}
              </button>
              <button onClick={() => setPane('layouts')} className={tile}>
                <LayoutGrid size={22} className="text-accent" /> {t('Collage')}
              </button>
              <button onClick={() => setPane('workouts')} disabled={!lists.workoutItems.length} className={tile}>
                <span className="text-xl leading-none">🏋️</span> {t('Workout')}
              </button>
              <button onClick={() => setPane('trophies')} className={tile}>
                <span className="text-xl leading-none">🏆</span> {t('Trophy')}
              </button>
              <button onClick={() => setPane('challenges')} className={tile}>
                <span className="text-xl leading-none">🏅</span> {t('Challenge')}
              </button>
              <button onClick={() => setPane('quests')} className={tile}>
                <span className="text-xl leading-none">🤝</span> {t('Friends Quest')}
              </button>
              <button onClick={() => pick(lists.levelCard)} className={tile}>
                <span className="text-xl leading-none">⭐</span> {t('Level')}
              </button>
              <button onClick={() => (close(), onTime())} className={tile}>
                <span className="text-xl leading-none">🕒</span> {t('Time')}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-8 gap-1">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => (close(), onEmoji(e))} className="press py-1.5 text-3xl">
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
        {pane === 'workouts' && list(lists.workoutItems, t('No workouts yet'))}
        {pane === 'trophies' && list(lists.trophyItems, t('No trophies yet. Keep training!'))}
        {pane === 'challenges' && list(lists.challengeItems, t('Finish a weekly or monthly challenge and it shows up here.'))}
        {pane === 'quests' && list(lists.questItems, t('Start a Friends Quest in the Compete tab.'))}
        {pane === 'layouts' && (
          <>
            <div className="mb-3 text-sm text-muted">{t('Pick a layout, then choose your photos.')}</div>
            <div className="grid grid-cols-3 gap-3">
              {LAYOUTS.map((cells, i) => (
                <button key={i} onClick={() => (close(), onCollage(i))} className="press mx-auto flex flex-col items-center gap-1.5">
                  <div className="relative h-[112px] w-[63px] overflow-hidden rounded-lg bg-card2">
                    {cells.map(([x, y, w, h], k) => (
                      <div key={k} className="absolute rounded-[3px] bg-accent/70" style={{ left: `calc(${x * 100}% + 2px)`, top: `calc(${y * 100}% + 2px)`, width: `calc(${w * 100}% - 4px)`, height: `calc(${h * 100}% - 4px)` }} />
                    ))}
                  </div>
                  <span className="text-xs text-muted">{t('{n} photos', { n: cells.length })}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
