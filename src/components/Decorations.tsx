import { useId, type ReactNode } from 'react';

/*
 * Avatar decorations (Discord-style). Every design is drawn in a coordinate system centred on the
 * avatar: the photo circle has radius 50, and the overlay reaches out to ±68.
 */

const spin = (dur: number, reverse = false) => (
  <animateTransform attributeName="transform" type="rotate" from={`${reverse ? 360 : 0} 0 0`} to={`${reverse ? 0 : 360} 0 0`} dur={`${dur}s`} repeatCount="indefinite" />
);
const bob = (dy = 3, dur = 2.4) => <animateTransform attributeName="transform" type="translate" values={`0 0;0 ${-dy};0 0`} dur={`${dur}s`} repeatCount="indefinite" />;
const pulse = (dur = 1.6, min = 0.45) => <animate attributeName="opacity" values={`1;${min};1`} dur={`${dur}s`} repeatCount="indefinite" />;

const polar = (deg: number, r: number) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)] as const;

function star(cx: number, cy: number, R: number, r = R * 0.45) {
  return (
    'M' +
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const k = i % 2 ? r : R;
      return `${(cx + k * Math.cos(a)).toFixed(1)} ${(cy + k * Math.sin(a)).toFixed(1)}`;
    }).join(' L') +
    'Z'
  );
}

function Leaves({ fill, from = 100, to = 250, r = 60, n = 8 }: { fill: string; from?: number; to?: number; r?: number; n?: number }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const deg = from + ((to - from) * i) / (n - 1);
    const [x, y] = polar(deg, r);
    out.push(<ellipse key={`l${i}`} cx={x} cy={y} rx={4.2} ry={9} transform={`rotate(${deg - 20} ${x} ${y})`} fill={fill} />);
    out.push(<ellipse key={`r${i}`} cx={-x} cy={y} rx={4.2} ry={9} transform={`rotate(${200 - deg} ${-x} ${y})`} fill={fill} />);
  }
  return <g>{out}</g>;
}

type Art = (g: (n: string) => string) => ReactNode;

const GOLD = (g: (n: string) => string) => (
  <linearGradient id={g('gold')} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor="#fff3b0" />
    <stop offset=".45" stopColor="#f2b705" />
    <stop offset="1" stopColor="#9a6200" />
  </linearGradient>
);

