import type { Song } from './music';

/*
 * Story scene: a background (photo or gradient), pen strokes and movable layers (text, emoji,
 * music and workout stickers). The same draw code renders the editor preview and the final
 * 1080×1920 JPEG, so what you see is what gets posted.
 */

export const SW = 1080;
export const SH = 1920;

export type FontId = 'classic' | 'strong' | 'elegant' | 'round' | 'neon' | 'type';
export const FONTS: { id: FontId; label: string; family: string; weight: string; upper?: boolean }[] = [
  { id: 'classic', label: 'Classic', family: '-apple-system, system-ui, sans-serif', weight: '700' },
  { id: 'strong', label: 'Strong', family: 'Oswald, Impact, sans-serif', weight: '700', upper: true },
  { id: 'elegant', label: 'Elegant', family: '"Playfair Display", Georgia, serif', weight: '700' },
  { id: 'round', label: 'Round', family: 'Fredoka, system-ui, sans-serif', weight: '600' },
  { id: 'neon', label: 'Neon', family: '"Exo 2", system-ui, sans-serif', weight: 'italic 800' },
  { id: 'type', label: 'Typewriter', family: '"Courier New", Courier, monospace', weight: '700' },
];
const fontOf = (id: FontId) => FONTS.find((f) => f.id === id) ?? FONTS[0];
export const fontCss = (id: FontId, px: number) => `${fontOf(id).weight} ${px}px ${fontOf(id).family}`;
/** Makes sure the web fonts are loaded before drawing on a canvas. */
export const loadFonts = () => Promise.all(FONTS.map((f) => document.fonts?.load(fontCss(f.id, 40)).catch(() => null)));

export const COLORS = ['#ffffff', '#000000', '#e5262d', '#fa7e1e', '#feda75', '#22c55e', '#38bdf8', '#4f5bd5', '#d62976', '#a855f7'];
export const GRADIENTS: [string, string][] = [
  ['#4f5bd5', '#d62976'],
  ['#fa7e1e', '#d62976'],
  ['#111111', '#e5262d'],
  ['#0f172a', '#334155'],
  ['#065f46', '#22c55e'],
  ['#1e3a8a', '#38bdf8'],
  ['#7c2d12', '#f59e0b'],
  ['#e7e5e4', '#a8a29e'],
];

interface Base {
  id: string;
  x: number;
  y: number;
  /** scale */
  s: number;
  /** rotation, radians */
  r: number;
}
export interface TextLayer extends Base {
  kind: 'text';
  text: string;
  color: string;
  font: FontId;
  /** 0 plain, 1 solid box, 2 soft box */
  bg: 0 | 1 | 2;
}
export interface EmojiLayer extends Base {
  kind: 'emoji';
  emoji: string;
}
export interface MusicLayer extends Base {
  kind: 'music';
  song: Song;
  dark: boolean;
}
/** Workout, trophy, challenge or quest card. */
export interface CardLayer extends Base {
  kind: 'card';
  title: string;
  sub: string;
  stats: [string, string][];
  accent: string;
  /** small line above the title, e.g. "Trophy unlocked" */
  label?: string;
  /** big emoji on the left */
  icon?: string;
}
/** A picture placed on the story (collages): cropped to its frame, with rounded corners. */
export interface PhotoLayer extends Base {
  kind: 'photo';
  img: CanvasImageSource;
  iw: number;
  ih: number;
  /** frame size before scaling */
  w: number;
  h: number;
  /** white border */
  border: boolean;
}
export type Layer = TextLayer | EmojiLayer | MusicLayer | CardLayer | PhotoLayer;

export interface Stroke {
  color: string;
  size: number;
  neon: boolean;
  pts: number[];
}

export interface Scene {
  grad: number;
  bg: { img: CanvasImageSource | null; w: number; h: number; x: number; y: number; s: number; r: number };
  strokes: Stroke[];
  layers: Layer[];
  song: Song | null;
}

export const emptyScene = (): Scene => ({ grad: 0, bg: { img: null, w: 0, h: 0, x: SW / 2, y: SH / 2, s: 1, r: 0 }, strokes: [], layers: [], song: null });

