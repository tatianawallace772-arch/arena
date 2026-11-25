import { useCallback, useEffect, useRef, useState } from 'react';
import type { Placement } from '../lib/types';
import { STICKER_MAP } from '../lib/stickers';
import { X } from '../lib/icons';
import { Sticker } from './Sticker';

type Props = {
  placements: Placement[];
  onChange: (next: Placement[]) => void;
  /** Newly dropped mascot that should wiggle in. */
  freshId?: string | null;
  active: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function MonthDecorations({ placements, onChange, freshId, active }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drag = useRef<{
    pointerId: number;
    index: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
  } | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (!active) return;
    const layer = layerRef.current;
    if (!layer) return;
    // let the delete button work normally
    if ((e.target as HTMLElement).closest('.deco-remove')) return;
    const rect = layer.getBoundingClientRect();
    const p = placements[index];
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      index,
      startX: e.clientX,
      startY: e.clientY,
      originX: p.x,
      originY: p.y,
      width: rect.width,
      height: rect.height,
    };
    setDraggingIndex(index);
    setSelectedId(p.sticker + index);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = ((e.clientX - d.startX) / d.width) * 100;
    const dy = ((e.clientY - d.startY) / d.height) * 100;
    const nextX = clamp(d.originX + dx, -4, 92);
    const nextY = clamp(d.originY + dy, -6, 92);
    const next = placements.map((p, i) => (i === d.index ? { ...p, x: nextX, y: nextY } : p));
    onChange(next);
  };

  const endDrag = useCallback(() => {
    drag.current = null;
    setDraggingIndex(null);
  }, []);

  useEffect(() => {
    if (!active) setSelectedId(null);
  }, [active]);

  const remove = (index: number) => {
    onChange(placements.filter((_, i) => i !== index));
    setSelectedId(null);
  };

  if (!placements.length) return null;

  return (
    <div className="deco-layer" ref={layerRef} aria-hidden={!active}>
      {placements.map((p, i) => {
        const def = STICKER_MAP[p.sticker];
        if (!def?.src) return null;
        const selected = selectedId === p.sticker + i;
        const isFresh = freshId === p.sticker && i === placements.length - 1;
        return (
          <div
            key={`${p.sticker}-${i}`}
            className={`deco${draggingIndex === i ? ' dragging' : ''}${selected ? ' selected' : ''}`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `rotate(${i % 2 === 0 ? -7 : 6}deg)`,
              pointerEvents: active ? 'auto' : 'none',
              animation: isFresh ? 'mini-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1)' : undefined,
            }}
            onPointerDown={(e) => onPointerDown(e, i)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title={active ? `Drag ${def.name}` : def.name}
          >
            <Sticker id={p.sticker} alt={def.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            {active && (
              <button className="deco-remove" onClick={() => remove(i)} aria-label={`Remove ${def.name}`}>
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
