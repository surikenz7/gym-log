import { describe, expect, it } from 'vitest';
import { LANGS, setLang, t } from '../i18n';
import { STRINGS } from '../i18n/strings';

describe('translations', () => {
  it('has every language for every text and keeps placeholders', () => {
    for (const [en, row] of Object.entries(STRINGS)) {
      expect(row, en).toHaveLength(LANGS.length - 1);
      const vars = (en.match(/\{\w+\}/g) ?? []).sort();
      for (const tr of row) {
        expect(tr, `${en} → ${tr}`).toBeTruthy();
        expect((tr.match(/\{\w+\}/g) ?? []).sort(), `${en} → ${tr}`).toEqual(vars);
      }
    }
  });

  it('translates with variables and falls back to English', () => {
    setLang('cs');
    expect(t('Workout #{n} complete', { n: 7 })).toBe('Trénink č. 7 hotový');
    expect(t('Something not translated')).toBe('Something not translated');
    setLang('en');
    expect(t('Workout #{n} complete', { n: 7 })).toBe('Workout #7 complete');
  });
});
