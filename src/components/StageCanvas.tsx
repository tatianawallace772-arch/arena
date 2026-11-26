import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import {
  type AppWidget,
  type BackdropModel,
  type Particle,
  type ParticleKind,
  STAGE_DIMENSIONS,
  type SpriteModel,
  type StageMode,
  type VariableModel,
} from '../types/studio';

export interface StageCanvasHandle {
  drawPenLine: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    size: number
  ) => void;
  stampSprite: (sprite: SpriteModel) => void;
  clearPen: () => void;
  spawnParticles: (kind: ParticleKind, count: number, x: number, y: number) => void;
  shakeScreen: (intensity: number) => void;
}

interface StageCanvasProps {
  stageMode: StageMode;
  backdrop: BackdropModel | undefined;
  sprites: SpriteModel[];
  selectedSpriteId: string;
  widgets: AppWidget[];
  variables: VariableModel[];
  uiEditMode: boolean;
  selectedWidgetId: string | null;
  askState: { question: string; spriteName: string } | null;
  stageToast: string | null;
  onSelectSprite: (id: string) => void;
  onSpriteClickedOnStage: (id: string) => void;
  onSpriteMoved: (id: string, x: number, y: number) => void;
  onWidgetClicked: (id: string) => void;
  onWidgetValueChange: (id: string, value: string) => void;
  onSelectWidget: (id: string) => void;
  onWidgetMoved: (id: string, x: number, y: number) => void;
  onVariableSliderChange: (id: string, value: number) => void;
  onPointerUpdate: (x: number, y: number, down: boolean) => void;
  onSubmitAskAnswer: (answer: string) => void;
}

const PARTICLE_PALETTES: Record<ParticleKind, string[]> = {
  stars: ['#FFE066', '#FFD43B', '#FFF9DB', '#FCC419', '#FAB005'],
  confetti: ['#FF6B6B', '#4DABF7', '#51CF66', '#FCC419', '#CC5DE8', '#FF922B'],
  hearts: ['#FF4D6D', '#FF758F', '#FF8FA3', '#FFB3C1', '#E63946'],
  snow: ['#FFFFFF', '#E7F5FF', '#D0EBFF', '#F8F9FA'],
  magic: ['#C084FC', '#E879F9', '#38BDF8', '#FDE047', '#818CF8'],
  fire: ['#FF922B', '#FD7E14', '#FA5252', '#FFD43B', '#E8590C'],
};