const images = new Map<string, HTMLImageElement>();
/** Cover art etc., loaded with CORS so the canvas can still be exported. */
function cachedImage(src: string, onLoad?: () => void) {
  let im = images.get(src);
  if (!im) {
    im = new Image();
    im.crossOrigin = 'anonymous';
    im.src = src;
    images.set(src, im);
  }
  if (!(im.complete && im.naturalWidth)) {
    if (onLoad) im.addEventListener('load', onLoad, { once: true });
    return null;
  }
  return im;
}

/** A photo shrunk to at most `max` px on its long side (keeps the editor fast). */
export async function loadPhoto(src: Blob, max = 2160): Promise<{ img: HTMLCanvasElement; w: number; h: number }> {
  const url = URL.createObjectURL(src);
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k);
    c.height = Math.round(im.naturalHeight * k);
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(im, 0, 0, c.width, c.height);
    return { img: c, w: c.width, h: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const TEXT_PX = 84;
const LINE = 1.25;
const light = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
};
const textLines = (l: TextLayer) => (fontOf(l.font).upper ? l.text.toUpperCase() : l.text).split('\n');

function fit(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

/** Width / height of a layer before scaling. */
export function layerSize(g: CanvasRenderingContext2D, l: Layer) {
  switch (l.kind) {
    case 'text': {
      g.font = fontCss(l.font, TEXT_PX);
      const lines = textLines(l);
      const w = Math.max(...lines.map((s) => g.measureText(s).width));
      return { w: w + 60, h: lines.length * TEXT_PX * LINE + 40 };
    }
    case 'emoji':
      return { w: 200, h: 200 };
    case 'music':
      return { w: 660, h: 180 };
    case 'card':
      return { w: 780, h: cardHeight(l) };
    case 'photo':
      return { w: l.w, h: l.h };
  }
}
const cardHeight = (l: CardLayer) => (l.stats.length ? 360 : 230);

function drawText(g: CanvasRenderingContext2D, l: TextLayer) {
  const lines = textLines(l);
  g.font = fontCss(l.font, TEXT_PX);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lh = TEXT_PX * LINE;
  const top = (-(lines.length - 1) * lh) / 2;
  if (l.bg) {
    g.fillStyle = l.bg === 1 ? l.color : light(l.color) ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.8)';
    lines.forEach((s, i) => {
      if (!s.trim()) return;
      const w = g.measureText(s).width + 44;
      g.beginPath();
      g.roundRect(-w / 2, top + i * lh - lh / 2 - 1, w, lh + 2, 22);
      g.fill();
    });
  }
  const fill = l.bg === 1 ? (light(l.color) ? '#000' : '#fff') : l.color;
  if (l.font === 'neon') {
    g.shadowColor = l.color;
    g.shadowBlur = 36;
    g.fillStyle = l.bg === 1 ? fill : '#fff';
    lines.forEach((s, i) => g.fillText(s, 0, top + i * lh));
  } else if (!l.bg) {
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 10;
  }
  g.fillStyle = l.font === 'neon' && !l.bg ? '#fff' : fill;
  lines.forEach((s, i) => g.fillText(s, 0, top + i * lh));
}

function drawMusic(g: CanvasRenderingContext2D, l: MusicLayer, onLoad?: () => void) {
  const w = 660;
  const h = 180;
  g.shadowColor = 'rgba(0,0,0,0.3)';
  g.shadowBlur = 24;
  g.fillStyle = l.dark ? 'rgba(18,18,20,0.92)' : '#ffffff';
  g.beginPath();
  g.roundRect(-w / 2, -h / 2, w, h, 40);
  g.fill();
  g.shadowBlur = 0;
  const art = l.song.art ? cachedImage(l.song.art, onLoad) : null;
  g.save();
  g.beginPath();
  g.roundRect(-w / 2 + 25, -h / 2 + 25, 130, 130, 20);
  g.clip();
  if (art) g.drawImage(art, -w / 2 + 25, -h / 2 + 25, 130, 130);
  else {
    g.fillStyle = '#d62976';
    g.fill();
  }
  g.restore();
  const x = -w / 2 + 185;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillStyle = l.dark ? '#fff' : '#111';
  g.font = '700 44px -apple-system, system-ui, sans-serif';
  g.fillText(fit(g, l.song.title, w - 230), x, -8);
  g.fillStyle = l.dark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)';
  g.font = '500 34px -apple-system, system-ui, sans-serif';
  g.fillText(fit(g, '♫ ' + l.song.artist, w - 230), x, 44);
}

