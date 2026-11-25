import { useCallback, useEffect, useRef, useState } from 'react';

export interface DragState {
  stickerId: string;
  x: number;
  y: number;
}

/**
 * Pointer-based dragging for stickers inside a positioned container.
 * Returns 0-100 percentage coordinates so sticker placement survives resizes.
 */
export function useStickerDrag(
  containerRef: React.RefObject<HTMLElement | null>,
  onDrag: (xPct: number, yPct: number) => void,
) {
  const [dragging, setDragging] = useState(false);
  const rafRef = useRef<number | null>(null);

  const toPct = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { x: 50, y: 50 };
      const rect = el.getBoundingClientRect();
      return {
        x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
        y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
      };
    },
    [containerRef],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const { x, y } = toPct(e.clientX, e.clientY);
        onDrag(x, y);
      });
    };
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dragging, onDrag, toPct]);

  return { dragging, startDrag: () => setDragging(true) };
}

/** Global keyboard shortcut helper. */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const combo = [
        e.metaKey || e.ctrlKey ? 'mod' : '',
        e.shiftKey ? 'shift' : '',
        e.altKey ? 'alt' : '',
        e.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join('+');
      const fn = map[combo];
      if (!fn) return;
      if (typing && !combo.startsWith('mod')) return;
      fn(e);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [map]);
}
