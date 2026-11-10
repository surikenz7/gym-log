import { Check, Copy, Palette, Pipette, RotateCcw, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Header, Page, Sheet } from '../components/ui';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { CORNERS, customPalette, DONE_COLORS, FONTS, MODES, paletteOf, PRESETS, STYLES, THEMES, themeLink, type Preset } from '../lib/theme';
import { toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import type { CornerId, DoneId, FontId, HomeSection, ModeId, Settings, StyleId, ThemeId } from '../types';
import { Row, Section, Segmented, Toggle } from './Settings';

const STYLE_PREVIEW: Record<StyleId, { font: React.CSSProperties; shape: React.CSSProperties }> = {
  raw: {
    font: {
      fontFamily: 'Oswald, sans-serif',
      fontWeight: 700,
      textTransform: 'uppercase',
    },
    shape: {
      clipPath: 'polygon(0 0, 70% 0, 100% 30%, 100% 100%, 30% 100%, 0 70%)',
    },
  },
  elegant: {
    font: { fontFamily: "'Playfair Display', serif", fontWeight: 600 },
    shape: { borderRadius: 6, opacity: 0.85 },
  },
  minimal: {
    font: {
      fontFamily: '-apple-system, system-ui, sans-serif',
      fontWeight: 600,
    },
    shape: { borderRadius: 4 },
  },
  clean: {
    font: {
      fontFamily: '-apple-system, system-ui, sans-serif',
      fontWeight: 600,
    },
    shape: { borderRadius: 7 },
  },
  playful: {
    font: { fontFamily: 'Fredoka, ui-rounded, sans-serif', fontWeight: 600 },
    shape: { borderRadius: 999 },
  },
  cyber: {
    font: {
      fontFamily: "'Exo 2', sans-serif",
      fontWeight: 800,
      fontStyle: 'italic',
      textTransform: 'uppercase',
    },
    shape: { borderRadius: 5, boxShadow: '0 0 12px rgb(var(--accent))' },
  },
  frost: {
    font: {
      fontFamily: '-apple-system, system-ui, sans-serif',
      fontWeight: 700,
    },
    shape: {
      borderRadius: 9,
      opacity: 0.55,
      boxShadow: 'inset 0 1px 1px rgb(255 255 255 / .6)',
    },
  },
  tactical: {
    font: {
      fontFamily: "'Black Ops One', Impact, sans-serif",
      textTransform: 'uppercase',
    },
    shape: {
      clipPath: 'polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)',
    },
  },
  brutal: {
    font: {
      fontFamily: 'Anton, Impact, sans-serif',
      textTransform: 'uppercase',
    },
    shape: { borderRadius: 3, boxShadow: '3px 3px 0 rgb(var(--fg))' },
  },
  terminal: {
    font: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 },
    shape: {
      borderRadius: 3,
      background: 'transparent',
      boxShadow: 'inset 0 0 0 2px rgb(var(--accent))',
    },
  },
};

/** Extras a preset resets, so it really looks like its picture. */
const PRESET_RESET: Partial<Settings> = {
  font: 'style',
  corners: 'style',
  accentCustom: null,
  doneColor: 'theme',
};

const SWATCHES = ['#e5262d', '#ff6a00', '#f2b705', '#a3e635', '#10b981', '#06b6d4', '#2d7ff9', '#6366f1', '#a855f7', '#ff2e7e', '#f43f5e', '#f4f4f5'];

function presetOn(s: Settings, p: Preset) {
  return s.theme === p.theme && s.style === p.style && s.mode === p.mode && !s.accentCustom && (s.font ?? 'style') === 'style' && (s.corners ?? 'style') === 'style';
}

