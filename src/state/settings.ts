import { create } from 'zustand';
import { getKv, KV_SETTINGS, setKv } from '../db/db';
import { applyTheme } from '../lib/theme';
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
  applyTheme(DEFAULT_SETTINGS.theme);
  useSettings.subscribe((s, prev) => s.theme !== prev.theme && applyTheme(s.theme));
}

export async function loadSettings() {
  const saved = await getKv<Partial<Settings>>(KV_SETTINGS);
  if (saved) useSettings.setState({ ...DEFAULT_SETTINGS, ...saved });
}
