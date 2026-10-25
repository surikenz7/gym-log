import { format } from 'date-fns';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Single-series charts: one accent hue, 2px line, ringed 8px dots, ~10% area wash, hairline solid grid.
const ACCENT = '#2f7cf6';
const SURFACE = '#16171a';
const GRID = '#2a2c31';
const MUTED = '#8b8f98';

export function compact(n: number) {
  if (Math.abs(n) >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return `${+n.toFixed(1)}`;
}

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
  if (data.length === 0) return <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>No data yet</div>;
  const last = data[data.length - 1];
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <div className="text-2xl font-semibold">{fmt(last.value)}</div>
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
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap={2}>
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

const HEART = '#f43f5e';

/** Heart rate over the workout; samples are spread evenly across its duration. */
export function HeartRateChart({ hr, minutes, height = 140 }: { hr: number[]; minutes: number; height?: number }) {
  const data = hr.map((v, i) => ({ t: hr.length > 1 ? (i / (hr.length - 1)) * minutes : 0, v }));
  const lo = Math.floor((Math.min(...hr) - 5) / 10) * 10;
  const hi = Math.ceil((Math.max(...hr) + 5) / 10) * 10;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="hrwash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={HEART} stopOpacity={0.16} />
            <stop offset="1" stopColor={HEART} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
        <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} tickFormatter={(m) => `${Math.round(m)} min`} minTickGap={24} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[lo, hi]} tickCount={4} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: MUTED, strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.[0] ? <TooltipBox title={`${Math.round(payload[0].payload.t)} min`} value={`${payload[0].payload.v} bpm`} /> : null
          }
        />
        <Area type="monotone" dataKey="v" stroke={HEART} strokeWidth={2} fill="url(#hrwash)" dot={false} activeDot={{ r: 5, fill: HEART, stroke: SURFACE, strokeWidth: 2 }} animationDuration={700} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