export const StageCanvas = React.forwardRef<StageCanvasHandle, StageCanvasProps>(
  (
    {
      stageMode,
      backdrop,
      sprites,
      selectedSpriteId,
      widgets,
      variables,
      uiEditMode,
      selectedWidgetId,
      askState,
      stageToast,
      onSelectSprite,
      onSpriteClickedOnStage,
      onSpriteMoved,
      onWidgetClicked,
      onWidgetValueChange,
      onSelectWidget,
      onWidgetMoved,
      onVariableSliderChange,
      onPointerUpdate,
      onSubmitAskAnswer,
    },
    ref
  ) => {
    const dim = STAGE_DIMENSIONS[stageMode];
    const hw = dim.width / 2;
    const hh = dim.height / 2;

    const stageBoxRef = useRef<HTMLDivElement | null>(null);
    const penCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const fxCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const shakePowerRef = useRef(0);
    const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
    const [askInput, setAskInput] = useState('');

    // Drag tracking for sprites or widgets
    const dragRef = useRef<{
      kind: 'sprite' | 'widget';
      id: string;
      startMouseX: number;
      startMouseY: number;
      origX: number;
      origY: number;
      moved: boolean;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      drawPenLine(x1, y1, x2, y2, color, size) {
        const ctx = penCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(hw + x1, hh - y1);
        ctx.lineTo(hw + x2, hh - y2);
        ctx.stroke();
      },
      stampSprite(sp) {
        const ctx = penCanvasRef.current?.getContext('2d');
        const c = sp.costumes[sp.currentCostumeIndex] ?? sp.costumes[0];
        if (!ctx || !c) return;
        const img = new Image();
        img.src = c.dataUrl;
        const draw = () => {
          const isSheet = c.dataUrl.startsWith('/sprites/') || c.dataUrl.length > 8000;
          const basePx = isSheet ? 340 : 120;
          const pxSize = (sp.size / 100) * basePx;
          ctx.save();
          ctx.translate(hw + sp.x, hh - sp.y);
          if (sp.rotationStyle === 'left-right' && sp.direction < 0) {
            ctx.scale(-1, 1);
          } else if (sp.rotationStyle === 'all around') {
            ctx.rotate(((sp.direction - 90) * Math.PI) / 180);
          }
          ctx.globalAlpha = Math.max(0, Math.min(1, 1 - sp.effects.ghost / 100));
          ctx.drawImage(img, -pxSize / 2, -pxSize / 2, pxSize, pxSize);
          ctx.restore();
        };
        if (img.complete) draw();
        else img.onload = draw;
      },
      clearPen() {
        const canvas = penCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
      spawnParticles(kind, count, x, y) {
        const palette = PARTICLE_PALETTES[kind] ?? PARTICLE_PALETTES.stars;
        const sx = hw + x;
        const sy = hh - y;
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = kind === 'snow' ? 0.6 + Math.random() * 1.5 : 1.5 + Math.random() * 4.8;
          particlesRef.current.push({
            x: kind === 'snow' ? Math.random() * dim.width : sx,
            y: kind === 'snow' ? 8 : sy,
            vx: Math.cos(angle) * speed * (kind === 'snow' ? 0.4 : 1),
            vy: kind === 'snow' ? 1.2 + Math.random() * 1.8 : Math.sin(angle) * speed - 1.4,
            size: 4 + Math.random() * 5.5,
            color: palette[i % palette.length],
            alpha: 1,
            decay: kind === 'snow' ? 0.008 : 0.022 + Math.random() * 0.012,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.2,
            kind,
          });
        }
      },
      shakeScreen(intensity) {
        shakePowerRef.current = Math.max(shakePowerRef.current, intensity);
      },
    }));

    // 60 FPS Particle + Shake animation loop
    useEffect(() => {
      let raf = 0;
      const renderFx = () => {
        const canvas = fxCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const list = particlesRef.current;
          for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.kind !== 'snow' && p.kind !== 'fire') {
              p.vy += 0.11;
            } else if (p.kind === 'fire') {
              p.vy -= 0.08;
            }
            p.rotation += p.vRot;
            p.alpha -= p.decay;
            if (p.alpha <= 0) {
              list.splice(i, 1);
              continue;
            }
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;

            if (p.kind === 'stars' || p.kind === 'magic') {
              // 5-point mini star
              ctx.beginPath();
              for (let s = 0; s < 5; s++) {
                const outer = (s * 4 * Math.PI) / 5 - Math.PI / 2;
                ctx.lineTo(Math.cos(outer) * p.size, Math.sin(outer) * p.size);
              }
              ctx.closePath();
              ctx.fill();
            } else if (p.kind === 'hearts') {
              const r = p.size * 0.6;
              ctx.beginPath();
              ctx.arc(-r * 0.5, -r * 0.3, r * 0.6, 0, Math.PI * 2);
              ctx.arc(r * 0.5, -r * 0.3, r * 0.6, 0, Math.PI * 2);
              ctx.moveTo(-r * 1.05, -r * 0.1);
              ctx.lineTo(0, r * 1.2);
              ctx.lineTo(r * 1.05, -r * 0.1);
              ctx.fill();
            } else if (p.kind === 'confetti') {
              ctx.fillRect(-p.size * 0.7, -p.size * 0.35, p.size * 1.4, p.size * 0.7);
            } else {
              ctx.beginPath();
              ctx.arc(0, 0, p.size * 0.65, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }

        if (shakePowerRef.current > 0.25) {
          const mag = shakePowerRef.current;
          setShakeOffset({
            x: (Math.random() * 2 - 1) * mag,
            y: (Math.random() * 2 - 1) * mag,
          });
          shakePowerRef.current *= 0.86;
        } else if (shakePowerRef.current > 0) {
          shakePowerRef.current = 0;
          setShakeOffset({ x: 0, y: 0 });
        }

        raf = requestAnimationFrame(renderFx);
      };
      raf = requestAnimationFrame(renderFx);
      return () => cancelAnimationFrame(raf);
    }, [dim.width, dim.height]);

    const clientToScratch = (clientX: number, clientY: number) => {
      const box = stageBoxRef.current;
      if (!box) return { x: 0, y: 0 };
      const rect = box.getBoundingClientRect();
      const sx = ((clientX - rect.left) / rect.width) * dim.width - hw;
      const sy = hh - ((clientY - rect.top) / rect.height) * dim.height;
      return {
        x: Math.round(Math.max(-hw, Math.min(hw, sx))),
        y: Math.round(Math.max(-hh, Math.min(hh, sy))),
      };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      const pt = clientToScratch(e.clientX, e.clientY);
      onPointerUpdate(pt.x, pt.y, e.buttons > 0);

      const d = dragRef.current;
      if (d) {
        const dx = pt.x - d.startMouseX;
        const dy = pt.y - d.startMouseY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
        if (d.kind === 'sprite') {
          onSpriteMoved(d.id, d.origX + dx, d.origY + dy);
        } else {
          onWidgetMoved(d.id, d.origX + dx, d.origY + dy);
        }
      }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      const pt = clientToScratch(e.clientX, e.clientY);
      onPointerUpdate(pt.x, pt.y, false);
      const d = dragRef.current;
      dragRef.current = null;
      if (d && !d.moved && d.kind === 'sprite') {
        onSpriteClickedOnStage(d.id);
      }
    };

    const orderedSprites = [...sprites].sort((a, b) => a.layerOrder - b.layerOrder);

    return (
      <div className={`stage-viewport-wrap mode-${stageMode}`}>
        <div
          ref={stageBoxRef}
          className={`stage-surface ${stageMode === 'mobile' ? 'phone-bezel' : ''} ${
            uiEditMode ? 'ui-grid-overlay' : ''
          }`}
          style={{
            width: `${dim.width}px`,
            height: `${dim.height}px`,
            transform:
              shakeOffset.x || shakeOffset.y
                ? `translate(${shakeOffset.x}px, ${shakeOffset.y}px)`
                : undefined,
          }}
          onPointerMove={handlePointerMove}
          onPointerDown={(e) => {
            const pt = clientToScratch(e.clientX, e.clientY);
            onPointerUpdate(pt.x, pt.y, true);
          }}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            dragRef.current = null;
          }}
        >
          {stageMode === 'mobile' && <div className="phone-notch" aria-hidden="true" />}

          {/* Backdrop */}
          {backdrop && (
            <img
              className="stage-backdrop-img"
              src={backdrop.dataUrl}
              alt={backdrop.name}
              draggable={false}
            />
          )}

          {/* Pen Layer */}
          <canvas
            ref={penCanvasRef}
            className="stage-canvas-layer"
            width={dim.width}
            height={dim.height}
          />

          {/* Sprites Layer */}
          {orderedSprites.map((sp) => {
            if (!sp.visible) return null;
            const costume = sp.costumes[sp.currentCostumeIndex] ?? sp.costumes[0];
            if (!costume) return null;

            const isHighResCostume =
              costume.dataUrl.startsWith('/sprites/') || costume.dataUrl.length > 8000;
            const baseVisualPx = isHighResCostume ? 340 : 120;
            const pxSize = Math.max(12, (sp.size / 100) * baseVisualPx);

            let rotTransform = '';
            if (sp.rotationStyle === 'left-right') {
              if (sp.direction < 0) rotTransform = 'scaleX(-1)';
            } else if (sp.rotationStyle === 'all around') {
              rotTransform = `rotate(${sp.direction - 90}deg)`;
            }

            const filterStr = [
              sp.effects.color ? `hue-rotate(${sp.effects.color * 1.8}deg)` : '',
              sp.effects.brightness
                ? `brightness(${Math.max(0.1, 1 + sp.effects.brightness / 100)})`
                : '',
            ]
              .filter(Boolean)
              .join(' ');

            const opacity = Math.max(0, Math.min(1, 1 - sp.effects.ghost / 100));
            const leftPx = hw + sp.x - pxSize / 2;
            const topPx = hh - sp.y - pxSize / 2;

            return (
              <React.Fragment key={sp.id}>
                <div
                  className={`stage-sprite ${
                    !sp.isClone && sp.id === selectedSpriteId ? 'selected-outline' : ''
                  }`}
                  style={{
                    width: `${pxSize}px`,
                    height: `${pxSize}px`,
                    left: `${leftPx}px`,
                    top: `${topPx}px`,
                    transform: rotTransform || undefined,
                    filter: filterStr || undefined,
                    opacity,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (!sp.isClone) onSelectSprite(sp.id);
                    const pt = clientToScratch(e.clientX, e.clientY);
                    dragRef.current = {
                      kind: 'sprite',
                      id: sp.id,
                      startMouseX: pt.x,
                      startMouseY: pt.y,
                      origX: sp.x,
                      origY: sp.y,
                      moved: false,
                    };
                  }}
                >
                  <img src={costume.dataUrl} alt={sp.name} draggable={false} />
                </div>

                {sp.bubble && (
                  <div
                    className={`stage-speech-bubble bubble-${sp.bubble.type}`}
                    style={{
                      left: `${Math.max(54, Math.min(dim.width - 54, hw + sp.x))}px`,
                      top: `${Math.max(34, hh - sp.y - pxSize * 0.44)}px`,
                    }}
                  >
                    {sp.bubble.text}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Variable Readout Monitors */}
          {variables
            .filter((v) => v.visible)
            .map((v) => (
              <div
                key={v.id}
                className={`stage-var-monitor mode-${v.readout}`}
                style={{
                  left: `${Math.max(8, Math.min(dim.width - 110, hw + v.x))}px`,
                  top: `${Math.max(8, Math.min(dim.height - 34, hh - v.y))}px`,
                }}
              >
                {v.readout === 'large' ? (
                  <span className="var-pill large">{v.value}</span>
                ) : (
                  <>
                    <span className="var-name">{v.name}</span>
                    <span className="var-pill">{v.value}</span>
                    {v.readout === 'slider' && (
                      <input
                        type="range"
                        min={v.sliderMin}
                        max={v.sliderMax}
                        value={Number(v.value) || 0}
                        onChange={(e) => onVariableSliderChange(v.id, Number(e.target.value))}
                      />
                    )}
                  </>
                )}
              </div>
            ))}

          {/* App UI Widgets Layer */}
          {widgets.map((w) => {
            if (!w.visible && !uiEditMode) return null;
            const isSel = uiEditMode && selectedWidgetId === w.id;
            return (
              <div
                key={w.id}
                className={`stage-ui-widget ${uiEditMode ? 'editable' : ''} ${
                  isSel ? 'widget-selected' : ''
                } ${!w.visible ? 'widget-hidden-preview' : ''}`}
                style={{
                  left: `${hw + w.x}px`,
                  top: `${hh - w.y}px`,
                }}
                onPointerDown={(e) => {
                  if (!uiEditMode) return;
                  e.stopPropagation();
                  onSelectWidget(w.id);
                  const pt = clientToScratch(e.clientX, e.clientY);
                  dragRef.current = {
                    kind: 'widget',
                    id: w.id,
                    startMouseX: pt.x,
                    startMouseY: pt.y,
                    origX: w.x,
                    origY: w.y,
                    moved: false,
                  };
                }}
              >
                {w.type === 'button' && (
                  <button
                    type="button"
                    className="app-widget-btn"
                    style={{
                      width: `${w.width}px`,
                      height: `${w.height}px`,
                      background: w.color,
                      color: w.textColor,
                      fontSize: `${w.fontSize}px`,
                      borderRadius: `${w.borderRadius}px`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (uiEditMode) onSelectWidget(w.id);
                      else onWidgetClicked(w.id);
                    }}
                  >
                    {w.label}
                  </button>
                )}

                {w.type === 'label' && (
                  <div
                    className="app-widget-label"
                    style={{
                      minWidth: `${w.width}px`,
                      minHeight: `${w.height}px`,
                      background: w.color,
                      color: w.textColor,
                      fontSize: `${w.fontSize}px`,
                      borderRadius: `${w.borderRadius}px`,
                    }}
                  >
                    {w.label}
                  </div>
                )}

                {w.type === 'input' && (
                  <input
                    type="text"
                    className="app-widget-input"
                    value={w.value}
                    placeholder={w.placeholder || w.label}
                    readOnly={uiEditMode}
                    style={{
                      width: `${w.width}px`,
                      height: `${w.height}px`,
                      background: w.color,
                      color: w.textColor,
                      fontSize: `${w.fontSize}px`,
                      borderRadius: `${w.borderRadius}px`,
                    }}
                    onChange={(e) => onWidgetValueChange(w.id, e.target.value)}
                  />
                )}

                {w.type === 'slider' && (
                  <div
                    className="app-widget-slider"
                    style={{
                      width: `${w.width}px`,
                      borderRadius: `${w.borderRadius}px`,
                    }}
                  >
                    <div className="slider-head">
                      <span>{w.label}</span>
                      <strong>{w.value}</strong>
                    </div>
                    <input
                      type="range"
                      min={w.min ?? 0}
                      max={w.max ?? 100}
                      value={Number(w.value) || 0}
                      disabled={uiEditMode}
                      style={{ accentColor: w.color }}
                      onChange={(e) => onWidgetValueChange(w.id, e.target.value)}
                    />
                  </div>
                )}

                {w.type === 'progress' && (
                  <div
                    className="app-widget-progress"
                    style={{
                      width: `${w.width}px`,
                      height: `${w.height}px`,
                      borderRadius: `${w.borderRadius}px`,
                    }}
                  >
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, (Number(w.value || 0) / Math.max(1, w.max ?? 100)) * 100)
                        )}%`,
                        background: w.color,
                      }}
                    />
                    <span className="progress-caption">
                      {w.label}: {w.value} / {w.max ?? 100}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* App Notification Toast */}
          {stageToast && <div className="stage-app-toast">{stageToast}</div>}

          {/* Ask and Wait Bar */}
          {askState && (
            <form
              className="stage-ask-bar"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitAskAnswer(askInput);
                setAskInput('');
              }}
            >
              <div className="ask-question">
                <strong>{askState.spriteName}:</strong> {askState.question}
              </div>
              <div className="ask-row">
                <input
                  type="text"
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  placeholder="Type answer..."
                  autoFocus
                />
                <button type="submit" aria-label="Submit answer">
                  <Send size={14} />
                </button>
              </div>
            </form>
          )}

          {/* Particles FX Canvas */}
          <canvas
            ref={fxCanvasRef}
            className="stage-canvas-layer fx-top"
            width={dim.width}
            height={dim.height}
          />
        </div>
      </div>
    );
  }
);
