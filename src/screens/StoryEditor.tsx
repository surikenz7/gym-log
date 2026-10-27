import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, ImagePlus, Music, Palette, Pencil, Smile, Sparkles, Trash2, Type, Undo2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../cloud/account';
import { refreshStories, useStories, useStoryDraft } from '../cloud/storyStore';
import { MusicPicker } from '../components/MusicPicker';
import { Portal, Sheet } from '../components/ui';
import { Avatar } from '../components/WorkoutFeed';
import { t } from '../i18n';
import { typeOf } from '../lib/exercises';
import { haptic } from '../lib/haptics';
import { useAllWorkouts } from '../lib/hooks';
import { stopSong, useStopOnUnmount } from '../lib/music';
import { workoutVolume } from '../lib/stats';
import {
  COLORS,
  drawScene,
  emptyScene,
  exportScene,
  fitScale,
  FONTS,
  GRADIENTS,
  hitTest,
  loadFonts,
  loadPhoto,
  SH,
  SW,
  type Layer,
  type Scene,
  type Stroke,
  type TextLayer,
} from '../lib/storyCanvas';
import { fmtDurationLong, fmtVolume } from '../lib/units';
import { confirmDialog, toast } from '../state/dialog';
import { useSettings } from '../state/settings';

const EMOJIS = ['💪', '🏋️', '🔥', '⚡', '🏆', '🥇', '💯', '🙌', '😤', '🥵', '😎', '🤝', '❤️', '🎯', '🚀', '⏱️', '🥗', '🍗', '💤', '🧠', '👑', '🦍', '😈', '✅', '📈', '🫡', '🤯', '🥶', '☀️', '🌙', '🎧', '📸'];
const uid = () => Math.random().toString(36).slice(2, 9);
const isText = (l: Layer | null | undefined): l is TextLayer => l?.kind === 'text';

type Point = { x: number; y: number };
type Target = Layer | 'bg';
interface Gesture {
  target: Target | null;
  start: { x: number; y: number; s: number; r: number };
  p0: Point;
  d0: number;
  a0: number;
  moved: boolean;
  t0: number;
}

