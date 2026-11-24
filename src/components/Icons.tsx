import { useId } from 'react';
import {
  BatteryCharging,
  BedDouble,
  Dog,
  Fuel,
  MapPin,
  Trees,
  Truck,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '../data/parser';

export const CATEGORY_META: Record<
  number,
  { label: string; plural: string; color: string; bg: string; icon: LucideIcon }
> = {
  0: { label: 'Place', plural: 'Places', color: '#5f6368', bg: '#f1f3f4', icon: MapPin },
  1: { label: 'Gas', plural: 'Gas stations', color: '#c5221f', bg: '#fce8e6', icon: Fuel },
  2: { label: 'Food', plural: 'Food & drink', color: '#e8710a', bg: '#fef3e6', icon: Utensils },
  3: { label: 'Lodging', plural: 'Lodging', color: '#9334e6', bg: '#f3e8fd', icon: BedDouble },
  4: { label: 'Rest area', plural: 'Rest areas', color: '#0b8065', bg: '#e6f4ef', icon: Trees },
  5: { label: 'EV charging', plural: 'EV charging', color: '#188038', bg: '#e6f4ea', icon: BatteryCharging },
  6: { label: 'Park', plural: 'Parks', color: '#188038', bg: '#e6f4ea', icon: Trees },
  7: { label: 'Dog park', plural: 'Dog parks', color: '#a05a2c', bg: '#fbeee4', icon: Dog },
  8: { label: 'Travel center', plural: 'Travel centers', color: '#1a73e8', bg: '#e8f0fe', icon: Truck },
};

export function categoryMeta(category: number) {
  return CATEGORY_META[category] ?? CATEGORY_META[0];
}

export function CategoryIcon({
  category,
  size = 16,
  className,
}: {
  category: number;
  size?: number;
  className?: string;
}) {
  const meta = categoryMeta(category);
  const Icon = meta.icon;
  return <Icon size={size} className={className} style={{ color: meta.color }} strokeWidth={2.1} />;
}

/** Classic U.S. interstate shield. */
export function Shield({
  highway,
  size = 24,
  className,
  title,
}: {
  highway: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const id = useId().replace(/:/g, '');
  const raw = (highway || '').split(';')[0]?.trim() || 'I-';
  const number = raw.replace(/^I-?/i, '').replace(/^US-?/i, 'US ').trim() || '—';
  const isInterstate = /^I-?/i.test(raw);
  const w = size;
  const h = (size * 64) / 60;
  const fontSize = number.length > 3 ? (isInterstate ? 13 : 11) : number.length > 2 ? 15 : 20;
  return (
    <svg
      viewBox="0 0 60 64"
      width={w}
      height={h}
      className={className}
      role="img"
      aria-label={title ?? `Interstate ${number}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={`shield-${id}`}>
          <path d="M30 2.5c8.6 5.6 19.4 7.4 26.2 4.7 2.6 13.2-.4 33.7-26.2 54.3C4.2 40.9 1.2 20.4 3.8 7.2 10.6 9.9 21.4 8.1 30 2.5Z" />
        </clipPath>
        <linearGradient id={`blue-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b7de9" />
          <stop offset="1" stopColor="#0b3d91" />
        </linearGradient>
      </defs>
      <path
        d="M30 2.5c8.6 5.6 19.4 7.4 26.2 4.7 2.6 13.2-.4 33.7-26.2 54.3C4.2 40.9 1.2 20.4 3.8 7.2 10.6 9.9 21.4 8.1 30 2.5Z"
        fill="#fff"
      />
      <g clipPath={`url(#shield-${id})`}>
        <rect x="0" y="0" width="60" height="64" fill={`url(#blue-${id})`} />
        <rect x="0" y="0" width="60" height="23" fill="#c8102e" />
        <text
          x="30"
          y="12.5"
          textAnchor="middle"
          fontFamily="Inter, Arial, sans-serif"
          fontSize="5.2"
          fontWeight="700"
          letterSpacing="0.9"
          fill="#fff"
        >
          INTERSTATE
        </text>
      </g>
      <path
        d="M30 2.5c8.6 5.6 19.4 7.4 26.2 4.7 2.6 13.2-.4 33.7-26.2 54.3C4.2 40.9 1.2 20.4 3.8 7.2 10.6 9.9 21.4 8.1 30 2.5Z"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
      <text
        x="30"
        y={fontSize > 16 ? 45 : 44}
        textAnchor="middle"
        fontFamily="Inter, Arial, sans-serif"
        fontSize={fontSize}
        fontWeight="800"
        letterSpacing="-0.8"
        fill="#fff"
      >
        {number}
      </text>
    </svg>
  );
}

/** Small round interstate badge used in dense lists. */
export function ShieldBadge({
  highway,
  size = 20,
  className,
}: {
  highway: string;
  size?: number;
  className?: string;
}) {
  const raw = (highway || '').split(';')[0]?.trim() || 'I-';
  const number = raw.replace(/^I-?/i, '').trim() || '—';
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size * 1.25,
        height: size * 1.25,
        borderRadius: '50%',
        background: 'linear-gradient(180deg,#2b7de9,#0b3d91)',
        color: '#fff',
        fontSize: size * 0.5,
        fontWeight: 800,
        letterSpacing: '-0.03em',
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.85)',
        fontVariantNumeric: 'tabular-nums',
      }}
      title={raw}
    >
      {number}
    </span>
  );
}

export function CategoryPill({
  category,
  count,
  onClick,
  active,
}: {
  category: number;
  count?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const meta = categoryMeta(category);
  const Icon = meta.icon;
  return (
    <button
      type="button"
      className={`service-chip${active ? ' active' : ''}`}
      onClick={onClick}
      style={active ? { background: meta.bg, borderColor: 'transparent', color: meta.color } : undefined}
    >
      <Icon size={13} style={{ color: meta.color }} />
      {meta.label}
      {count !== undefined && <span className="count">{count}</span>}
    </button>
  );
}

export const CATEGORY_ORDER: Category[] = [1, 2, 3, 4, 5, 8, 6, 7, 0];
