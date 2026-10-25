import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { loadSettings } from './state/settings';
import { loadActiveWorkout } from './state/workout';
import { useLibrary } from './lib/exercises';
import { unlockAudio } from './lib/sound';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/oswald/latin-700.css';
import '@fontsource/oswald/latin-ext-700.css';
import './index.css';

document.addEventListener('pointerdown', unlockAudio, { capture: true });
void navigator.storage?.persist?.();

Promise.all([loadSettings(), loadActiveWorkout(), useLibrary.getState().reload()]).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>,
  );
});
