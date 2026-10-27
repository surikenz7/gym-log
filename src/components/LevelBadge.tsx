import { useId } from 'react';
import { LEVEL_TITLES, titleIndex } from '../lib/progress';

/** Hexagon level badge in its title's colours; higher titles get chevrons and, from Golden Era, a crown. */
export function LevelBadge({ level, size = 48, locked }: { level: number; size?: number; locked?: boolean }) {
  const id = useId().replace(/:/g, '');
  const tier = titleIndex(level);
  const [light, dark] = LEVEL_TITLES[tier][2];
  const chevrons = tier === 0 ? 0 : tier <= 6 ? Math.ceil(tier / 2) : 3;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`shrink-0 ${locked ? 'opacity-35 grayscale' : ''}`} aria-hidden>
      <defs>
        <linearGradient id={`lb${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <polygon points="50,4 91,27.5 91,72.5 50,96 9,72.5 9,27.5" fill={`url(#lb${id})`} />
      <polygon points="50,13 83,32 83,68 50,87 17,68 17,32" fill="rgb(0 0 0 / 0.3)" stroke="rgb(255 255 255 / 0.4)" strokeWidth="2" />
      {tier >= 7 && <path d="M34 20 L39 9 L45 16 L50 6 L55 16 L61 9 L66 20 Z" fill={light} stroke={dark} strokeWidth="1.5" strokeLinejoin="round" />}
      <text x="50" y={chevrons ? 45 : 50} dy="0.35em" textAnchor="middle" fontWeight="700" fontSize={level >= 100 ? 30 : 38} fill="#fff" style={{ fontFamily: 'var(--font-display), Oswald, Impact, sans-serif' }}>
        {level}
      </text>
      {Array.from({ length: chevrons }, (_, i) => (
        <path key={i} d={`M42 ${66 + i * 5} L50 ${70 + i * 5} L58 ${66 + i * 5}`} fill="none" stroke={light} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
