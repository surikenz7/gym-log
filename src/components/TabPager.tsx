import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from 'framer-motion';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { haptic } from '../lib/haptics';
import { toPage } from '../lib/orientation';
import { DOCK_TABS } from './Dock';

/** A soft, slightly floaty spring — it carries the speed of the flick into the glide. */
const SPRING = { type: 'spring', stiffness: 230, damping: 30, mass: 0.85 } as const;
const IGNORE = 'input, textarea, select, .overflow-x-auto, .recharts-wrapper, [data-no-swipe]';

/**
 * The tab pages laid out side by side on one GPU-composited strip. Dragging moves the strip 1:1
 * with the finger; letting go springs to the nearest page (or the next one if flicked). Pages stay
 * mounted, so switching never rebuilds them and each keeps its scroll position.
 */
export function TabPager({ index, pages }: { index: number; pages: ReactNode[] }) {
  const nav = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  // position measured in pages (not pixels), so rotating or resizing can never misalign the strip
  const pos = useMotionValue(index);
  const transform = useTransform(pos, (p) => `translate3d(${-p * 100}%, 0, 0)`);
  const current = useRef(index);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  // only build a page once it's the current one or a neighbour (keeps app start fast)
  const [mounted, setMounted] = useState(() => new Set([index - 1, index, index + 1]));
  const drag = useRef<{ x: number; y: number; start: number; width: number; lock?: 'x' | 'y'; samples: [number, number][] } | null>(null);

  /** velocity in pages per second */
  const panes = useRef<(HTMLDivElement | null)[]>([]);
  /** while idle only the current page is visible; during a drag / glide all are */
  const showAll = (on: boolean) => {
    panes.current.forEach((el, i) => el && (el.style.visibility = on || i === current.current ? 'visible' : 'hidden'));
  };

  const glide = (i: number, velocity = 0) => {
    anim.current?.stop();
    showAll(true);
    const a = animate(pos, i, { ...SPRING, velocity });
    anim.current = a;
    void a.then(() => anim.current === a && showAll(false));
  };

  // after a rotation / resize, snap straight to the current page
  useLayoutEffect(() => {
    const snap = () => {
      anim.current?.stop();
      pos.set(current.current);
      showAll(false);
    };
    showAll(false);
    addEventListener('orientlock', snap);
    addEventListener('resize', snap);
    return () => {
      removeEventListener('orientlock', snap);
      removeEventListener('resize', snap);
    };
  }, []);

  // dock taps / links change the route → glide there
  useEffect(() => {
    setMounted((m) => (m.has(index) && m.has(index - 1) && m.has(index + 1) ? m : new Set([...m, index - 1, index, index + 1])));
    if (index !== current.current) {
      current.current = index;
      glide(index);
    }
  }, [index]);

  const settle = (velocityPxMs: number, w: number) => {
    const moved = pos.get() - current.current; // pages dragged, + = towards the next tab
    let target = current.current;
    // a third of a page is enough, and a quick flick always moves one page in its direction
    if (moved > 0.33 || (velocityPxMs < -0.3 && moved > 0)) target++;
    else if (moved < -0.33 || (velocityPxMs > 0.3 && moved < 0)) target--;
    target = Math.max(0, Math.min(pages.length - 1, Math.max(current.current - 1, Math.min(current.current + 1, target))));
    glide(target, (-velocityPxMs * 1000) / w);
    if (target !== current.current) {
      current.current = target;
      haptic();
      nav(DOCK_TABS[target].to, { replace: true });
    }
  };

  return (
    <div
      ref={wrap}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (e.touches.length > 1 || (e.target as HTMLElement).closest(IGNORE)) {
          drag.current = null;
          return;
        }
        drag.current = { x: t.clientX, y: t.clientY, start: pos.get(), width: wrap.current?.clientWidth || 390, samples: [[0, e.timeStamp]] };
      }}
      onTouchMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const t = e.touches[0];
        // in page coordinates (the page may be counter-rotated in landscape)
        const [dx, dy] = toPage(t.clientX - d.x, t.clientY - d.y);
        if (!d.lock && Math.hypot(dx, dy) > 8) {
          d.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
          if (d.lock === 'x') {
            // grab the strip where it is, even mid-glide
            anim.current?.stop();
            showAll(true);
            d.start = pos.get() + dx / d.width;
          }
        }
        if (d.lock !== 'x') return;
        const max = pages.length - 1;
        let p = d.start - dx / d.width;
        // rubber-band past the first / last page
        if (p < 0) p *= 0.3;
        if (p > max) p = max + (p - max) * 0.3;
        pos.set(p);
        d.samples.push([dx, e.timeStamp]);
        if (d.samples.length > 5) d.samples.shift();
      }}
      onTouchEnd={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d || d.lock !== 'x') return;
        const last = e.changedTouches[0];
        const [dx] = toPage(last.clientX - d.x, last.clientY - d.y);
        d.samples.push([dx, e.timeStamp]);
        const [x0, t0] = d.samples[0];
        const v = (dx - x0) / Math.max(1, e.timeStamp - t0);
        settle(v, d.width);
      }}
      onTouchCancel={() => {
        if (drag.current?.lock === 'x') settle(0, drag.current.width);
        drag.current = null;
      }}
    >
      <motion.div className="flex h-full" style={{ transform, willChange: 'transform' }}>
        {pages.map((page, i) => (
          <div key={i} ref={(el) => void (panes.current[i] = el)} className="relative h-full w-full min-w-full shrink-0" aria-hidden={i !== index} style={{ transform: 'translateZ(0)' }}>
            {mounted.has(i) ? page : null}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
