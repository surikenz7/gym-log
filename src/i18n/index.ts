import { setDefaultOptions } from 'date-fns';
import { cs, de, enGB, es, fr, it, pl, pt, sk, uk } from 'date-fns/locale';
import { STRINGS } from './strings';

/**
 * Tiny i18n: the English text is the key. `t('Start training')` returns the translation for the
 * chosen language, or the English text when there isn't one. Changing the language remounts the
 * app (see main.tsx), so plain function calls are enough — no hooks needed.
 */

export const LANGS = [
  { id: 'en', name: 'English', flag: '🇬🇧' },
  { id: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { id: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
  { id: 'pl', name: 'Polski', flag: '🇵🇱' },
  { id: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { id: 'es', name: 'Español', flag: '🇪🇸' },
  { id: 'fr', name: 'Français', flag: '🇫🇷' },
  { id: 'it', name: 'Italiano', flag: '🇮🇹' },
  { id: 'pt', name: 'Português', flag: '🇵🇹' },
  { id: 'uk', name: 'Українська', flag: '🇺🇦' },
] as const;

export type LangId = (typeof LANGS)[number]['id'];
/** column of each language in STRINGS rows */
const COL: Record<Exclude<LangId, 'en'>, number> = { cs: 0, sk: 1, pl: 2, de: 3, es: 4, fr: 5, it: 6, pt: 7, uk: 8 };
const DATE_LOCALE = { en: enGB, cs, sk, pl, de, es, fr, it, pt, uk };

let current: LangId = 'en';

export function detectLang(): LangId {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase();
  return (LANGS.some((l) => l.id === nav) ? nav : 'en') as LangId;
}

export function setLang(id: LangId | 'auto' | undefined) {
  current = !id || id === 'auto' ? detectLang() : id;
  setDefaultOptions({ locale: DATE_LOCALE[current], weekStartsOn: 1 });
  if (typeof document !== 'undefined') document.documentElement.lang = current;
}

export const lang = () => current;

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = key;
  if (current !== 'en') {
    const row = STRINGS[key];
    const v = row?.[COL[current]];
    if (v) s = v;
  }
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

setLang('auto');