/** A tiny phone screen in the preset's colours. */
function PresetCard({ p, on, onClick }: { p: Preset; on: boolean; onClick: () => void }) {
  const pal = customPalette(paletteOf(p.theme, p.mode), { done: p.doneColor });
  const st = STYLE_PREVIEW[p.style];
  const r = p.style === 'raw' || p.style === 'tactical' ? 2 : p.style === 'brutal' || p.style === 'terminal' ? 4 : 9;
  return (
    <button onClick={onClick} className="press w-full text-left">
      <div
        className="relative overflow-hidden rounded-2xl p-2.5"
        style={{
          background: pal.bg,
          boxShadow: on ? `inset 0 0 0 2px ${pal.accent}` : `inset 0 0 0 1px ${pal.line}`,
        }}
      >
        {p.glow && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-12"
            style={{
              background: `radial-gradient(100% 100% at 20% 0%, ${pal.accent}55, transparent 70%)`,
            }}
          />
        )}
        <div className="relative text-[15px] leading-none" style={{ ...st.font, color: pal.fg }}>
          {t('Workout')}
        </div>
        <div className="relative mt-2 space-y-1">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-1.5 py-1"
              style={{
                background: i ? pal.doneSoft : pal.card,
                borderRadius: r,
              }}
            >
              <span className="h-1.5 flex-1 rounded-full" style={{ background: pal.fg, opacity: 0.55 }} />
              <span
                className="flex h-3 w-3 items-center justify-center"
                style={{
                  background: i ? pal.done : pal.card2,
                  borderRadius: r / 2,
                }}
              >
                {i === 1 && <Check size={8} strokeWidth={4} color="#fff" />}
              </span>
            </div>
          ))}
        </div>
        <div
          className="relative mt-2 py-1 text-center text-[10px] font-semibold"
          style={{
            background: pal.accent,
            color: pal.ink,
            borderRadius: r,
            ...st.font,
          }}
        >
          {t('Start')}
        </div>
        {on && (
          <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full" style={{ background: pal.accent, color: pal.ink }}>
            <Check size={10} strokeWidth={4} />
          </span>
        )}
      </div>
      <div className="mt-1.5 px-0.5 text-sm font-semibold leading-tight">{t(p.name)}</div>
      <div className="px-0.5 text-[11px] leading-tight text-muted">{t(p.desc)}</div>
    </button>
  );
}

const HOME_SECTIONS: [HomeSection, string][] = [
  ['stories', 'Stories'],
  ['week', 'This week'],
  ['cards', 'Rank & level'],
  ['feed', 'Recent sessions'],
];

