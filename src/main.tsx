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