function drawCard(g: CanvasRenderingContext2D, l: CardLayer) {
  const w = 780;
  const h = cardHeight(l);
  const top = -h / 2;
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 30;
  g.fillStyle = 'rgba(14,14,16,0.92)';
  g.beginPath();
  g.roundRect(-w / 2, top, w, h, 36);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = l.accent;
  g.fillRect(-w / 2, top + 40, 12, 150);
  let x = -w / 2 + 45;
  if (l.icon) {
    g.save();
    g.globalAlpha = 0.22;
    g.fillStyle = l.accent;
    g.beginPath();
    g.arc(x + 70, top + 115, 70, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.font = '86px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(l.icon, x + 70, top + 120);
    x += 170;
  }
  const max = w / 2 - 40 - x;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  if (l.label) {
    g.fillStyle = l.accent;
    g.font = '700 26px -apple-system, system-ui, sans-serif';
    g.fillText(fit(g, l.label.toUpperCase(), max), x, top + 70);
  }
  g.fillStyle = '#fff';
  g.font = '700 60px Oswald, Impact, sans-serif';
  g.fillText(fit(g, l.title.toUpperCase(), max), x, top + (l.label ? 135 : 110));
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.font = '500 30px -apple-system, system-ui, sans-serif';
  g.fillText(fit(g, l.sub, max), x, top + (l.label ? 182 : 160));
  const cw = (w - 90) / Math.max(1, l.stats.length);
  l.stats.forEach(([k, v], i) => {
    const sx = -w / 2 + 45 + i * cw;
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.font = '600 26px -apple-system, system-ui, sans-serif';
    g.fillText(k.toUpperCase(), sx, h / 2 - 95);
    g.fillStyle = '#fff';
    g.font = '700 50px Oswald, Impact, sans-serif';
    g.fillText(fit(g, v, cw - 16), sx, h / 2 - 40);
  });
}

function drawPhoto(g: CanvasRenderingContext2D, l: PhotoLayer) {
  const { w, h } = l;
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 26;
  if (l.border) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.roundRect(-w / 2 - 14, -h / 2 - 14, w + 28, h + 28, 34);
    g.fill();
  }
  g.save();
  g.beginPath();
  g.roundRect(-w / 2, -h / 2, w, h, 24);
  g.fillStyle = '#222';
  g.fill();
  g.shadowBlur = 0;
  g.clip();
  // cover the frame, centred
  const k = Math.max(w / l.iw, h / l.ih);
  g.drawImage(l.img, -(l.iw * k) / 2, -(l.ih * k) / 2, l.iw * k, l.ih * k);
  g.restore();
}

export function drawLayer(g: CanvasRenderingContext2D, l: Layer, onLoad?: () => void) {
  g.save();
  g.translate(l.x, l.y);
  g.rotate(l.r);
  g.scale(l.s, l.s);
  if (l.kind === 'text') drawText(g, l);
  else if (l.kind === 'emoji') {
    g.font = '170px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(l.emoji, 0, 8);
  } else if (l.kind === 'music') drawMusic(g, l, onLoad);
  else if (l.kind === 'photo') drawPhoto(g, l);
  else drawCard(g, l);
  g.restore();
}

export function drawStroke(g: CanvasRenderingContext2D, st: Stroke) {
  if (st.pts.length < 2) return;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = st.size;
  g.beginPath();
  g.moveTo(st.pts[0], st.pts[1]);
  if (st.pts.length === 2) g.lineTo(st.pts[0] + 0.1, st.pts[1]);
  for (let i = 2; i < st.pts.length; i += 2) g.lineTo(st.pts[i], st.pts[i + 1]);
  if (st.neon) {
    g.shadowColor = st.color;
    g.shadowBlur = st.size * 1.6;
    g.strokeStyle = st.color;
    g.stroke();
    g.shadowBlur = 0;
    g.lineWidth = st.size * 0.45;
    g.strokeStyle = '#fff';
  } else g.strokeStyle = st.color;
  g.stroke();
  g.restore();
}