export function Appearance() {
  const s = useSettings();
  const [iconHelp, setIconHelp] = useState(false);
  const [picker, setPicker] = useState(false);
  const hidden = s.hideHome ?? [];
  const apply = (p: Preset) => {
    haptic('light');
    s.update({
      ...PRESET_RESET,
      theme: p.theme,
      style: p.style,
      mode: p.mode,
      glow: p.glow,
      grain: p.grain,
      tabLabels: p.tabLabels,
      doneColor: p.doneColor ?? 'theme',
    });
  };
  const custom = s.accentCustom ?? null;

  return (
    <Page pushed>
      <Header back title={t('Appearance')} />
      <div className="space-y-6 px-4 pb-12 pt-2">
        <div>
          <div className="label px-4 pb-2">{t('Looks')}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {PRESETS.map((p) => (
              <PresetCard key={p.id} p={p} on={presetOn(s, p)} onClick={() => apply(p)} />
            ))}
          </div>
          <div className="px-4 pt-2 text-xs text-muted">{t('A look only changes colours and style. Every feature stays.')}</div>
        </div>

        <Section title={t('Style')}>
          <div className="grid grid-cols-2 gap-2 p-3">
            {(Object.keys(STYLES) as StyleId[]).map((id) => {
              const on = s.style === id;
              return (
                <button
                  key={id}
                  onClick={() => s.update({ style: id })}
                  className="press relative overflow-hidden rounded-xl bg-card2 p-3 text-left"
                  style={{
                    boxShadow: on ? 'inset 0 0 0 2px rgb(var(--accent))' : undefined,
                  }}
                >
                  <div className="flex items-end justify-between">
                    <span className="text-3xl leading-none" style={STYLE_PREVIEW[id].font}>
                      Aa
                    </span>
                    <span className="h-6 w-6 bg-accent" style={STYLE_PREVIEW[id].shape} />
                  </div>
                  <div className="mt-2 text-sm font-semibold" style={STYLE_PREVIEW[id].font}>
                    {t(STYLES[id].name)}
                  </div>
                  <div className="text-[11px] leading-tight text-muted">{t(STYLES[id].desc)}</div>
                  {on && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                      <Check size={12} strokeWidth={4} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t('Mode')}>
          <div className="grid grid-cols-4 gap-2 p-3">
            {(Object.keys(MODES) as ModeId[]).map((id) => {
              const p = paletteOf(s.theme, id);
              const on = s.mode === id;
              return (
                <button key={id} onClick={() => s.update({ mode: id })} className="press flex flex-col items-center gap-1.5">
                  <span
                    className="flex h-14 w-full flex-col justify-end gap-1 rounded-xl p-1.5"
                    style={{
                      background: p.bg,
                      boxShadow: on ? `inset 0 0 0 2px ${p.accent}` : `inset 0 0 0 1px ${p.line}`,
                    }}
                  >
                    <span className="h-2 w-2/3 rounded-full" style={{ background: p.fg, opacity: 0.85 }} />
                    <span className="h-4 w-full rounded-md" style={{ background: p.card }} />
                  </span>
                  <span className={`text-xs font-semibold ${on ? 'text-white' : 'text-muted'}`}>{t(MODES[id].name)}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t('Colour')} foot={t('Accent, highlights, background tint and the app icon.')}>
          <div className="grid grid-cols-4 gap-2 p-3">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const p = paletteOf(id, s.mode);
              const on = s.theme === id && !custom;
              return (
                <button key={id} onClick={() => s.update({ theme: id, accentCustom: null })} className="press flex flex-col items-center gap-1.5">
                  <span
                    className="relative flex h-16 w-full flex-col justify-end overflow-hidden rounded-xl p-1.5"
                    style={{
                      background: p.bg,
                      boxShadow: on ? `inset 0 0 0 2px ${p.accent}` : `inset 0 0 0 1px ${p.line}`,
                    }}
                  >
                    <span
                      className="absolute inset-x-0 top-0 h-6"
                      style={{
                        background: `linear-gradient(120deg, ${p.accent}, ${p.accent2})`,
                      }}
                    />
                    <span className="relative flex gap-1">
                      <span className="h-3 flex-1 rounded-sm" style={{ background: p.card }} />
                      <span className="h-3 w-3 rounded-sm" style={{ background: p.done }} />
                    </span>
                    {on && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full" style={{ background: p.ink, color: p.accent }}>
                        <Check size={11} strokeWidth={4} />
                      </span>
                    )}
                  </span>
                  <span className={`text-xs font-semibold ${on ? 'text-white' : 'text-muted'}`}>{THEMES[id].name}</span>
                </button>
              );
            })}
          </div>
          <Row label={t('Your own accent colour')} icon={<Pipette size={20} />} onClick={() => setPicker(true)}>
            {custom ? (
              <span
                className="h-7 w-7 rounded-full"
                style={{
                  background: custom,
                  boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / .25)',
                }}
              />
            ) : (
              <span className="text-sm text-muted">{t('Off')}</span>
            )}
          </Row>
          <Row label={t('App icon')} icon={<Smartphone size={20} />} onClick={() => setIconHelp(true)}>
            <img src={`${import.meta.env.BASE_URL}icons/${s.theme}-180.png`} alt="" className="h-9 w-9 rounded-[9px]" />
          </Row>
        </Section>

        <Section title={t('Fine-tune')}>
          <Row label={t('Font')}>
            <select
              value={s.font ?? 'style'}
              onChange={(e) => s.update({ font: e.target.value as FontId })}
              className="appearance-none rounded-lg bg-card2 px-3 py-1.5 text-sm font-semibold outline-none"
            >
              {(Object.keys(FONTS) as FontId[]).map((f) => (
                <option key={f} value={f}>
                  {t(FONTS[f].name)}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t('Corners')}>
            <select
              value={s.corners ?? 'style'}
              onChange={(e) => s.update({ corners: e.target.value as CornerId })}
              className="appearance-none rounded-lg bg-card2 px-3 py-1.5 text-sm font-semibold outline-none"
            >
              {(Object.keys(CORNERS) as CornerId[]).map((c) => (
                <option key={c} value={c}>
                  {t(CORNERS[c])}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t('Completed sets')}>
            <div className="flex gap-1.5">
              {(Object.keys(DONE_COLORS) as DoneId[]).map((d) => {
                const hex =
                  d === 'theme'
                    ? paletteOf(s.theme, s.mode).done
                    : d === 'accent'
                      ? customPalette(paletteOf(s.theme, s.mode), {
                          accent: custom,
                        }).accent
                      : DONE_COLORS[d].hex!;
                const on = (s.doneColor ?? 'theme') === d;
                return (
                  <button
                    key={d}
                    onClick={() => s.update({ doneColor: d })}
                    aria-label={t(DONE_COLORS[d].name)}
                    className="press flex h-8 w-8 items-center justify-center rounded-full"
                    style={{
                      background: hex,
                      boxShadow: on ? '0 0 0 2px rgb(var(--bg)), 0 0 0 4px rgb(var(--fg))' : undefined,
                    }}
                  >
                    {d === 'theme' && <Palette size={14} color="#fff" />}
                  </button>
                );
              })}
            </div>
          </Row>
          <Row label={t('Text size')}>
            <Segmented value={s.textSize ?? 'md'} options={['sm', 'md', 'lg']} labels={{ sm: 'S', md: 'M', lg: 'L' }} onChange={(textSize) => s.update({ textSize })} />
          </Row>
          <Row label={t('Background glow')}>
            <Toggle on={s.glow !== false} onChange={(glow) => s.update({ glow })} />
          </Row>
          <Row label={t('Film grain')}>
            <Segmented value={s.grain ?? 'auto'} options={['auto', 'on', 'off']} labels={{ auto: 'Auto', on: 'On', off: 'Off' }} onChange={(grain) => s.update({ grain })} />
          </Row>
          <Row label={t('Tab bar labels')}>
            <Toggle on={s.tabLabels !== false} onChange={(tabLabels) => s.update({ tabLabels })} />
          </Row>
          <Row label={t('Reduce motion')}>
            <Toggle on={!!s.reduceMotion} onChange={(reduceMotion) => s.update({ reduceMotion })} />
          </Row>
        </Section>

        <Section title={t('Home screen')} foot={s.headline === 'motto' ? t('Your motto shows in big letters at the top of Home.') : undefined}>
          <Row label={t('Headline')}>
            <Segmented
              value={s.headline ?? 'greeting'}
              options={['greeting', 'motto', 'date']}
              labels={{ greeting: 'Hello', motto: 'Motto', date: 'Date' }}
              onChange={(headline) => s.update({ headline })}
            />
          </Row>
          {s.headline === 'motto' && (
            <Row label={t('Motto')}>
              <input
                value={s.motto ?? ''}
                onChange={(e) => s.update({ motto: e.target.value.slice(0, 40) })}
                placeholder={t('No days off')}
                className="w-44 bg-transparent text-right outline-none placeholder:text-muted"
              />
            </Row>
          )}
          {HOME_SECTIONS.map(([id, label]) => (
            <Row key={id} label={t(label)}>
              <Toggle
                on={!hidden.includes(id)}
                onChange={(v) =>
                  s.update({
                    hideHome: v ? hidden.filter((x) => x !== id) : [...hidden, id],
                  })
                }
              />
            </Row>
          ))}
        </Section>

        <button onClick={() => apply(PRESETS[0])} className="press mx-auto flex items-center gap-2 py-2 text-sm font-semibold text-muted">
          <RotateCcw size={15} /> {t('Reset to the original look')}
        </button>
      </div>

      <Sheet open={picker} onClose={() => setPicker(false)} title={t('Your own accent colour')}>
        <div className="px-5 pb-4 pt-2">
          <div className="grid grid-cols-6 gap-3">
            {SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => s.update({ accentCustom: c })}
                className="press aspect-square rounded-full"
                style={{
                  background: c,
                  boxShadow: custom === c ? '0 0 0 2px rgb(var(--bg)), 0 0 0 4px rgb(var(--fg))' : 'inset 0 0 0 1px rgb(255 255 255 / .2)',
                }}
                aria-label={c}
              />
            ))}
          </div>
          <label className="press mt-4 flex items-center gap-3 rounded-xl bg-card2 px-4 py-3">
            <Pipette size={20} className="text-accent" />
            <span className="flex-1 font-semibold">{t('Pick any colour')}</span>
            <input
              type="color"
              value={custom ?? paletteOf(s.theme, s.mode).accent}
              onChange={(e) => s.update({ accentCustom: e.target.value })}
              className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent"
            />
          </label>
          {custom && (
            <button onClick={() => (s.update({ accentCustom: null }), setPicker(false))} className="press mt-3 w-full py-2 text-sm font-semibold text-muted">
              {t('Use the theme colour')}
            </button>
          )}
        </div>
      </Sheet>

      <Sheet open={iconHelp} onClose={() => setIconHelp(false)} title={t('App icon colour')}>
        <div className="space-y-3 px-5 pb-2 pt-2 text-sm text-white/85">
          <p>
            <b>{t('iOS doesn’t let a Home Screen web app change its own icon.')}</b>{' '}
            {t(
              'The icon is copied once, when the app is added, and only App Store apps can swap it later. So the icon on your Home Screen stays as it is until you add the app again — everything inside the app changes instantly.',
            )}
          </p>
          <p className="text-muted">{t('If you want the matching icon anyway:')}</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <b>{t('Back up first:')}</b> {t('Settings → Data → Export backup → Save to Files. Removing the app can erase its data.')}
            </li>
            <li>
              <b>{t('Copy link')}</b> → Safari
            </li>
            <li>
              {t('Share →')} <b>{t('Add to Home Screen')}</b>, {t('then delete the old icon.')}
            </li>
            <li>{t('Open the new icon → Settings → Restore from backup.')}</li>
          </ol>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(themeLink(s.theme)).then(
                () => toast(t('Link copied — paste it in Safari')),
                () => toast(themeLink(s.theme)),
              );
            }}
            className="press cut-sm grad flex w-full items-center justify-center gap-2 py-3 font-display text-lg font-bold uppercase tracking-wider"
          >
            <Copy size={18} /> {t('Copy link')}
          </button>
        </div>
      </Sheet>
    </Page>
  );
}
