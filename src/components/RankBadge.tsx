import { motion } from 'framer-motion';
import { useId } from 'react';
import { tierIndex, TIERS } from '../lib/ranks';

const SHIELD = 'M60 14 L94 26 V58 C94 80 79 95 60 105 C41 95 26 80 26 58 V26 Z';
const INNER = 'M60 23 L86 32.5 V58 C86 74 75 86 60 94 C45 86 34 74 34 58 V32.5 Z';

function star(cx: number, cy: number, R: number, r: number) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    return `${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join(' L')} Z`;
}

const chevron = (y: number) => `M43 ${y + 9} L60 ${y} L77 ${y + 9} V${y + 16} L60 ${y + 7} L43 ${y + 16} Z`;

/** Tier emblem drawn inside the shield. */
function glyph(i: number): string[] {
  switch (i) {
    case 0:
      return [chevron(55)];
    case 1:
      return [chevron(47), chevron(61)];
    case 2:
      return [chevron(41), chevron(54), chevron(67)];
    case 3:
      return [star(60, 60, 19, 8)];
    case 4:
      return [star(60, 58, 15, 6.5), star(46, 74, 6, 2.6), star(74, 74, 6, 2.6)];
    case 5:
      return ['M45 52 L52 42 H68 L75 52 L60 77 Z', 'M45 52 H75 M52 42 L57 52 L60 77 L63 52 L68 42'];
    case 6:
      return ['M43 73 L40 47 L51 57 L60 40 L69 57 L80 47 L77 73 Z', 'M43 76 H77 V81 H43 Z'];
    case 7:
      return ['M66 36 L45 63 H58 L53 84 L76 55 H63 L69 36 Z'];
    default:
      return [star(60, 59, 20, 8.5)];
  }
}

function Laurel({ fill }: { fill: string }) {
  const leaves = [];
  // leaves follow an arc from the bottom up both sides; each leaf is rotated along the tangent
  for (let k = 0; k < 7; k++) {
    const deg = 105 + k * 19;
    const a = (deg * Math.PI) / 180;
    const x = 60 + 54 * Math.cos(a);
    const y = 64 + 50 * Math.sin(a);
    leaves.push(<ellipse key={`l${k}`} cx={x} cy={y} rx={4} ry={9.5} transform={`rotate(${deg - 20} ${x} ${y})`} fill={fill} />);
    leaves.push(<ellipse key={`r${k}`} cx={120 - x} cy={y} rx={4} ry={9.5} transform={`rotate(${200 - deg} ${120 - x} ${y})`} fill={fill} />);
  }
  return <g opacity={0.95}>{leaves}</g>;
}

/**
 * Original rank emblem — gets more elaborate with each tier: chevrons → stars → gem → crown → bolt → laurel.
 * `score` null = unranked.
 */
export function RankBadge({ score, size = 48, shine = true }: { score: number | null; size?: number; shine?: boolean }) {
  const uid = useId().replace(/:/g, '');
  if (score == null) {
    return (
      <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0">
        <path d={SHIELD} fill="#1c1c1c" stroke="#3a3a3a" strokeWidth={3} strokeDasharray="6 5" />
        <text x="60" y="70" textAnchor="middle" fontSize="30" fontWeight="700" fill="#5a5a5a" fontFamily="Oswald, sans-serif">
          ?
        </text>
      </svg>
    );
  }
  const i = tierIndex(score);
  const [light, base, dark] = TIERS[i].c;
  const g = (n: string) => `${n}${uid}`;
  const glow = i >= 5 ? `drop-shadow(0 0 ${Math.max(2, size / 9)}px ${base}99)` : undefined;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="shrink-0 overflow-visible" style={{ filter: glow }}>
      <defs>
        <linearGradient id={g('m')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.45" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={g('i')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark} />
          <stop offset="1" stopColor="#0b0b0b" />
        </linearGradient>
        <linearGradient id={g('s')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={g('c')}>
          <path d={SHIELD} />
        </clipPath>
      </defs>

      {i === 8 && <Laurel fill={`url(#${g('m')})`} />}
      {i >= 6 && <path d="M42 22 L46 2 L55 15 L60 -2 L65 15 L74 2 L78 22 Z" fill={`url(#${g('m')})`} stroke={dark} strokeWidth={2} />}
      {i >= 4 && (
        <g fill={`url(#${g('m')})`} stroke={dark} strokeWidth={2}>
          <path d="M28 34 L4 26 L14 42 L2 48 L18 56 L10 64 L28 66 Z" />
          <path d="M92 34 L116 26 L106 42 L118 48 L102 56 L110 64 L92 66 Z" />
        </g>
      )}

      <path d={SHIELD} fill={`url(#${g('m')})`} stroke={dark} strokeWidth={2.5} />
      <path d={INNER} fill={`url(#${g('i')})`} stroke={light} strokeOpacity={0.5} strokeWidth={1.5} />
      {i === 0 && (
        <g clipPath={`url(#${g('c')})`} stroke={light} strokeOpacity={0.25} strokeWidth={1.5} fill="none">
          <path d="M30 40 C45 36 60 44 90 38 M30 62 C50 58 65 66 90 60 M30 84 C48 80 70 88 90 82" />
        </g>
      )}
      {glyph(i).map((d, k) => (
        <path
          key={k}
          d={d}
          fill={i === 5 && k === 1 ? 'none' : `url(#${g('m')})`}
          stroke={i === 5 && k === 1 ? dark : light}
          strokeWidth={i === 5 && k === 1 ? 1.5 : 1}
          strokeLinejoin="round"
        />
      ))}

      {shine && i >= 3 && (
        <g clipPath={`url(#${g('c')})`}>
          <rect x="-60" y="-10" width="40" height="140" fill={`url(#${g('s')})`} transform="skewX(-20)">
            <animate attributeName="x" values="-80;160;160" keyTimes="0;0.45;1" dur="3.2s" repeatCount="indefinite" />
          </rect>
        </g>
      )}
    </svg>
  );
}

export function TierName({ score, className = '' }: { score: number | null; className?: string }) {
  if (score == null) return <span className={`font-display text-muted ${className}`}>Unranked</span>;
  const t = TIERS[tierIndex(score)];
  return (
    <span className={`font-display font-bold ${className}`} style={{ color: t.c[1] }}>
      {t.name}
    </span>
  );
}

/** Thin progress bar through the current tier, coloured with the next tier's metal. */
export function TierBar({ score, className = '' }: { score: number; className?: string }) {
  const i = tierIndex(score);
  const lo = TIERS[i].min;
  const hi = TIERS[i + 1]?.min ?? 1000;
  const p = Math.max(0, Math.min(1, (score - lo) / (hi - lo)));
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${p * 100}%`, background: `linear-gradient(90deg, ${TIERS[i].c[1]}, ${(TIERS[i + 1] ?? TIERS[i]).c[0]})` }} />
    </div>
  );
}

/** Spinning light rays behind a big badge. */
export function Rays({ color, size }: { color: string; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        background: `repeating-conic-gradient(from 0deg, ${color}55 0deg 8deg, transparent 8deg 24deg)`,
        maskImage: 'radial-gradient(circle, black 20%, transparent 68%)',
        WebkitMaskImage: 'radial-gradient(circle, black 20%, transparent 68%)',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
    />
  );
}
