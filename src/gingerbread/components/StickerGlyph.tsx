import type { Sticker } from '../lib/types';

export function StickerGlyph({
  sticker,
  size,
  className,
}: {
  sticker: Sticker;
  size: number;
  className?: string;
}) {
  if (sticker.kind === 'art' && sticker.src) {
    return (
      <img
        src={sticker.src}
        alt={sticker.name}
        draggable={false}
        className={className}
        style={{ width: size, height: size, display: 'block', objectFit: 'contain' }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={className}
      style={{ fontSize: size, lineHeight: 1, display: 'block' }}
    >
      {sticker.glyph}
    </span>
  );
}
