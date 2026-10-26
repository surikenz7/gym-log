import { format } from 'date-fns';
import { useSettings } from '../state/settings';
import { paletteOf } from '../lib/theme';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Single-series charts: one accent hue, 2px line, ringed 8px dots, ~10% area wash, hairline solid grid.
const MUTED = '#8e8e8e';
/** Theme colours as plain hex — SVG attributes can't rely on CSS variables everywhere. */
function useChartColors() {
  const theme = useSettings((s) => s.theme);
  const mode = useSettings((s) => s.mode);
  const t = paletteOf(theme, mode);
  return { ACCENT: t.accent, SURFACE: t.card, GRID: t.line };
}

import { compact } from '../lib/units';
export { compact };

function TooltipBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg bg-card2 px-3 py-2 text-xs shadow-xl ring-1 ring-line">
      <div className="text-muted">{title}</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export function ProgressChart({
  data,
  fmt,
  height = 200,
}: {
  data: { date: number; value: number }[];
  fmt: (v: number) => string;
  height?: number;
}) {
  const { ACCENT, SURFACE, GRID } = useChartColors();
  if (data.length === 0) return <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>No data yet</div>;
  const last = data[data.length - 1];
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <div className="font-display text-2xl font-bold">{fmt(last.value)}</div>
        <div className="text-xs text-muted">{format(last.date, 'd MMM yyyy')}</div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={ACCENT} stopOpacity={0.14} />
              <stop offset="1" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(d) => format(d, 'd MMM')}
            tick={{ fill: MUTED, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={compact}
            tick={{ fill: MUTED, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            domain={['auto', 'auto']}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: MUTED, strokeWidth: 1 }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <TooltipBox title={format(payload[0].payload.date, 'EEE d MMM yyyy')} value={fmt(payload[0].payload.value)} />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="url(#wash)"
            dot={data.length <= 30 ? { r: 4, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 } : false}
            activeDot={{ r: 6, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({
  data,
  fmt,
  height = 180,
}: {
  data: { label: string; value: number; title?: string }[];
  fmt: (v: number) => string;
  height?: number;
}) {
  const { ACCENT, GRID } = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
        <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tickFormatter={compact} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: '#ffffff0d' }}
          content={({ active, payload }) =>
            active && payload?.[0] ? <TooltipBox title={payload[0].payload.title ?? payload[0].payload.label} value={fmt(payload[0].payload.value)} /> : null
          }
        />
        <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Heart rate over the workout; samples are spread evenly across its duration. */
