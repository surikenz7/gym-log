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
  const look = (s: Settings) => applyLook(s.theme, s.style, s.mode, { textSize: s.textSize, glow: s.glow, grain: s.grain });
  look(DEFAULT_SETTINGS);
  useSettings.subscribe((s, prev) => {
    if (s.theme !== prev.theme || s.style !== prev.style || s.mode !== prev.mode || s.textSize !== prev.textSize || s.glow !== prev.glow || s.grain !== prev.grain) look(s);
  });
}

export async function loadSettings() {
  const saved = await getKv<Partial<Settings>>(KV_SETTINGS);
  if (saved) useSettings.setState({ ...DEFAULT_SETTINGS, ...saved });
}
