import { STICKER_MAP } from '../lib/stickers';
import { Emoji, emojiSrc } from './Emoji';
import type { CSSProperties } from 'react';

type Props = {
  id: string;
  className?: string;
  style?: CSSProperties;
  /** Optional label for a11y when rendered standalone. */
  alt?: string;
};

export function Sticker({ id, className, style, alt }: Props) {
  const def = STICKER_MAP[id];
  if (!def) return null;
  if (def.src) {
    return (
      <img
        className={className}
        style={style}
        src={def.src}
        alt={alt ?? def.name}
        draggable={false}
        loading="lazy"
      />
    );
  }
  if (!def.glyph) return null;
  return <Emoji name={def.glyph} className={className} style={style} label={alt} />;
}

/** Raw image URL for canvas export / preloading. */
export const stickerImageSrc = (id: string): string | null => {
  const def = STICKER_MAP[id];
  if (!def) return null;
  if (def.src) return def.src;
  return def.glyph ? emojiSrc(def.glyph) : null;
};
