import React, { useEffect, useRef, useState } from 'react';
import {
  Brush,
  Circle,
  Copy,
  Eraser,
  FlipHorizontal,
  FlipVertical,
  Minus,
  PaintBucket,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import type { Costume, SpriteModel } from '../types/studio';

interface CostumeEditorProps {
  sprite: SpriteModel;
  onSelectCostume: (index: number) => void;
  onUpdateCostumeData: (costumeId: string, dataUrl: string) => void;
  onRenameCostume: (costumeId: string, name: string) => void;
  onAddCostume: (costume: Costume) => void;
  onDuplicateCostume: (index: number) => void;
  onDeleteCostume: (index: number) => void;
}

type PaintTool = 'brush' | 'eraser' | 'line' | 'rect' | 'circle' | 'fill' | 'magic-erase';

const SWATCHES = [
  '#1E293B',
  '#FFFFFF',
  '#EF4444',
  '#F97316',
  '#FACC15',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#C47835',
  '#7C2D12',
];

const CANVAS_SIZE = 512;

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

export const CostumeEditor: React.FC<CostumeEditorProps> = ({
  sprite,
  onSelectCostume,
  onUpdateCostumeData,
  onRenameCostume,
  onAddCostume,
  onDuplicateCostume,
  onDeleteCostume,
}) => {
  const currentCostume = sprite.costumes[sprite.currentCostumeIndex] ?? sprite.costumes[0];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<PaintTool>('brush');
  const [color, setColor] = useState('#8B5CF6');
  const [brushSize, setBrushSize] = useState(10);
  const [history, setHistory] = useState<ImageData[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const drawingRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    snapshot: ImageData | null;
  }>({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, snapshot: null });

  // Load selected costume image onto 512x512 canvas when costume ID changes
  useEffect(() => {
    if (!currentCostume) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height, 1.5);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (CANVAS_SIZE - dw) / 2, (CANVAS_SIZE - dh) / 2, dw, dh);
      setHistory([ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)]);
    };
    img.src = currentCostume.dataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCostume?.id]);

  const commitCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !currentCostume) return;
    const snap = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setHistory((prev) => [...prev.slice(-14), snap]);
    onUpdateCostumeData(currentCostume.id, canvas.toDataURL('image/png'));
  };

  const handleUndo = () => {
    if (history.length <= 1 || !currentCostume) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const nextHist = history.slice(0, -1);
    const prevImg = nextHist[nextHist.length - 1];
    ctx.putImageData(prevImg, 0, 0);
    setHistory(nextHist);
    onUpdateCostumeData(currentCostume.id, canvas.toDataURL('image/png'));
  };

  const flipCanvas = (horizontal: boolean) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const temp = document.createElement('canvas');
    temp.width = CANVAS_SIZE;
    temp.height = CANVAS_SIZE;
    temp.getContext('2d')?.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.save();
    if (horizontal) {
      ctx.translate(CANVAS_SIZE, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, CANVAS_SIZE);
      ctx.scale(1, -1);
    }
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
    commitCanvas();
  };

  const floodRegion = (startX: number, startY: number, eraseMode: boolean) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const imgData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const data = imgData.data;
    const sx = Math.max(0, Math.min(CANVAS_SIZE - 1, Math.floor(startX)));
    const sy = Math.max(0, Math.min(CANVAS_SIZE - 1, Math.floor(startY)));
    const startIdx = (sy * CANVAS_SIZE + sx) * 4;
    const tr = data[startIdx];
    const tg = data[startIdx + 1];
    const tb = data[startIdx + 2];
    const ta = data[startIdx + 3];

    const [fr, fg, fb, fa] = eraseMode ? [0, 0, 0, 0] : hexToRgba(color);
    if (tr === fr && tg === fg && tb === fb && ta === fa) return;

    const tol = eraseMode ? 38 : 28;
    const visited = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);
    const stack: number[] = [sx, sy];
    visited[sy * CANVAS_SIZE + sx] = 1;

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      const idx = (y * CANVAS_SIZE + x) * 4;
      data[idx] = fr;
      data[idx + 1] = fg;
      data[idx + 2] = fb;
      data[idx + 3] = fa;

      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < CANVAS_SIZE && ny >= 0 && ny < CANVAS_SIZE) {
          const vIdx = ny * CANVAS_SIZE + nx;
          if (!visited[vIdx]) {
            const pIdx = vIdx * 4;
            const diff =
              Math.abs(data[pIdx] - tr) +
              Math.abs(data[pIdx + 1] - tg) +
              Math.abs(data[pIdx + 2] - tb) +
              Math.abs(data[pIdx + 3] - ta);
            if (diff <= tol * 3) {
              visited[vIdx] = 1;
              stack.push(nx, ny);
            }
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    commitCanvas();
  };

  const getCanvasPoint = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const pt = getCanvasPoint(e);
    if (tool === 'fill') {
      floodRegion(pt.x, pt.y, false);
      return;
    }
    if (tool === 'magic-erase') {
      floodRegion(pt.x, pt.y, true);
      return;
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawingRef.current = {
      active: true,
      startX: pt.x,
      startY: pt.y,
      lastX: pt.x,
      lastY: pt.y,
      snapshot: ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE),
    };
    if (tool === 'brush' || tool === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const st = drawingRef.current;
    if (!st.active) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);

    if (tool === 'brush' || tool === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(st.lastX, st.lastY);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.restore();
      st.lastX = pt.x;
      st.lastY = pt.y;
    } else if (st.snapshot) {
      ctx.putImageData(st.snapshot, 0, 0);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(st.startX, st.startY);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(st.startX, st.startY, pt.x - st.startX, pt.y - st.startY);
      } else if (tool === 'circle') {
        const rx = Math.abs(pt.x - st.startX) / 2;
        const ry = Math.abs(pt.y - st.startY) / 2;
        ctx.beginPath();
        ctx.ellipse(
          (st.startX + pt.x) / 2,
          (st.startY + pt.y) / 2,
          rx,
          ry,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const handlePointerUp = () => {
    if (!drawingRef.current.active) return;
    drawingRef.current.active = false;
    commitCanvas();
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onAddCostume({
          id: `cost_${Date.now()}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          dataUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBlankCostume = () => {
    const blank = document.createElement('canvas');
    blank.width = CANVAS_SIZE;
    blank.height = CANVAS_SIZE;
    onAddCostume({
      id: `cost_${Date.now()}`,
      name: `Costume ${sprite.costumes.length + 1}`,
      dataUrl: blank.toDataURL('image/png'),
    });
  };

  return (
    <div className="costume-studio">
      {/* Left Costume Strip */}
      <aside className="costume-sidebar">
        <div className="sidebar-head">Costumes ({sprite.costumes.length})</div>
        <div className="costume-list">
          {sprite.costumes.map((c, idx) => (
            <div
              key={c.id}
              className={`costume-thumb-card ${
                idx === sprite.currentCostumeIndex ? 'active' : ''
              }`}
              onClick={() => onSelectCostume(idx)}
            >
              <span className="costume-idx">{idx + 1}</span>
              <img src={c.dataUrl} alt={c.name} />
              <div className="costume-thumb-name">{c.name}</div>
              <div className="costume-thumb-actions">
                <button
                  type="button"
                  title="Duplicate costume"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onDuplicateCostume(idx);
                  }}
                >
                  <Copy size={12} />
                </button>
                {sprite.costumes.length > 1 && (
                  <button
                    type="button"
                    title="Delete costume"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onDeleteCostume(idx);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="costume-add-stack">
          <button type="button" className="studio-btn primary" onClick={handleBlankCostume}>
            <Plus size={14} /> Paint New
          </button>
          <button
            type="button"
            className="studio-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} /> Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleUploadFile}
          />
        </div>
      </aside>

      {/* Main Paint Workspace */}
      <div className="costume-main">
        <div className="paint-toolbar">
          <input
            type="text"
            className="costume-title-input"
            value={currentCostume?.name ?? ''}
            onChange={(e) => currentCostume && onRenameCostume(currentCostume.id, e.target.value)}
            aria-label="Costume name"
          />

          <div className="paint-tools-group">
            {(
              [
                ['brush', Brush, 'Brush'],
                ['eraser', Eraser, 'Eraser'],
                ['fill', PaintBucket, 'Fill Bucket'],
                ['magic-erase', Wand2, 'Magic Background Remover'],
                ['line', Minus, 'Line'],
                ['rect', Square, 'Rectangle'],
                ['circle', Circle, 'Circle'],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                className={`tool-icon-btn ${tool === id ? 'selected' : ''}`}
                onClick={() => setTool(id)}
                title={label}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>

          <div className="paint-tools-group">
            <button
              type="button"
              className="tool-icon-btn"
              onClick={() => flipCanvas(true)}
              title="Flip Horizontal"
            >
              <FlipHorizontal size={15} />
            </button>
            <button
              type="button"
              className="tool-icon-btn"
              onClick={() => flipCanvas(false)}
              title="Flip Vertical"
            >
              <FlipVertical size={15} />
            </button>
            <button
              type="button"
              className="tool-icon-btn"
              onClick={handleUndo}
              disabled={history.length <= 1}
              title="Undo"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>

        <div className="paint-subbar">
          <div className="swatch-row">
            {SWATCHES.map((sw) => (
              <button
                key={sw}
                type="button"
                className={`color-swatch ${color.toLowerCase() === sw.toLowerCase() ? 'active' : ''}`}
                style={{ background: sw }}
                onClick={() => setColor(sw)}
                aria-label={`Color ${sw}`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              title="Custom Color"
              className="custom-color-input"
            />
          </div>

          <label className="brush-slider-label">
            <span>Size: {brushSize}px</span>
            <input
              type="range"
              min={2}
              max={54}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="paint-canvas-stage">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="checkerboard-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>
    </div>
  );
};
