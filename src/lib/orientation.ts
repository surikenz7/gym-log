import { useEffect, useState } from 'react';

/**
 * Portrait lock for a web app. iOS doesn't let home-screen web apps lock rotation (only App Store
 * apps can), so when a phone is turned sideways the whole page is counter-rotated to stay upright
 * relative to the phone — it looks and behaves as if the rotation were locked.
 */
export const orient = { angle: 0 };

const isPhone = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 520;

function deviceAngle(): number {
  const legacy = (window as unknown as { orientation?: number }).orientation;
  if (typeof legacy === 'number') return legacy; // iOS: 90 = turned left, -90 = turned right
  const a = screen.orientation?.angle ?? 0;
  return a === 270 ? -90 : a;
}

function apply() {
  const landscape = innerWidth > innerHeight;
  const rotate = landscape && isPhone() ? -(deviceAngle() || 90) : 0;
  orient.angle = rotate;
  const root = document.documentElement;
  const body = document.body.style;
  if (rotate) {
    Object.assign(body, {
      width: `${innerHeight}px`,
      height: `${innerWidth}px`,
      inset: 'auto',
      top: '50%',
      left: '50%',
      transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
    });
    // the Dynamic Island is now on the side that the page treats as its top
    root.style.setProperty('--sat', rotate < 0 ? 'env(safe-area-inset-left)' : 'env(safe-area-inset-right)');
    root.style.setProperty('--sab', '16px');
    root.dataset.rotated = '1';
  } else {
    for (const k of ['width', 'height', 'inset', 'top', 'left', 'transform'] as const) body[k] = '';
    root.style.removeProperty('--sat');
    root.style.removeProperty('--sab');
    delete root.dataset.rotated;
  }
  dispatchEvent(new Event('orientlock'));
}

/** Real lock where the browser allows it (newer iOS home-screen apps, Android). Needs a tap on some systems. */
async function tryNativeLock() {
  try {
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('portrait');
    return true;
  } catch {
    return false;
  }
}

let settleTimer = 0;
/**
 * While iOS turns the screen, hide the page for a moment and bring it back already upright —
 * a short blink instead of the page spinning one way and then back the other.
 */
function onRotate() {
  const body = document.body.style;
  body.transition = 'opacity 80ms ease-out';
  body.opacity = '0';
  clearTimeout(settleTimer);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    removeEventListener('resize', finish);
    apply();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        body.transition = 'opacity 220ms ease-in';
        body.opacity = '1';
      }),
    );
  };
  addEventListener('resize', finish);
  // iOS may report the new size late (or not at all for a 180° turn)
  settleTimer = window.setTimeout(finish, 450);
}

export function startOrientationLock() {
  apply();
  void tryNativeLock();
  // some browsers only allow locking right after a tap
  document.addEventListener('pointerdown', () => void tryNativeLock(), { once: true, capture: true });
  addEventListener('resize', () => {
    if (document.body.style.opacity !== '0') apply();
  });
  addEventListener('orientationchange', onRotate);
  screen.orientation?.addEventListener?.('change', onRotate);
}

/** Converts a screen-space movement into the page's own (possibly rotated) axes. */
export function toPage(dx: number, dy: number): [number, number] {
  if (orient.angle === -90) return [-dy, dx];
  if (orient.angle === 90) return [dy, -dx];
  return [dx, dy];
}

/** True while the page is counter-rotated (screen-space drag gestures are turned off then). */
export function useRotated() {
  const [r, setR] = useState(orient.angle !== 0);
  useEffect(() => {
    const on = () => setR(orient.angle !== 0);
    addEventListener('orientlock', on);
    return () => removeEventListener('orientlock', on);
  }, []);
  return r;
}