/** Draws the whole scene in story coordinates (the context must already be scaled to 1080×1920). */
export function drawScene(g: CanvasRenderingContext2D, sc: Scene, opts: { skip?: string; onLoad?: () => void } = {}) {
  const [a, b] = GRADIENTS[sc.grad % GRADIENTS.length];
  const grad = g.createLinearGradient(0, 0, SW * 0.4, SH);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  g.fillStyle = grad;
  g.fillRect(0, 0, SW, SH);
  const bg = sc.bg;
  if (bg.img) {
    g.save();
    g.translate(bg.x, bg.y);
    g.rotate(bg.r);
    g.scale(bg.s, bg.s);
    g.drawImage(bg.img, -bg.w / 2, -bg.h / 2, bg.w, bg.h);
    g.restore();
  }
  sc.strokes.forEach((st) => drawStroke(g, st));
  for (const l of sc.layers) if (l.id !== opts.skip) drawLayer(g, l, opts.onLoad);
}

/** Topmost layer under a point (story coordinates). */
export function hitTest(g: CanvasRenderingContext2D, sc: Scene, x: number, y: number): Layer | null {
  for (let i = sc.layers.length - 1; i >= 0; i--) {
    const l = sc.layers[i];
    const dx = x - l.x;
    const dy = y - l.y;
    const lx = (dx * Math.cos(-l.r) - dy * Math.sin(-l.r)) / l.s;
    const ly = (dx * Math.sin(-l.r) + dy * Math.cos(-l.r)) / l.s;
    const { w, h } = layerSize(g, l);
    const pad = 30 / l.s;
    if (Math.abs(lx) <= w / 2 + pad && Math.abs(ly) <= h / 2 + pad) return l;
  }
  return null;
}

/** Scale that makes a picture cover (or, with `contain`, fit inside) the story. */
/** Collage layouts: cells as [x, y, w, h] fractions of the story. */
export const LAYOUTS: [number, number, number, number][][] = [
  [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
  [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
  [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]],
  [[0, 0, 0.5, 1 / 3], [0.5, 0, 0.5, 1 / 3], [0, 1 / 3, 0.5, 1 / 3], [0.5, 1 / 3, 0.5, 1 / 3], [0, 2 / 3, 0.5, 1 / 3], [0.5, 2 / 3, 0.5, 1 / 3]],
];

/** Photo layers filling a collage layout (gap between the cells, inset from the edges). */
export function collage(layout: [number, number, number, number][], photos: { img: CanvasImageSource; w: number; h: number }[], id: () => string): PhotoLayer[] {
  const gap = 18;
  return photos.slice(0, layout.length).map((p, i) => {
    const [x, y, w, h] = layout[i];
    return {
      id: id(),
      kind: 'photo',
      img: p.img,
      iw: p.w,
      ih: p.h,
      x: (x + w / 2) * SW,
      y: (y + h / 2) * SH,
      w: w * SW - gap * 2,
      h: h * SH - gap * 2,
      s: 1,
      r: 0,
      border: false,
    };
  });
}

export const fitScale = (w: number, h: number, contain = false) => (contain ? Math.min(SW / w, SH / h) : Math.max(SW / w, SH / h));

/** Renders the scene to a JPEG data URL that fits in a Firestore document. */
export async function exportScene(sc: Scene, maxBytes = 640_000): Promise<string> {
  await loadFonts();
  for (const k of [1, 0.8, 0.65]) {
    const c = document.createElement('canvas');
    c.width = Math.round(SW * k);
    c.height = Math.round(SH * k);
    const g = c.getContext('2d')!;
    g.scale(k, k);
    drawScene(g, sc);
    for (const q of [0.86, 0.78, 0.7, 0.6]) {
      const data = c.toDataURL('image/jpeg', q);
      if (data.length * 0.75 <= maxBytes) return data;
    }
  }
  throw new Error('Story too large');
}
