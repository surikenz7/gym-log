import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { loadSettings, useSettings } from './state/settings';
import { THEMES } from './lib/theme';
import type { ThemeId } from './types';
import { loadActiveWorkout } from './state/workout';
import { useLibrary } from './lib/exercises';
import { unlockAudio } from './lib/sound';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/oswald/latin-700.css';
import '@fontsource/oswald/latin-ext-700.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import './index.css';

document.addEventListener('pointerdown', unlockAudio, { capture: true });

/**
 * Some iOS versions give Home Screen web apps a layout viewport that stops above the home indicator,
 * leaving an empty strip under fixed elements. Measure how much of the screen is left over and let
 * the layout (body, overlays, tab bar) extend into it via --vgap.
 */
function fitScreen() {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
  const translucent = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content') === 'black-translucent';
  const portrait = innerHeight > innerWidth;
  const typing = document.activeElement?.matches('input, textarea, select');
  if (typing) return;
  let gap = 0;
  if (standalone && translucent && portrait) {
    const full = Math.max(screen.width, screen.height);
    gap = full - innerHeight;
    if (gap < 1 || gap > 60) gap = 0;
  }
  document.documentElement.style.setProperty('--vgap', `${gap}px`);
}
fitScreen();
addEventListener('resize', fitScreen);
addEventListener('orientationchange', () => setTimeout(fitScreen, 300));
void navigator.storage?.persist?.();

Promise.all([loadSettings(), loadActiveWorkout(), useLibrary.getState().reload()]).finally(() => {
  // ?theme=venom (from Settings → "Home Screen icon") preselects a colour before adding to the Home Screen
  const theme = new URLSearchParams(location.search).get('theme') as ThemeId | null;
  if (theme && theme in THEMES) {
    useSettings.getState().update({ theme });
    history.replaceState(null, '', location.pathname + location.hash);
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  );
});
