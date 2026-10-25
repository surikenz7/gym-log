import { useSettings } from '../state/settings';

// iOS Safari has no Vibration API, but since iOS 18 toggling an <input switch> plays a system haptic.
let label: HTMLLabelElement | null = null;

function iosSwitch() {
  if (!label) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.id = 'haptic-switch';
    label = document.createElement('label');
    label.htmlFor = input.id;
    label.style.display = 'none';
    label.appendChild(input);
    document.body.appendChild(label);
  }
  label.click();
}

export function haptic(kind: 'light' | 'success' = 'light') {
  if (!useSettings.getState().haptics) return;
  try {
    if ('vibrate' in navigator) navigator.vibrate(kind === 'success' ? [15, 60, 25] : 12);
    else {
      iosSwitch();
      if (kind === 'success') setTimeout(iosSwitch, 120);
    }
  } catch {
    /* unsupported */
  }
}
