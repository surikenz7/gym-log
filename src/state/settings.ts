import { create } from 'zustand';
import { getKv, KV_SETTINGS, setKv } from '../db/db';
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

export async function loadSettings() {
  const saved = await getKv<Partial<Settings>>(KV_SETTINGS);
  if (saved) useSettings.setState({ ...DEFAULT_SETTINGS, ...saved });
}
