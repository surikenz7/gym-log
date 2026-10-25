import { create } from 'zustand';
import { getKv, KV_SETTINGS, setKv } from '../db/db';
import { applyLook } from '../lib/theme';
import { DEFAULT_SETTINGS, type Settings } from '../types';

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  update: (patch) => {
    set(patch);
    const { update: _u, ...rest } = { ...get() };
    void setKv(KV_SETTINGS, rest);
  },
}));

if (typeof document !== 'undefined') {
  applyLook(DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.style, DEFAULT_SETTINGS.mode);
  useSettings.subscribe((s, prev) => {
    if (s.theme !== prev.theme || s.style !== prev.style || s.mode !== prev.mode) applyLook(s.theme, s.style, s.mode);
  });
}

export async function loadSettings() {
  const saved = await getKv<Partial<Settings>>(KV_SETTINGS);
  if (saved) useSettings.setState({ ...DEFAULT_SETTINGS, ...saved });
}