export function StoryEditor() {
  const nav = useNavigate();
  const settings = useSettings();
  const me = useAccount((a) => a.uid);
  const workouts = useAllWorkouts();
  const scene = useRef<Scene>(emptyScene());
  const canvas = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [, render] = useReducer((x: number) => x + 1, 0);
  const [mode, setMode] = useState<'edit' | 'text' | 'draw'>('edit');
  const [editing, setEditing] = useState<{ layer: TextLayer; isNew: boolean } | null>(null);
  const [stickers, setStickers] = useState(false);
  const [music, setMusic] = useState(false);
  const [drag, setDrag] = useState<'none' | 'layer' | 'trash'>('none');
  const [pen, setPen] = useState({ color: COLORS[0], size: 14, neon: false });
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useStopOnUnmount();

  /* ---------- drawing ---------- */
  const frame = useRef(0);
  const draw = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const c = canvas.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      g.setTransform(c.width / SW, 0, 0, c.height / SH, 0, 0);
      drawScene(g, scene.current, { skip: editing?.layer.id, onLoad: draw });
    });
  };
  const ctx = () => {
    const g = canvas.current!.getContext('2d')!;
    g.setTransform(canvas.current!.width / SW, 0, 0, canvas.current!.height / SH, 0, 0);
    return g;
  };

  // stage size: as big as fits between the top bar and the share bar, 9:16
  useLayoutEffect(() => {
    const fitBox = () => {
      const el = root.current;
      if (!el) return;
      const availH = el.clientHeight - (parseFloat(getComputedStyle(el).paddingTop) || 0) - 84;
      const w = Math.min(window.innerWidth, (availH * 9) / 16);
      setBox({ w: Math.round(w), h: Math.round((w * 16) / 9) });
    };
    fitBox();
    addEventListener('resize', fitBox);
    requestAnimationFrame(fitBox);
    return () => removeEventListener('resize', fitBox);
  }, []);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !box.w) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = Math.round(box.w * dpr);
    c.height = Math.round(box.h * dpr);
    void loadFonts().then(draw);
    draw();
  }, [box.w, box.h]);
  useEffect(draw, [editing]);

  // started from "Add to story" on a workout
  useEffect(() => {
    const img = useStoryDraft.getState().img;
    if (!img) return;
    useStoryDraft.setState({ img: null });
    void loadPhoto(img).then(({ img, w, h }) => {
      scene.current.bg = { img, w, h, x: SW / 2, y: SH / 2, s: fitScale(w, h, true) * 0.92, r: 0 };
      scene.current.grad = 2;
      render();
      draw();
    });
  }, []);

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const { img, w, h } = await loadPhoto(f);
      scene.current.bg = { img, w, h, x: SW / 2, y: SH / 2, s: fitScale(w, h), r: 0 };
      render();
      draw();
    } catch {
      toast(t('Something went wrong'));
    }
  };

  const addLayer = (l: Omit<Layer, 'id' | 'x' | 'y' | 's' | 'r'> & Partial<Layer>) => {
    const layer = { id: uid(), x: SW / 2, y: SH / 2, s: 1, r: 0, ...l } as Layer;
    scene.current.layers.push(layer);
    haptic();
    render();
    draw();
    return layer;
  };
  const removeLayer = (l: Layer) => {
    scene.current.layers = scene.current.layers.filter((x) => x !== l);
    if (l.kind === 'music') {
      scene.current.song = null;
      stopSong();
    }
    render();
    draw();
  };

  const newText = (at?: Point) => {
    const last = [...scene.current.layers].reverse().find(isText);
    setEditing({ layer: { id: uid(), kind: 'text', text: '', color: last?.color ?? '#ffffff', font: last?.font ?? 'classic', bg: last?.bg ?? 0, x: at?.x ?? SW / 2, y: at?.y ?? SH * 0.42, s: 1, r: 0 }, isNew: true });
    setMode('text');
  };
  const finishText = () => {
    if (!editing) return;
    const { layer, isNew } = editing;
    if (!layer.text.trim()) {
      if (!isNew) removeLayer(scene.current.layers.find((l) => l.id === layer.id)!);
    } else if (isNew) scene.current.layers.push(layer);
    else scene.current.layers = scene.current.layers.map((l) => (l.id === layer.id ? layer : l));
    setEditing(null);
    setMode('edit');
    render();
  };

  /* ---------- gestures ---------- */
  const ptrs = useRef(new Map<number, Point>());
  const gest = useRef<Gesture | null>(null);
  const stroke = useRef<Stroke | null>(null);
  const toStage = (e: React.PointerEvent): Point => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  };
  const tf = (tg: Target) => (tg === 'bg' ? scene.current.bg : tg);
  const rebase = () => {
    const g = gest.current;
    if (!g?.target) return;
    const o = tf(g.target);
    g.start = { x: o.x, y: o.y, s: o.s, r: o.r };
    const ps = [...ptrs.current.values()];
    if (ps.length >= 2) {
      g.p0 = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      g.d0 = Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y) || 1;
      g.a0 = Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x);
    } else if (ps.length === 1) g.p0 = ps[0];
  };
  const inTrash = (p: Point) => p.y > SH - 300 && Math.abs(p.x - SW / 2) < 220;

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toStage(e);
    ptrs.current.set(e.pointerId, p);
    if (mode === 'draw') {
      if (ptrs.current.size === 1) {
        stroke.current = { ...pen, size: pen.size * 3, pts: [p.x, p.y] };
        scene.current.strokes.push(stroke.current);
        draw();
      }
      return;
    }
    if (ptrs.current.size === 1) {
      const hit = hitTest(ctx(), scene.current, p.x, p.y);
      if (hit) {
        // bring to front
        scene.current.layers = [...scene.current.layers.filter((l) => l !== hit), hit];
      }
      gest.current = { target: hit ?? (scene.current.bg.img ? 'bg' : null), start: { x: 0, y: 0, s: 1, r: 0 }, p0: p, d0: 1, a0: 0, moved: false, t0: Date.now() };
    } else if (gest.current && !gest.current.target && scene.current.bg.img) gest.current.target = 'bg';
    rebase();
  };
  const move = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const p = toStage(e);
    ptrs.current.set(e.pointerId, p);
    if (mode === 'draw') {
      if (stroke.current && ptrs.current.size === 1) {
        stroke.current.pts.push(p.x, p.y);
        draw();
      }
      return;
    }
    const g = gest.current;
    if (!g?.target) return;
    const o = tf(g.target);
    const ps = [...ptrs.current.values()];
    if (ps.length >= 2) {
      const mid = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      const d = Math.hypot(ps[1].x - ps[0].x, ps[1].y - ps[0].y);
      const a = Math.atan2(ps[1].y - ps[0].y, ps[1].x - ps[0].x);
      o.s = Math.min(12, Math.max(0.08, (g.start.s * d) / g.d0));
      o.r = g.start.r + a - g.a0;
      o.x = g.start.x + mid.x - g.p0.x;
      o.y = g.start.y + mid.y - g.p0.y;
      g.moved = true;
    } else {
      const dx = p.x - g.p0.x;
      const dy = p.y - g.p0.y;
      if (Math.hypot(dx, dy) > 14) g.moved = true;
      o.x = g.start.x + dx;
      o.y = g.start.y + dy;
      if (g.target !== 'bg' && g.moved) {
        const next = inTrash(p) ? 'trash' : 'layer';
        if (next !== drag) {
          if (next === 'trash') haptic();
          setDrag(next);
        }
      }
    }
    draw();
  };
  const up = (e: React.PointerEvent) => {
    const p = ptrs.current.get(e.pointerId) ?? toStage(e);
    ptrs.current.delete(e.pointerId);
    if (mode === 'draw') {
      if (!ptrs.current.size) stroke.current = null;
      render();
      return;
    }
    const g = gest.current;
    if (ptrs.current.size) return rebase();
    gest.current = null;
    setDrag('none');
    if (!g) return;
    const tg = g.target;
    if (tg && tg !== 'bg' && g.moved && inTrash(p) && ptrs.current.size === 0) {
      removeLayer(tg);
      haptic();
      return;
    }
    if (!g.moved && Date.now() - g.t0 < 400) {
      if (isText(tg as Layer)) {
        setEditing({ layer: { ...(tg as TextLayer) }, isNew: false });
        setMode('text');
      } else if (tg && tg !== 'bg' && tg.kind === 'music') {
        tg.dark = !tg.dark;
        draw();
      } else if (!tg || tg === 'bg') newText(p);
    }
    render();
  };

  /* ---------- actions ---------- */
  const dirty = () => !!(scene.current.bg.img || scene.current.layers.length || scene.current.strokes.length);
  const close = async () => {
    if (dirty() && !(await confirmDialog(t('Discard story?'), t('Your edits will be lost.'), t('Discard'), true))) return;
    nav(-1);
  };
  const save = async () => {
    try {
      const data = await exportScene(scene.current);
      const blob = await (await fetch(data)).blob();
      const f = new File([blob], `story-${format(new Date(), 'yyyyMMdd-HHmm')}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f] });
      else {
        const a = document.createElement('a');
        a.href = data;
        a.download = f.name;
        a.click();
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast(t('Something went wrong'));
    }
  };
  const publish = async () => {
    if (!me || busy) return;
    setBusy(true);
    try {
      const img = await exportScene(scene.current);
      await (await import('../cloud/stories')).postStory(me, img, scene.current.song);
      useStories.setState((s) => ({ me: { ...(s.me ?? {}), last: Date.now() } }));
      void refreshStories(true);
      haptic('success');
      toast(t('Shared to your story'));
      nav(-1);
    } catch {
      toast(navigator.onLine ? t('Something went wrong') : t('No internet connection'));
      setBusy(false);
    }
  };

  const latest = workouts?.length ? workouts.reduce((a, b) => (a.start > b.start ? a : b)) : null;
  const addWorkoutCard = () => {
    if (!latest) return;
    const sets = latest.exercises.reduce((n, e) => n + e.sets.filter((s) => s.type !== 'warmup').length, 0);
    const accent = `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().split(/[\s,]+/).join(' ')})`;
    addLayer({
      kind: 'card',
      title: latest.name,
      sub: format(latest.start, 'EEEE d MMMM'),
      accent,
      stats: [
        [t('Time'), fmtDurationLong((latest.end - latest.start) / 1000)],
        [t('Volume'), fmtVolume(workoutVolume(latest, typeOf), settings)],
        [t('Sets'), String(sets)],
      ],
      y: SH * 0.62,
    });
    setStickers(false);
  };

  const empty = !scene.current.bg.img && !scene.current.layers.length && !scene.current.strokes.length && mode === 'edit';
  const tool = 'press flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-[#fff] backdrop-blur';
  const editFont = editing && FONTS.find((f) => f.id === editing.layer.font)!;

  return (
    <Portal>
      <div ref={root} className="fixed inset-0 z-[45] flex flex-col items-center bg-black text-[#fff]" style={{ paddingTop: 'var(--sat)' }}>
        <div className="relative overflow-hidden rounded-2xl" style={{ width: box.w, height: box.h }}>
          <canvas ref={canvas} className="h-full w-full touch-none" style={{ width: box.w, height: box.h }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />

          {empty && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <div className="font-display text-3xl font-bold uppercase">{t('Tap to type')}</div>
              <div className="text-sm text-[#fff]/75">{t('or add a photo')}</div>
            </div>
          )}

          {/* top bar */}
          {mode === 'edit' && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 [&_button]:pointer-events-auto">
              <button onClick={close} className={tool} aria-label={t('Close')}>
                <X size={24} />
              </button>
              <div className="flex flex-col gap-2.5">
                <button onClick={() => newText()} className={tool} aria-label={t('Text')}>
                  <Type size={22} />
                </button>
                <button onClick={() => setStickers(true)} className={tool} aria-label={t('Stickers')}>
                  <Smile size={22} />
                </button>
                <button onClick={() => setMusic(true)} className={tool} aria-label={t('Add music')}>
                  <Music size={22} />
                </button>
                <button onClick={() => setMode('draw')} className={tool} aria-label={t('Draw')}>
                  <Pencil size={21} />
                </button>
                <button
                  onClick={() => {
                    scene.current.grad = (scene.current.grad + 1) % GRADIENTS.length;
                    haptic();
                    draw();
                  }}
                  className={tool}
                  aria-label={t('Background')}
                >
                  <Palette size={21} />
                </button>
                <button onClick={save} className={tool} aria-label={t('Save')}>
                  <Download size={21} />
                </button>
              </div>
            </div>
          )}

          {/* drawing tools */}
          {mode === 'draw' && (
            <div className="pointer-events-none absolute inset-x-0 top-0 space-y-3 p-3 [&_button]:pointer-events-auto [&_input]:pointer-events-auto">
              <div className="flex items-center justify-between">
                <button onClick={() => (scene.current.strokes.pop(), draw(), render())} className={tool} aria-label={t('Undo')}>
                  <Undo2 size={21} />
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPen((p) => ({ ...p, neon: !p.neon }))} className={`${tool} ${pen.neon ? '!bg-[#fff] !text-black' : ''}`} aria-label={t('Neon')}>
                    <Sparkles size={20} />
                  </button>
                  <button onClick={() => setMode('edit')} className="press rounded-full bg-[#fff] px-4 py-2 text-sm font-bold text-black">
                    {t('Done')}
                  </button>
                </div>
              </div>
              <input type="range" min={4} max={40} value={pen.size} onChange={(e) => setPen((p) => ({ ...p, size: +e.target.value }))} className="w-full accent-[#fff]" />
            </div>
          )}
          {mode === 'draw' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-2 [&_button]:pointer-events-auto">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setPen((p) => ({ ...p, color: c }))} className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: pen.color === c ? '#fff' : 'rgba(255,255,255,0.35)', transform: pen.color === c ? 'scale(1.2)' : undefined }} />
              ))}
            </div>
          )}

          {/* trash while dragging a sticker */}
          <AnimatePresence>
            {drag !== 'none' && (
              <motion.div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
                <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#fff]/70 transition-transform ${drag === 'trash' ? 'scale-125 bg-danger' : 'bg-black/40'}`}>
                  <Trash2 size={24} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* text editing */}
          {mode === 'text' && editing && editFont && (
            <div className="absolute inset-0 flex flex-col bg-black/55">
              <div className="flex items-center justify-between p-3">
                <button
                  onClick={() => setEditing({ ...editing, layer: { ...editing.layer, bg: ((editing.layer.bg + 1) % 3) as 0 | 1 | 2 } })}
                  className={`${tool} font-display text-lg font-bold`}
                  aria-label={t('Text background')}
                >
                  <span className={`rounded px-1 ${editing.layer.bg === 1 ? 'bg-[#fff] text-black' : editing.layer.bg === 2 ? 'bg-[#fff]/40' : 'border border-[#fff]'}`}>A</span>
                </button>
                <button onClick={finishText} className="press rounded-full bg-[#fff] px-4 py-2 text-sm font-bold text-black">
                  {t('Done')}
                </button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setEditing({ ...editing, layer: { ...editing.layer, font: f.id } })}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${editing.layer.font === f.id ? 'bg-[#fff] text-black' : 'bg-black/40 text-[#fff]'}`}
                    style={{ fontFamily: f.family, fontWeight: f.weight.replace('italic ', '') as unknown as number, fontStyle: f.weight.startsWith('italic') ? 'italic' : undefined }}
                  >
                    {t(f.label)}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex justify-center gap-2 px-3">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setEditing({ ...editing, layer: { ...editing.layer, color: c } })} className="h-6 w-6 rounded-full border-2" style={{ background: c, borderColor: editing.layer.color === c ? '#fff' : 'rgba(255,255,255,0.35)', transform: editing.layer.color === c ? 'scale(1.2)' : undefined }} />
                ))}
              </div>
              <div className="flex flex-1 items-center justify-center px-4">
                <textarea
                  autoFocus
                  value={editing.layer.text}
                  onChange={(e) => setEditing({ ...editing, layer: { ...editing.layer, text: e.target.value } })}
                  rows={Math.min(5, editing.layer.text.split('\n').length)}
                  className="w-full resize-none bg-transparent text-center text-[30px] leading-tight outline-none"
                  style={{
                    fontFamily: editFont.family,
                    fontWeight: editFont.weight.replace('italic ', '') as unknown as number,
                    fontStyle: editFont.weight.startsWith('italic') ? 'italic' : undefined,
                    textTransform: editFont.upper ? 'uppercase' : undefined,
                    color: editing.layer.bg === 1 ? undefined : editing.layer.color,
                    textShadow: editFont.id === 'neon' ? `0 0 14px ${editing.layer.color}` : undefined,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* bottom bar */}
        <div className="flex w-full items-center justify-between gap-3 px-4" style={{ height: 84, maxWidth: Math.max(box.w, 320) }}>
          <button onClick={() => file.current?.click()} className="press flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff]/15" aria-label={t('Add a photo')}>
            <ImagePlus size={24} />
          </button>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => (void pickPhoto(e.target.files?.[0]), (e.target.value = ''))} />
          {me ? (
            <button onClick={publish} disabled={busy || mode !== 'edit'} className="press flex items-center gap-2 rounded-full bg-[#fff] py-1.5 pl-1.5 pr-5 font-semibold text-black disabled:opacity-50">
              <Avatar size={34} deco={null} />
              {busy ? t('Sharing…') : t('Your story')}
            </button>
          ) : (
            <button onClick={save} className="press rounded-full bg-[#fff] px-5 py-2.5 font-semibold text-black">
              {t('Save')}
            </button>
          )}
        </div>
      </div>

      <Sheet open={stickers} onClose={() => setStickers(false)} title={t('Stickers')}>
        <div className="px-4 pb-6">
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => (setStickers(false), setMusic(true))} className="press flex flex-col items-center gap-1 rounded-xl bg-card2 py-3 text-xs font-semibold">
              <Music size={22} className="text-accent" /> {t('Music')}
            </button>
            <button onClick={addWorkoutCard} disabled={!latest} className="press flex flex-col items-center gap-1 rounded-xl bg-card2 py-3 text-xs font-semibold disabled:opacity-40">
              <span className="text-xl leading-none">🏋️</span> {t('Last workout')}
            </button>
            <button
              onClick={() => {
                addLayer({ kind: 'text', text: format(new Date(), 'HH:mm'), color: '#ffffff', font: 'strong', bg: 2, y: SH * 0.3, s: 1.6 } as Layer);
                setStickers(false);
              }}
              className="press flex flex-col items-center gap-1 rounded-xl bg-card2 py-3 text-xs font-semibold"
            >
              <span className="text-xl leading-none">🕒</span> {t('Time')}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  addLayer({ kind: 'emoji', emoji: e, x: SW / 2 + (Math.random() - 0.5) * 200, y: SH / 2 + (Math.random() - 0.5) * 300 } as Layer);
                  setStickers(false);
                }}
                className="press py-1.5 text-3xl"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      <MusicPicker
        open={music}
        onClose={() => setMusic(false)}
        onPick={(song) => {
          setMusic(false);
          const old = scene.current.layers.find((l) => l.kind === 'music');
          if (old) scene.current.layers = scene.current.layers.filter((l) => l !== old);
          scene.current.song = song;
          addLayer({ kind: 'music', song, dark: false, y: SH * 0.72 } as Layer);
        }}
      />
    </Portal>
  );
}
