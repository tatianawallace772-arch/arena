import type { CSSProperties } from 'react';

/**
 * OpenMoji color SVGs bundled in `public/emoji`.
 * Using artwork instead of the system emoji font keeps stickers identical
 * on every OS (and inside the PNG exporter).
 */
export const EMOJI_FILES = {
  tree: 'tree',
  candy: 'candy',
  cookie: 'cookie',
  bell: 'bell',
  ribbon: 'ribbon',
  socks: 'socks',
  gift: 'gift',
  snowman: 'snowman',
  snowflake: 'snowflake',
  mittens: 'mittens',
  candle: 'candle',
  sled: 'sled',
  deer: 'deer',
  santa: 'santa',

  star: 'star',
  sparkles: 'sparkles',
  heart: 'heart',
  orb: 'orb',
  rainbow: 'rainbow',
  moon: 'moon',
  balloon: 'balloon',
  flower: 'flower',
  clover: 'clover',
  party: 'party',
  crown: 'crown',
  star2: 'star2',

  cocoa: 'cocoa',
  cupcake: 'cupcake',
  donut: 'donut',
  lollipop: 'lollipop',
  cake: 'cake',
  icecream: 'icecream',
  strawberry: 'strawberry',
  choco: 'choco',

  dove: 'dove',
  heartbox: 'heartbox',
  tophat: 'tophat',
  pie: 'pie',
  bunny: 'bunny',
  bouquet: 'bouquet',
  medal: 'medal',
  cap: 'cap',
  sunface: 'sunface',
  fireworks: 'fireworks',
  tools: 'tools',
  pumpkin: 'pumpkin',
  turkey: 'turkey',
  confetti: 'confetti',

  pin: 'pin',
  check: 'check',
  memo: 'memo',
  teddy: 'teddy',
  pencil: 'pencil',
  leaf: 'leaf',
  calendar: 'calendar',
  frame: 'frame',
  floppy: 'floppy',
  sun: 'sun',
  watermelon: 'watermelon',
  leaves: 'leaves',
  tulip: 'tulip',
  dice: 'dice',
  search: 'search',
  puzzle: 'puzzle',
  yheart: 'yheart',
} as const;

export type EmojiName = keyof typeof EMOJI_FILES;

export const emojiSrc = (name: EmojiName) => `/emoji/${EMOJI_FILES[name]}.svg`;

type Props = {
  name: EmojiName;
  className?: string;
  style?: CSSProperties;
  /** Decorative by default; pass a label when the emoji carries meaning. */
  label?: string;
  size?: number;
};

export function Emoji({ name, className, style, label, size }: Props) {
  return (
    <img
      src={emojiSrc(name)}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={['emoji', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, ...style }}
    />
  );
}
