import type { EmojiName } from '../components/Emoji';

export type StickerCategory = 'mascots' | 'cozy' | 'sparkle' | 'sweets';

export type StickerDef = {
  id: string;
  name: string;
  category: StickerCategory;
  /** Art name for the bundled OpenMoji stickers (see components/Emoji.tsx). */
  glyph?: EmojiName;
  /** Image path for mascot stickers. */
  src?: string;
};

export const CATEGORY_META: Record<StickerCategory, { label: string; emoji: EmojiName }> = {
  mascots: { label: 'Mascot pals', emoji: 'ribbon' },
  cozy: { label: 'Cozy holidays', emoji: 'tree' },
  sparkle: { label: 'Stars & sparkle', emoji: 'sparkles' },
  sweets: { label: 'Sweets & treats', emoji: 'cookie' },
};

const mascot = (id: string, name: string, src: string): StickerDef => ({
  id,
  name,
  category: 'mascots',
  src,
});

const emoji = (id: string, name: string, category: StickerCategory, glyph: EmojiName): StickerDef => ({
  id,
  name,
  category,
  glyph,
});

export const STICKERS: StickerDef[] = [
  mascot('santa-cheer', 'Merry Mochi', '/stickers/santa-cheer.png'),
  mascot('santa-goggles', 'Goggle Gumi', '/stickers/santa-goggles.png'),
  mascot('santa-peace', 'Peace Pippa', '/stickers/santa-peace.png'),

  emoji('tree', 'Little tree', 'cozy', 'tree'),
  emoji('candy-cane', 'Candy cane', 'cozy', 'candy'),
  emoji('gingerbread', 'Gingerbread', 'cozy', 'cookie'),
  emoji('bell', 'Jingle bell', 'cozy', 'bell'),
  emoji('bow', 'Rosy bow', 'cozy', 'ribbon'),
  emoji('sock', 'Cozy socks', 'cozy', 'socks'),
  emoji('gift', 'Gift box', 'cozy', 'gift'),
  emoji('snowman', 'Snow pal', 'cozy', 'snowman'),
  emoji('snowflake', 'Snowflake', 'cozy', 'snowflake'),
  emoji('mitten', 'Mittens', 'cozy', 'mittens'),
  emoji('candle', 'Candlelight', 'cozy', 'candle'),
  emoji('sleigh', 'Sleigh ride', 'cozy', 'sled'),
  emoji('reindeer', 'Reindeer', 'cozy', 'deer'),
  emoji('santa', 'Santa', 'cozy', 'santa'),

  emoji('star', 'Gold star', 'sparkle', 'star'),
  emoji('sparkles', 'Sparkles', 'sparkle', 'sparkles'),
  emoji('heart', 'Heart', 'sparkle', 'heart'),
  emoji('glow', 'Glow orb', 'sparkle', 'orb'),
  emoji('rainbow', 'Rainbow', 'sparkle', 'rainbow'),
  emoji('moon', 'Sleepy moon', 'sparkle', 'moon'),
  emoji('balloon', 'Balloon', 'sparkle', 'balloon'),
  emoji('flower', 'Flower', 'sparkle', 'flower'),
  emoji('clover', 'Lucky clover', 'sparkle', 'clover'),
  emoji('party', 'Party popper', 'sparkle', 'party'),
  emoji('crown', 'Tiny crown', 'sparkle', 'crown'),
  emoji('ribbon-star', 'Shooting star', 'sparkle', 'star2'),

  emoji('hot-cocoa', 'Hot cocoa', 'sweets', 'cocoa'),
  emoji('cupcake', 'Cupcake', 'sweets', 'cupcake'),
  emoji('donut', 'Donut', 'sweets', 'donut'),
  emoji('lollipop', 'Lollipop', 'sweets', 'lollipop'),
  emoji('cake', 'Slice of cake', 'sweets', 'cake'),
  emoji('ice-cream', 'Ice cream', 'sweets', 'icecream'),
  emoji('strawberry', 'Strawberry', 'sweets', 'strawberry'),
  emoji('cookie', 'Choco bar', 'sweets', 'choco'),
];

export const STICKER_MAP: Record<string, StickerDef> = Object.fromEntries(
  STICKERS.map((s) => [s.id, s]),
);

export const MASCOTS = STICKERS.filter((s) => s.category === 'mascots');

export const DEFAULT_MONTH_STICKERS: Record<string, Array<{ id: string; x: number; y: number }>> = {
  '12': [
    { id: 'santa-cheer', x: 94, y: 4 },
    { id: 'santa-goggles', x: 2, y: 74 },
    { id: 'santa-peace', x: 88, y: 80 },
  ],
  '2': [{ id: 'santa-cheer', x: 93, y: 6 }],
  '10': [{ id: 'santa-goggles', x: 4, y: 70 }],
  '7': [{ id: 'santa-peace', x: 88, y: 76 }],
};

export function defaultStickerForMonth(month: number) {
  return DEFAULT_MONTH_STICKERS[String(month)] ?? [];
}

export const randomSticker = () => STICKERS[Math.floor(Math.random() * STICKERS.length)];
