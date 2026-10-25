let lock: WakeLockSentinel | null = null;
let wanted = false;

async function acquire() {
  try {
    if (wanted && 'wakeLock' in navigator && document.visibilityState === 'visible' && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    }
  } catch {
    /* unsupported or denied */
  }
}

document.addEventListener('visibilitychange', () => void acquire());

export function setKeepAwake(on: boolean) {
  wanted = on;
  if (on) void acquire();
  else {
    void lock?.release();
    lock = null;
  }
}
