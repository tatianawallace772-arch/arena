import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { stickerById } from '../lib/data';
import type { PlacedSticker } from '../lib/types';
import { StickerGlyph } from './StickerGlyph';

interface Layout {
  left: number;
  top: number;
  size: number;
}

interface Props {
  stickers: PlacedSticker[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** px multiplier applied to each sticker's base size */
  unit: number;
  editable: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<PlacedSticker>) => void;
  onRemove: (id: string) => void;
  className?: string;
}

type Drag =
  | { mode: 'move'; id: string; offX: number; offY: number }
  | { mode: 'resize'; id: string; startY: number; startScale: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Renders placed stickers on a layer that spans exactly the [data-iso] cells of
 * the surface. Stickers are stored in 0-100% coordinates inside their day, so
 * they hold position across resizes. Dragging one over a different day re-homes
 * it to that date.
 */
export default function StickerCanvas({
  stickers,
  containerRef,
  unit,
  editable,
  selectedId,
  onSelect,
  onUpdate,
  onRemove,
  className = '',
}: Props) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [, setVersion] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [cells, setCells] = useState<{ left: number; top: number; width: number; height: number }[]>([]);
  const [origin, setOrigin] = useState<{ left: number; top: number } | null>(null);

  const remeasure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const found = Array.from(root.querySelectorAll<HTMLElement>('[data-iso]'));
    if (found.length === 0) {
      // A single-surface panel (day view) fills the container.
      setBox({ left: 0, top: 0, width: rootRect.width, height: rootRect.height });
      setCells([{ left: 0, top: 0, width: rootRect.width, height: rootRect.height }]);
      setOrigin({ left: rootRect.left, top: rootRect.top });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const list = found.map((cell) => {
      const r = cell.getBoundingClientRect();
      minX = Math.min(minX, r.left);
      minY = Math.min(minY, r.top);
      maxX = Math.max(maxX, r.right);
      maxY = Math.max(maxY, r.bottom);
      return { left: r.left - rootRect.left, top: r.top - rootRect.top, width: r.width, height: r.height };
    });
    setBox({ left: minX - rootRect.left, top: minY - rootRect.top, width: maxX - minX, height: maxY - minY });
    setCells(list);
    setOrigin({ left: rootRect.left, top: rootRect.top });
  }, [containerRef]);

  useLayoutEffect(() => {
    remeasure();
    setVersion((v) => v + 1);
  }, [remeasure, stickers.length]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => {
      remeasure();
      setVersion((v) => v + 1);
    });
    ro.observe(root);
    for (const cell of Array.from(root.querySelectorAll<HTMLElement>('[data-iso]'))) ro.observe(cell);
    const onScroll = () => {
      remeasure();
      setVersion((v) => v + 1);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [containerRef, remeasure, stickers.length]);

  const cellIndexForDate = useCallback(
    (date: string) => {
      const root = containerRef.current;
      if (!root) return -1;
      const list = Array.from(root.querySelectorAll<HTMLElement>('[data-iso]'));
      if (list.length <= 1) return 0;
      return list.findIndex((c) => c.dataset.iso === date);
    },
    [containerRef],
  );

  const measure = useCallback(
    (s: PlacedSticker): Layout | null => {
      const idx = cellIndexForDate(s.date);
      const cell = cells[idx];
      if (!cell) return null;
      const size = (stickerById(s.stickerId)?.base ?? 40) * s.scale * unit;
      return {
        left: cell.left + (s.x / 100) * cell.width,
        top: cell.top + (s.y / 100) * cell.height,
        size,
      };
    },
    [cellIndexForDate, cells, unit],
  );

  const resolveCell = useCallback(
    (clientX: number, clientY: number) => {
      const root = containerRef.current;
      if (!root) return null;
      for (const el of document.elementsFromPoint(clientX, clientY)) {
        const cell = (el as HTMLElement).closest?.<HTMLElement>('[data-iso]');
        if (cell && root.contains(cell)) return cell;
      }
      return null;
    },
    [containerRef],
  );

  useEffect(() => {
    if (!activeId) return;
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !origin) return;
      if (drag.mode === 'move') {
        e.preventDefault();
        const target = resolveCell(e.clientX, e.clientY);
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const x = clamp(((e.clientX - drag.offX - rect.left) / rect.width) * 100, 0, 100);
        const y = clamp(((e.clientY - drag.offY - rect.top) / rect.height) * 100, 0, 100);
        const date = target.dataset.iso;
        onUpdate(drag.id, { x, y, ...(date ? { date } : {}) });
      } else {
        e.preventDefault();
        const dy = e.clientY - drag.startY;
        onUpdate(drag.id, { scale: Number(clamp(drag.startScale * (1 + dy / 150), 0.3, 2.6).toFixed(2)) });
      }
    };
    const up = () => {
      setActiveId(null);
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [activeId, onUpdate, origin, resolveCell]);

  const startMove = (e: React.PointerEvent, s: PlacedSticker) => {
    if (!editable || !origin) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(s.id);
    const layout = measure(s);
    if (!layout) return;
    dragRef.current = {
      mode: 'move',
      id: s.id,
      offX: e.clientX - (origin.left + layout.left),
      offY: e.clientY - (origin.top + layout.top),
    };
    setActiveId(s.id);
  };

  const startResize = (e: React.PointerEvent, s: PlacedSticker) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(s.id);
    dragRef.current = { mode: 'resize', id: s.id, startY: e.clientY, startScale: s.scale };
    setActiveId(s.id);
  };

  return (
    <div
      ref={layerRef}
      className={`sticker-layer ${className}`}
      style={
        box
          ? { position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, inset: 'auto' }
          : { opacity: 0 }
      }
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      {stickers.map((s) => {
        const sticker = stickerById(s.stickerId);
        const layout = measure(s);
        if (!sticker || !layout || !box) return null;
        const selected = selectedId === s.id;
        return (
          <div
            key={s.id}
            className={`sticker ${editable ? 'draggable' : ''} ${selected ? 'selected' : ''} ${
              sticker.kind === 'glyph' ? 'glyph' : ''
            }`}
            style={{
              left: layout.left - box.left,
              top: layout.top - box.top,
              width: sticker.kind === 'art' ? layout.size : undefined,
              height: sticker.kind === 'art' ? layout.size : undefined,
              fontSize: sticker.kind === 'glyph' ? layout.size : undefined,
              transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
              zIndex: s.z,
              opacity: activeId === s.id ? 0.85 : 1,
            }}
            role={editable ? 'button' : 'img'}
            aria-label={sticker.name}
            title={editable ? `${sticker.name} — drag to move, corner to resize, double-click to tilt` : sticker.name}
            onPointerDown={(e) => startMove(e, s)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (editable) onUpdate(s.id, { rotation: s.rotation + 15 });
            }}
          >
            {/* art stickers are sized in px; glyphs size from the parent font-size */}
            {sticker.kind === 'art' ? (
              <img src={sticker.src} alt={sticker.name} draggable={false} />
            ) : (
              <span aria-hidden style={{ lineHeight: 1, display: 'block' }}>
                {sticker.glyph}
              </span>
            )}
            {editable && (
              <>
                <button
                  type="button"
                  className="remove"
                  aria-label={`Remove ${sticker.name}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(s.id);
                  }}
                >
                  ×
                </button>
                <span
                  className="resize"
                  role="button"
                  aria-label="Resize sticker"
                  onPointerDown={(e) => startResize(e, s)}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
