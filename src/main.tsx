import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { setLang, type LangId } from './i18n';
import { loadSettings, useSettings } from './state/settings';
import { THEMES } from './lib/theme';
import type { ThemeId } from './types';
import { loadActiveWorkout } from './state/workout';
import { useLibrary } from './lib/exercises';
import { unlockAudio } from './lib/sound';
import { startOrientationLock } from './lib/orientation';
// every subset (latin-ext for Czech/Polish…, cyrillic for Ukrainian) — each is only downloaded when a page needs it
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/exo-2/700.css';
import '@fontsource/exo-2/800-italic.css';
import '@fontsource/black-ops-one/400.css';
import '@fontsource/anton/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';

document.addEventListener('pointerdown', unlockAudio, { capture: true });
startOrientationLock();

void navigator.storage?.persist?.();
// drop the old image cache that held opaque responses (each counted as ~7 MB of quota)
void globalThis.caches?.delete('exercise-images');

/** Switching the language rebuilds the screen so every text picks up the new translation. */
function LangRoot() {
  const lang = useSettings((s) => s.lang ?? 'auto');
  const [key, setKey] = React.useState(lang);
  React.useEffect(() => {
    setLang(lang as LangId | 'auto');
    setKey(lang);
  }, [lang]);
  return <App key={key} />;
}

Promise.all([loadSettings(), loadActiveWorkout(), useLibrary.getState().reload()]).finally(() => {
  // ?theme=venom (from Settings → "Home Screen icon") preselects a colour before adding to the Home Screen
  const theme = new URLSearchParams(location.search).get('theme') as ThemeId | null;
  if (theme && theme in THEMES) {
    useSettings.getState().update({ theme });
    history.replaceState(null, '', location.pathname + location.hash);
  }
  setLang(useSettings.getState().lang as LangId | 'auto' | undefined);
  // a tapped message notification while the app is in the background: jump to that chat
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data?.type === 'open' && typeof e.data.hash === 'string') location.hash = e.data.hash;
  });
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <LangRoot />
      </HashRouter>
    </React.StrictMode>,
  );
});
