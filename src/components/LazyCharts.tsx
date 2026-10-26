import { lazy, Suspense, type ComponentProps } from 'react';

const Bars = lazy(() => import('./charts').then((m) => ({ default: m.BarsChart })));
const Progress = lazy(() => import('./charts').then((m) => ({ default: m.ProgressChart })));

/** Charts are loaded the first time one is shown, so the app starts faster. */
export function BarsChart(p: ComponentProps<typeof Bars>) {
  return (
    <Suspense fallback={<div style={{ height: p.height ?? 180 }} />}>
      <Bars {...p} />
    </Suspense>
  );
}

export function ProgressChart(p: ComponentProps<typeof Progress>) {
  return (
    <Suspense fallback={<div style={{ height: (p.height ?? 200) + 40 }} />}>
      <Progress {...p} />
    </Suspense>
  );
}