export const DECO_ART: Record<string, Art> = {
  spark: () => (
    <g>
      {spin(14)}
      {[20, 140, 260].map((d, i) => {
        const [x, y] = polar(d, 60);
        return (
          <path key={d} d={`M${x} ${y - 8} Q${x} ${y} ${x + 8} ${y} Q${x} ${y} ${x} ${y + 8} Q${x} ${y} ${x - 8} ${y} Q${x} ${y} ${x} ${y - 8} Z`} fill="#fff7c2">
            {pulse(1 + i * 0.35, 0.3)}
          </path>
        );
      })}
    </g>
  ),
  tag: () => (
    <g transform="translate(0 56) rotate(-6)">
      <rect x="-30" y="-9" width="60" height="20" rx="5" fill="#e5262d" stroke="#7a0f12" strokeWidth="1.2" />
      <rect x="-26" y="-1" width="52" height="9" rx="2" fill="#fff" />
      <text y="-2.5" textAnchor="middle" fontSize="6" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
        HELLO I LIFT
      </text>
    </g>
  ),
  bubble: () => (
    <g>
      {[
        [-58, 30, 6, 0],
        [-62, -4, 4, 0.4],
        [56, 24, 5, 0.8],
        [62, -14, 3.5, 1.2],
        [-40, 52, 3, 0.6],
        [44, 50, 4, 1],
      ].map(([x, y, r, d], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#bae6fd" fillOpacity=".25" stroke="#e0f2fe" strokeWidth="1">
          <animateTransform attributeName="transform" type="translate" values="0 6;0 -8;0 6" dur={`${2.6 + d}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  ),
  hearts: () => (
    <g>
      {spin(12)}
      {[0, 90, 180, 270].map((d) => {
        const [x, y] = polar(d, 59);
        return <path key={d} d={`M${x} ${y + 5} C${x - 9} ${y - 2} ${x - 5} ${y - 9} ${x} ${y - 4} C${x + 5} ${y - 9} ${x + 9} ${y - 2} ${x} ${y + 5} Z`} fill="#f43f5e" stroke="#fff" strokeWidth=".8" />;
      })}
    </g>
  ),
  sun: () => (
    <g transform="translate(46 -48)">
      <g>
        {spin(16)}
        {Array.from({ length: 10 }, (_, i) => {
          const [x1, y1] = polar(i * 36, 12);
          const [x2, y2] = polar(i * 36, 19);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />;
        })}
      </g>
      <circle r="10" fill="#fde047" stroke="#f59e0b" strokeWidth="1.5" />
      <rect x="-9" y="-3" width="7" height="4" rx="1.5" fill="#111" />
      <rect x="2" y="-3" width="7" height="4" rx="1.5" fill="#111" />
      <line x1="-2" y1="-1" x2="2" y2="-1" stroke="#111" strokeWidth="1" />
    </g>
  ),
  blueprint: () => (
    <g>
      <circle r="57" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="4 3" />
      <circle r="62" fill="none" stroke="#3b82f6" strokeWidth="1" opacity=".7" />
      {Array.from({ length: 24 }, (_, i) => {
        const [x1, y1] = polar(i * 15, 57);
        const [x2, y2] = polar(i * 15, i % 6 === 0 ? 67 : 62);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#93c5fd" strokeWidth={i % 6 === 0 ? 1.8 : 1} />;
      })}
    </g>
  ),
  tape: () => (
    <g>
      <path d="M-58 22 A62 62 0 0 1 -30 -52" fill="none" stroke="#facc15" strokeWidth="9" />
      <path d="M-58 22 A62 62 0 0 1 -30 -52" fill="none" stroke="#713f12" strokeWidth="9" strokeDasharray="1 5" opacity=".7" />
      <rect x="-70" y="16" width="20" height="20" rx="4" fill="#facc15" stroke="#a16207" strokeWidth="1.5" />
      <circle cx="-60" cy="26" r="4" fill="#a16207" />
    </g>
  ),
  ranked: () => (
    <g>
      {['#8b5a2b', '#c87533', '#aab3bf', '#f2b705', '#4fd1c5', '#60a5fa', '#e11d48', '#a855f7', '#fcd34d'].map((c, i) => {
        const a1 = -90 + i * 40 + 3;
        const a2 = a1 + 34;
        const [x1, y1] = polar(a1, 58);
        const [x2, y2] = polar(a2, 58);
        return <path key={c} d={`M${x1} ${y1} A58 58 0 0 1 ${x2} ${y2}`} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" />;
      })}
    </g>
  ),
  clouds: () => (
    <g fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1">
      {[
        [-36, -58, 1],
        [34, -62, 0.8],
        [60, -26, 0.65],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <g>
            {bob(2, 2 + i * 0.5)}
            <path d="M-14 6 a8 8 0 0 1 2 -14 a10 10 0 0 1 18 -2 a8 8 0 0 1 8 14 Z" />
          </g>
        </g>
      ))}
    </g>
  ),
  squad: () => (
    <g>
      {spin(18)}
      {[0, 120, 240].map((d, i) => {
        const [x, y] = polar(d, 60);
        const c = ['#22c55e', '#3b82f6', '#f59e0b'][i];
        return (
          <g key={d}>
            <circle cx={x} cy={y} r="8" fill={c} stroke="#fff" strokeWidth="1.5" />
            <circle cx={x} cy={y - 2.5} r="2.6" fill="#fff" />
            <path d={`M${x - 4.5} ${y + 5} Q${x} ${y - 1} ${x + 4.5} ${y + 5}`} fill="#fff" />
          </g>
        );
      })}
    </g>
  ),
  plane: () => (
    <g>
      {spin(7, true)}
      <circle r="60" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="1" strokeDasharray="2 5" />
      <path d="M0 -70 L10 -54 L0 -58 L-10 -54 Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" transform="rotate(90 0 -60)" />
    </g>
  ),
  iron_ring: (g) => (
    <>
      <defs>
        <linearGradient id={g('m')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1f3f5" />
          <stop offset=".5" stopColor="#7d858e" />
          <stop offset="1" stopColor="#d4d8dc" />
        </linearGradient>
      </defs>
      <circle r="56" fill="none" stroke={`url(#${g('m')})`} strokeWidth="6" />
      <circle r="60.5" fill="none" stroke="#3b4046" strokeWidth="1.5" />
      {[45, 135, 225, 315].map((d) => {
        const [x, y] = polar(d, 56);
        return <circle key={d} cx={x} cy={y} r="3" fill="#2a2e33" stroke="#c9ced3" strokeWidth="1" />;
      })}
    </>
  ),
  sweatband: () => (
    <g>
      <path d="M-50 -22 A55 55 0 0 1 50 -22" fill="none" stroke="#e5262d" strokeWidth="13" strokeLinecap="round" />
      <path d="M-50 -22 A55 55 0 0 1 50 -22" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="1 0" opacity=".9" />
      <path d="M-46 -33 A55 55 0 0 1 46 -33" fill="none" stroke="#ff8a8e" strokeWidth="1.5" opacity=".6" />
    </g>
  ),
  cap: () => (
    <g transform="rotate(-14)">
      <path d="M-38 -38 C-38 -78 38 -78 38 -38 Z" fill="#1d3b8f" stroke="#0d1f52" strokeWidth="2" />
      <path d="M-2 -76 C-6 -60 -8 -48 -8 -38" stroke="#0d1f52" strokeWidth="1.5" fill="none" />
      <path d="M30 -40 C46 -42 64 -38 66 -33 C60 -30 40 -32 28 -34 Z" fill="#163177" stroke="#0d1f52" strokeWidth="2" />
      <circle cx="-2" cy="-77" r="3.5" fill="#e5262d" />
      <rect x="-14" y="-58" width="20" height="9" rx="2" fill="#fff" opacity=".9" />
    </g>
  ),
  laurel: (g) => (
    <>
      <defs>{GOLD(g)}</defs>
      <Leaves fill={`url(#${g('gold')})`} />
    </>
  ),
  viking: () => (
    <g>
      <path d="M-44 -30 C-62 -40 -66 -62 -56 -76 C-54 -60 -46 -50 -34 -46 Z" fill="#efe3c6" stroke="#8a7a55" strokeWidth="1.5" />
      <path d="M44 -30 C62 -40 66 -62 56 -76 C54 -60 46 -50 34 -46 Z" fill="#efe3c6" stroke="#8a7a55" strokeWidth="1.5" />
      <path d="M-42 -30 C-42 -74 42 -74 42 -30 Z" fill="#8d949c" stroke="#3d4248" strokeWidth="2" />
      <rect x="-44" y="-34" width="88" height="8" rx="3" fill="#b07a2a" stroke="#5a3b0f" strokeWidth="1.5" />
      <rect x="-3" y="-70" width="6" height="36" fill="#6c737b" />
      {[-30, -15, 15, 30].map((x) => (
        <circle key={x} cx={x} cy="-30" r="1.8" fill="#f2d39a" />
      ))}
    </g>
  ),
  pillars: () => (
    <g fill="#ecebe6" stroke="#9c9a92" strokeWidth="1.2">
      {[-62, 62].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="-44" width="12" height="90" />
          <rect x={x - 9} y="-50" width="18" height="7" rx="1.5" />
          <rect x={x - 9} y="44" width="18" height="7" rx="1.5" />
          {[-3, 0, 3].map((d) => (
            <line key={d} x1={x + d} y1="-42" x2={x + d} y2="43" stroke="#c4c2ba" />
          ))}
        </g>
      ))}
      <path d="M-70 -52 L0 -72 L70 -52 Z" />
    </g>
  ),
  headphones: () => (
    <g>
      <path d="M-56 4 C-60 -70 60 -70 56 4" fill="none" stroke="#1b1b1f" strokeWidth="7" strokeLinecap="round" />
      <path d="M-56 4 C-60 -70 60 -70 56 4" fill="none" stroke="#4b4b55" strokeWidth="2" strokeLinecap="round" />
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect x={s * 58 - 9} y="-8" width="18" height="30" rx="8" fill="#1b1b1f" stroke="#e5262d" strokeWidth="2.5" />
          <rect x={s * 58 - 4} y="-2" width="8" height="18" rx="4" fill="#33333b" />
        </g>
      ))}
    </g>
  ),
  flames: (g) => (
    <>
      <defs>
        <linearGradient id={g('f')} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff2a00" />
          <stop offset=".6" stopColor="#ff9a00" />
          <stop offset="1" stopColor="#ffe066" />
        </linearGradient>
      </defs>
      {Array.from({ length: 11 }, (_, i) => {
        const deg = 20 + i * 14;
        const [x, y] = polar(deg, 52);
        const h = 14 + (i % 3) * 5;
        return (
          <path key={i} d={`M${-6} 0 C${-6} ${-h * 0.6} 0 ${-h * 0.7} 0 ${-h} C2 ${-h * 0.6} 6 ${-h * 0.5} 6 0 Z`} fill={`url(#${g('f')})`} transform={`translate(${x} ${y}) rotate(${deg + 90}) scale(1 -1)`}>
            <animateTransform attributeName="transform" type="translate" additive="sum" values={`0 0;0 ${1 + (i % 2)};0 0`} dur={`${0.5 + (i % 3) * 0.15}s`} repeatCount="indefinite" />
          </path>
        );
      })}
    </>
  ),
  year_ring: () => (
    <g>
      {spin(40)}
      {Array.from({ length: 52 }, (_, i) => {
        const [x1, y1] = polar(i * (360 / 52), 55);
        const [x2, y2] = polar(i * (360 / 52), i % 4 === 0 ? 64 : 60);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 4 === 0 ? '#f2b705' : '#9aa3ad'} strokeWidth={i % 4 === 0 ? 2.5 : 1.5} strokeLinecap="round" />;
      })}
    </g>
  ),
  stars: () => (
    <g>
      {spin(9)}
      {[0, 120, 240].map((d, i) => {
        const [x, y] = polar(d, 58);
        return <path key={d} d={star(x, y, 7 - i)} fill="#ffd84d" stroke="#b07a00" strokeWidth=".8" />;
      })}
    </g>
  ),
  lightning: () => (
    <g>
      <circle r="58" fill="none" stroke="#5ee7ff" strokeWidth="2" strokeDasharray="6 9" opacity=".8">
        {spin(3)}
      </circle>
      {[30, 150, 210, 330].map((d) => {
        const [x, y] = polar(d, 58);
        return (
          <path key={d} d="M3 -12 L-6 2 L0 2 L-3 12 L7 -3 L1 -3 Z" fill="#ffe14d" stroke="#ff9f00" strokeWidth="1" transform={`translate(${x} ${y}) scale(1.3)`}>
            {pulse(0.9 + (d % 7) * 0.05, 0.2)}
          </path>
        );
      })}
    </g>
  ),
  plates: () => (
    <g>
      {spin(24)}
      {Array.from({ length: 6 }, (_, i) => {
        const [x, y] = polar(i * 60, 58);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="9" fill="#1c1c20" stroke={i % 2 ? '#e5262d' : '#2f7cf6'} strokeWidth="2.5" />
            <circle cx={x} cy={y} r="2.5" fill="#c9ced3" />
          </g>
        );
      })}
    </g>
  ),
  gold_1m: (g) => (
    <>
      <defs>{GOLD(g)}</defs>
      <circle r="56" fill="none" stroke={`url(#${g('gold')})`} strokeWidth="7" />
      <circle r="56" fill="none" stroke="#fff" strokeWidth="1" opacity=".5" strokeDasharray="20 300">
        {spin(3)}
      </circle>
      <rect x="-20" y="48" width="40" height="17" rx="5" fill={`url(#${g('gold')})`} stroke="#7a4d00" strokeWidth="1.5" />
      <text y="61" textAnchor="middle" fontSize="12" fontWeight="800" fill="#3d2600" fontFamily="system-ui, sans-serif">
        1M
      </text>
    </>
  ),
  overhead: () => (
    <g>
      {bob(2.5, 1.8)}
      <rect x="-68" y="-63" width="136" height="5" rx="2.5" fill="#c9ced3" stroke="#6d737a" strokeWidth=".8" />
      {[-1, 1].map((s) => (
        <g key={s} fill="#1d1d22" stroke="#e5262d" strokeWidth="1.5">
          <rect x={s * 50 - 4} y="-76" width="8" height="31" rx="2" />
          <rect x={s * 58 - 3} y="-72" width="6" height="23" rx="2" />
        </g>
      ))}
    </g>
  ),
  crown: (g) => (
    <>
      <defs>{GOLD(g)}</defs>
      <g transform="translate(0 -56) rotate(-6)">
        <path d="M-28 10 L-32 -18 L-15 -4 L0 -24 L15 -4 L32 -18 L28 10 Z" fill={`url(#${g('gold')})`} stroke="#7a4d00" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="-28" y="6" width="56" height="7" rx="2" fill={`url(#${g('gold')})`} stroke="#7a4d00" strokeWidth="1.5" />
        <circle cx="0" cy="-2" r="3.5" fill="#e5262d" />
        <circle cx="-16" cy="2" r="2.5" fill="#2f7cf6" />
        <circle cx="16" cy="2" r="2.5" fill="#22c55e" />
      </g>
    </>
  ),
  diamond: () => (
    <g>
      {spin(30)}
      {Array.from({ length: 8 }, (_, i) => {
        const [x, y] = polar(i * 45, 58);
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${i * 45 + 90})`}>
            <path d="M0 -9 L7 0 L0 9 L-7 0 Z" fill="#7dd3fc" stroke="#e0f2fe" strokeWidth="1" />
            <path d="M0 -9 L0 9 M-7 0 L7 0" stroke="#fff" strokeWidth=".6" opacity=".8" />
          </g>
        );
      })}
    </g>
  ),
  belt: (g) => (
    <>
      <defs>{GOLD(g)}</defs>
      <path d="M-62 34 Q0 70 62 34 L62 48 Q0 84 -62 48 Z" fill="#161616" stroke="#000" strokeWidth="1.5" />
      <ellipse cx="0" cy="58" rx="24" ry="15" fill={`url(#${g('gold')})`} stroke="#7a4d00" strokeWidth="2" />
      <path d={star(0, 58, 8)} fill="#e5262d" />
      {[-1, 1].map((s) => (
        <ellipse key={s} cx={s * 40} cy="50" rx="8" ry="6" fill={`url(#${g('gold')})`} stroke="#7a4d00" strokeWidth="1.2" />
      ))}
    </>
  ),
  aura: (g) => (
    <>
      <defs>
        <filter id={g('b')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <circle r="58" fill="none" stroke="#a855f7" strokeWidth="9" filter={`url(#${g('b')})`}>
        {pulse(2, 0.4)}
      </circle>
      <g>
        {spin(6)}
        {[0, 90, 180, 270].map((d) => {
          const [x, y] = polar(d, 58);
          return <path key={d} d={`M${x} ${y} q 8 -10 0 -20 q -8 -10 0 -20`} transform={`rotate(${d + 90} ${x} ${y})`} fill="none" stroke="#e9d5ff" strokeWidth="2" strokeLinecap="round" opacity=".85" />;
        })}
      </g>
      <circle r="54" fill="none" stroke="#d8b4fe" strokeWidth="1.5" />
    </>
  ),
  olympus: (g) => (
    <>
      <defs>{GOLD(g)}</defs>
      {[-1, 1].map((s) => (
        <path
          key={s}
          transform={`scale(${s} 1)`}
          d="M52 -10 C70 -26 82 -24 88 -34 C84 -16 78 -8 70 -4 C80 -4 84 -10 88 -12 C82 2 72 6 60 6 C70 10 76 8 82 8 C74 18 62 18 52 12 Z"
          fill="#fffaf0"
          stroke="#c9a14a"
          strokeWidth="1.2"
        />
      ))}
      <Leaves fill={`url(#${g('gold')})`} from={95} to={235} n={7} />
      <path d={star(0, -66, 9)} fill={`url(#${g('gold')})`} stroke="#7a4d00" strokeWidth="1">
        {pulse(1.8, 0.55)}
      </path>
    </>
  ),
  sunburst: (g) => (
    <>
      <defs>{GOLD(g)}</defs>
      <g opacity=".85">
        {spin(30)}
        {Array.from({ length: 24 }, (_, i) => {
          const a1 = polar(i * 15 - 3, 54);
          const a2 = polar(i * 15 + 3, 54);
          const tip = polar(i * 15, i % 2 ? 62 : 68);
          return <path key={i} d={`M${a1[0]} ${a1[1]} L${tip[0]} ${tip[1]} L${a2[0]} ${a2[1]} Z`} fill={`url(#${g('gold')})`} />;
        })}
      </g>
      <circle r="53" fill="none" stroke={`url(#${g('gold')})`} strokeWidth="3" />
    </>
  ),
  halo: () => (
    <g>
      {bob(3, 2.6)}
      <ellipse cx="0" cy="-62" rx="30" ry="7" fill="none" stroke="#fff6c4" strokeWidth="5" opacity=".5" />
      <ellipse cx="0" cy="-62" rx="30" ry="7" fill="none" stroke="#ffd84d" strokeWidth="2.5" />
    </g>
  ),
  horns: () => (
    <g fill="#d61f26" stroke="#5c0a0d" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M-30 -40 C-40 -52 -42 -66 -36 -76 C-32 -64 -24 -56 -18 -48 Z" />
      <path d="M30 -40 C40 -52 42 -66 36 -76 C32 -64 24 -56 18 -48 Z" />
    </g>
  ),
  moon: () => (
    <g>
      <path d="M44 -66 A20 20 0 1 0 66 -38 A15 15 0 1 1 44 -66 Z" fill="#fde68a" stroke="#b98a12" strokeWidth="1.2" />
      {[
        [-50, -52, 3],
        [-60, -20, 2],
        [30, -62, 2],
        [58, 40, 2.5],
      ].map(([x, y, r], i) => (
        <path key={i} d={star(x, y, r * 1.8)} fill="#fff">
          {pulse(1.2 + i * 0.3, 0.2)}
        </path>
      ))}
    </g>
  ),
  santa: () => (
    <g transform="rotate(14)">
      <path d="M-34 -42 C-28 -76 10 -88 40 -74 C30 -70 20 -62 14 -50 Z" fill="#d61f26" stroke="#7a0f12" strokeWidth="1.5" />
      <rect x="-40" y="-48" width="66" height="12" rx="6" fill="#fff" stroke="#d9d9d9" strokeWidth="1" />
      <circle cx="42" cy="-74" r="7" fill="#fff" stroke="#d9d9d9" strokeWidth="1" />
    </g>
  ),
  party: () => (
    <g>
      <g transform="translate(-6 -50) rotate(-18)">
        <path d="M-15 0 L0 -40 L15 0 Z" fill="#a855f7" stroke="#5b21b6" strokeWidth="1.5" />
        <path d="M-10 -12 L10 -12 M-6 -24 L6 -24" stroke="#ffd84d" strokeWidth="3" />
        <circle cx="0" cy="-42" r="5" fill="#ffd84d" />
      </g>
      {[
        [-56, -30, '#22c55e'],
        [56, -36, '#e5262d'],
        [-60, 24, '#2f7cf6'],
        [60, 20, '#ffd84d'],
        [40, -58, '#ec4899'],
      ].map(([x, y, c], i) => (
        <rect key={i} x={x as number} y={y as number} width="5" height="3" rx="1" fill={c as string} transform={`rotate(${i * 40} ${x} ${y})`}>
          {pulse(1 + i * 0.2, 0.3)}
        </rect>
      ))}
    </g>
  ),
  pumpkin: () => (
    <g>
      <g transform="translate(46 -48)">
        <ellipse cx="0" cy="0" rx="16" ry="13" fill="#f97316" stroke="#9a3412" strokeWidth="1.5" />
        <path d="M-6 -12 C-8 0 -8 8 -6 12 M6 -12 C8 0 8 8 6 12" stroke="#9a3412" strokeWidth="1.2" fill="none" />
        <path d="M0 -13 C0 -18 3 -20 5 -21" stroke="#3f6212" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M-8 -2 L-4 -5 L-2 -1 Z M8 -2 L4 -5 L2 -1 Z M-7 4 L-3 6 L0 4 L3 6 L7 4" fill="#2a1200" stroke="#2a1200" strokeWidth=".8" />
      </g>
      {[
        [-52, -44],
        [-62, -14],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} q 5 -6 9 0 q 2 -3 4 0 q 4 -6 9 0 q -6 2 -11 6 q -5 -4 -11 -6 Z`} fill="#4c2d73" stroke="#a78bfa" strokeWidth=".8">
          {bob(2, 1 + i * 0.3)}
        </path>
      ))}
    </g>
  ),
  clover: () => (
    <g>
      {[200, 330, 80].map((d, i) => {
        const [x, y] = polar(d, 58);
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${d})`}>
            {[0, 90, 180, 270].map((r) => (
              <circle key={r} cx={Math.cos((r * Math.PI) / 180) * 4.5} cy={Math.sin((r * Math.PI) / 180) * 4.5} r="4.6" fill="#22c55e" stroke="#14532d" strokeWidth=".8" />
            ))}
            <path d="M0 0 Q3 8 1 13" stroke="#14532d" strokeWidth="1.5" fill="none" />
          </g>
        );
      })}
    </g>
  ),
  glitch: () => (
    <g>
      <circle r="56" fill="none" stroke="#ff0055" strokeWidth="3" opacity=".9">
        <animateTransform attributeName="transform" type="translate" values="0 0;-2 1;1 -1;0 0;2 0;0 0" dur=".6s" repeatCount="indefinite" />
      </circle>
      <circle r="56" fill="none" stroke="#00e5ff" strokeWidth="3" opacity=".9">
        <animateTransform attributeName="transform" type="translate" values="0 0;2 -1;-1 1;0 0;-2 0;0 0" dur=".6s" repeatCount="indefinite" />
      </circle>
      {[
        [-62, -20, 18],
        [44, 30, 22],
        [-30, 56, 14],
      ].map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height="3" fill={i % 2 ? '#00e5ff' : '#ff0055'}>
          {pulse(0.4 + i * 0.13, 0)}
        </rect>
      ))}
    </g>
  ),
  chain: (g) => (
    <>
      <defs>{GOLD(g)}</defs>
      {Array.from({ length: 15 }, (_, i) => {
        const deg = 30 + i * 8.6;
        const [x, y] = polar(deg, 54);
        return <ellipse key={i} cx={x} cy={y} rx="4.2" ry="2.6" transform={`rotate(${deg + 90 + (i % 2) * 70} ${x} ${y})`} fill="none" stroke={`url(#${g('gold')})`} strokeWidth="2.2" />;
      })}
      <circle cx="0" cy="64" r="8" fill={`url(#${g('gold')})`} stroke="#7a4d00" strokeWidth="1.2" />
      <circle cx="0" cy="64" r="2.5" fill="#7a4d00" />
    </>
  ),
  neon: (g) => (
    <>
      <defs>
        <filter id={g('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle r="56" fill="none" stroke="#ff2e9a" strokeWidth="3" filter={`url(#${g('glow')})`}>
        {pulse(2.2, 0.55)}
      </circle>
      <circle r="61" fill="none" stroke="#22e3ff" strokeWidth="2" strokeDasharray="40 14" filter={`url(#${g('glow')})`}>
        {spin(8, true)}
      </circle>
    </>
  ),
  thorns: () => (
    <g>
      <circle r="56" fill="none" stroke="#7a5a3f" strokeWidth="3.5" />
      <circle r="56" fill="none" stroke="#b08a63" strokeWidth="1" strokeDasharray="3 5" />
      {Array.from({ length: 24 }, (_, i) => {
        const [x, y] = polar(i * 15, 56);
        const [tx, ty] = polar(i * 15 + 6, 64);
        return <path key={i} d={`M${x} ${y} L${tx} ${ty}`} stroke="#8a6a4c" strokeWidth="2.2" strokeLinecap="round" />;
      })}
      <g transform="translate(-40 42)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="0" cy="-5" rx="5" ry="7" fill="#be123c" transform={`rotate(${r})`} />
        ))}
        <circle r="4" fill="#881337" />
      </g>
    </g>
  ),
};

/** Draws a decoration around an avatar of `size` px. */
export function DecorationArt({ id, size }: { id: string | null | undefined; size: number }) {
  const uid = useId().replace(/:/g, '');
  const art = id ? DECO_ART[id] : null;
  if (!art) return null;
  const box = size * 1.36;
  return (
    <svg
      className="pointer-events-none absolute"
      width={box}
      height={box}
      viewBox="-68 -68 136 136"
      style={{ left: (size - box) / 2, top: (size - box) / 2, overflow: 'visible' }}
      aria-hidden
    >
      {art((n) => `${n}${uid}`)}
    </svg>
  );
}
