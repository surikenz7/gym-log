import { create } from 'zustand';

export interface DialogAction {
  label: string;
  value: string;
  style?: 'default' | 'danger' | 'cancel' | 'primary';
}

interface DialogReq {
  id: number;
  title?: string;
  message?: string;
  actions: DialogAction[];
  /** 'sheet' = iOS action sheet from bottom, 'alert' = centered */
  kind: 'sheet' | 'alert';
  resolve: (v: string | null) => void;
}

interface DialogState {
  current: DialogReq | null;
  close: (v: string | null) => void;
}

let seq = 0;
export const useDialog = create<DialogState>((set, get) => ({
  current: null,
  close: (v) => {
    get().current?.resolve(v);
    set({ current: null });
  },
}));

export function ask(opts: Omit<DialogReq, 'id' | 'resolve' | 'kind'> & { kind?: DialogReq['kind'] }): Promise<string | null> {
  return new Promise((resolve) => {
    useDialog.getState().current?.resolve(null);
    useDialog.setState({ current: { kind: 'alert', ...opts, id: ++seq, resolve } });
  });
}

export async function confirmDialog(title: string, message: string, ok = 'OK', danger = false) {
  const r = await ask({
    title,
    message,
    actions: [
      { label: 'Cancel', value: 'cancel', style: 'cancel' },
      { label: ok, value: 'ok', style: danger ? 'danger' : 'primary' },
    ],
  });
  return r === 'ok';
}

interface ToastState {
  msg: string | null;
  key: number;
  show: (msg: string) => void;
}
export const useToast = create<ToastState>((set) => ({
  msg: null,
  key: 0,
  show: (msg) => {
    const key = Date.now();
    set({ msg, key });
    setTimeout(() => set((s) => (s.key === key ? { msg: null } : s)), 2400);
  },
}));
export const toast = (m: string) => useToast.getState().show(m);
