import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Camera, Send } from 'lucide-react';
import type { CameraState, VideoSensingState } from '../engine/vm';
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
    size: number,
    transparency?: number
  ) => void;
  stampSprite: (sprite: SpriteModel) => void;
  clearPen: () => void;
  spawnParticles: (kind: ParticleKind, count: number, x: number, y: number) => void;
  shakeScreen: (intensity: number) => void;
  flashScreen: (color: string) => void;
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
  camera?: CameraState;
  videoSensing?: VideoSensingState;
  virtualPadVisible?: boolean;
  onVirtualPadButton?: (button: string, down: boolean) => void;
  onVideoMetricsUpdate?: (motion: number, direction: number) => void;
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
      camera = { zoom: 100, x: 0, y: 0 },
      videoSensing = { mode: 'off', transparency: 50, motion: 0, direction: 90 },
      virtualPadVisible = false,
      onVirtualPadButton,
      onVideoMetricsUpdate,
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
    const videoElRef = useRef<HTMLVideoElement | null>(null);
    const particlesRef = useRef<Particle[]>([]);
    const shakePowerRef = useRef(0);
    const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 });
    const [flashState, setFlashState] = useState<{ color: string; key: number } | null>(null);
    const [askInput, setAskInput] = useState('');
    const [webcamStatus, setWebcamStatus] = useState<'off' | 'live' | 'sim'>('off');
    const [pressedPadBtns, setPressedPadBtns] = useState<Record<string, boolean>>({});
    const lastSimPointerRef = useRef<{ x: number; y: number; t: number } | null>(null);
    const simMotionDecayRef = useRef(0);

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
      drawPenLine(x1, y1, x2, y2, color, size, transparency = 0) {
        const ctx = penCanvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0.02, Math.min(1, 1 - transparency / 100));
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(hw + x1, hh - y1);
        ctx.lineTo(hw + x2, hh - y2);
        ctx.stroke();
        ctx.restore();
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
      flashScreen(color) {
        setFlashState({ color, key: Date.now() });
      },
    }));

    // Video Sensing webcam stream + motion calculation (with graceful optical-flow simulation fallback)
    useEffect(() => {
      if (videoSensing.mode === 'off') {
        setWebcamStatus('off');
        onVideoMetricsUpdate?.(0, 90);
        return;
      }

      let cancelled = false;
      let stream: MediaStream | null = null;
      let intervalId: number | null = null;

      const startCamera = async () => {
        try {
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('No getUserMedia');
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240 },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          setWebcamStatus('live');
          if (videoElRef.current) {
            videoElRef.current.srcObject = stream;
            await videoElRef.current.play().catch(() => {});
          }

          const sampleCanvas = document.createElement('canvas');
          sampleCanvas.width = 48;
          sampleCanvas.height = 36;
          const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
          let prevFrame: Uint8ClampedArray | null = null;

          intervalId = window.setInterval(() => {
            const vid = videoElRef.current;
            if (!vid || !sCtx || vid.readyState < 2) return;
            sCtx.drawImage(vid, 0, 0, 48, 36);
            const frame = sCtx.getImageData(0, 0, 48, 36).data;
            if (prevFrame) {
              let diffSum = 0;
              let cxSum = 0;
              let cySum = 0;
              let activePx = 0;
              for (let py = 0; py < 36; py++) {
                for (let px = 0; px < 48; px++) {
                  const idx = (py * 48 + px) * 4;
                  const d =
                    Math.abs(frame[idx] - prevFrame[idx]) +
                    Math.abs(frame[idx + 1] - prevFrame[idx + 1]) +
                    Math.abs(frame[idx + 2] - prevFrame[idx + 2]);
                  if (d > 70) {
                    diffSum += d;
                    cxSum += px - 24;
                    cySum += 18 - py;
                    activePx++;
                  }
                }
              }
              const motionScore = Math.min(100, Math.round((diffSum / (48 * 36 * 65)) * 100));
              const dir =
                activePx > 4
                  ? Math.round(90 - (Math.atan2(cySum / activePx, cxSum / activePx) * 180) / Math.PI)
                  : 90;
              onVideoMetricsUpdate?.(motionScore, dir);
            }
            prevFrame = new Uint8ClampedArray(frame);
          }, 90);
        } catch {
          if (!cancelled) {
            setWebcamStatus('sim');
            intervalId = window.setInterval(() => {
              if (simMotionDecayRef.current > 0.5) {
                simMotionDecayRef.current *= 0.82;
                onVideoMetricsUpdate?.(Math.round(simMotionDecayRef.current), 90);
              } else if (simMotionDecayRef.current > 0) {
                simMotionDecayRef.current = 0;
                onVideoMetricsUpdate?.(0, 90);
              }
            }, 90);
          }
        }
      };

      void startCamera();

      return () => {
        cancelled = true;
        if (intervalId !== null) clearInterval(intervalId);
        if (stream) stream.getTracks().forEach((t) => t.stop());
      };
    }, [videoSensing.mode, onVideoMetricsUpdate]);

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

      // Synthetic optical-flow motion sensor when camera hardware is unavailable
      if (webcamStatus === 'sim') {
        const now = performance.now();
        const prev = lastSimPointerRef.current;
        if (prev && now - prev.t > 8) {
          const vx = pt.x - prev.x;
          const vy = pt.y - prev.y;
          const dist = Math.hypot(vx, vy);
          const simMotion = Math.min(100, Math.round(dist * 2.4));
          if (simMotion > 3) {
            simMotionDecayRef.current = Math.max(simMotionDecayRef.current, simMotion);
            const dir = Math.round(90 - (Math.atan2(vy, vx) * 180) / Math.PI);
            onVideoMetricsUpdate?.(simMotionDecayRef.current, dir);
          }
        }
        lastSimPointerRef.current = { x: pt.x, y: pt.y, t: now };
      }

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
    const hasCameraTransform =
      Math.abs(camera.zoom - 100) > 0.5 || Math.abs(camera.x) > 0.5 || Math.abs(camera.y) > 0.5;
    const worldTransform = hasCameraTransform
      ? `scale(${camera.zoom / 100}) translate(${-camera.x}px, ${camera.y}px)`
      : undefined;

    const setPadBtnState = (btn: string, isDown: boolean) => {
      setPressedPadBtns((prev) =>
        Boolean(prev[btn]) === isDown ? prev : { ...prev, [btn]: isDown }
      );
      onVirtualPadButton?.(btn, isDown);
    };

    const bindPadBtn = (btn: string) => ({
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        setPadBtnState(btn, true);
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // ignore
        }
        setPadBtnState(btn, false);
      },
      onPointerCancel: () => {
        setPadBtnState(btn, false);
      },
      onLostPointerCapture: () => {
        setPadBtnState(btn, false);
      },
    });

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

          {/* Camera-Transformable Stage World */}
          <div
            className="stage-world-container"
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              inset: 0,
              transform: worldTransform,
              transformOrigin: 'center center',
              transition: 'transform 140ms ease-out',
            }}
          >
            {/* Backdrop */}
            {backdrop && (
              <img
                className="stage-backdrop-img"
                src={backdrop.dataUrl}
                alt={backdrop.name}
                draggable={false}
              />
            )}

            {/* Video Sensing Layer */}
            {videoSensing.mode !== 'off' && (
              <div
                className={`stage-video-layer ${webcamStatus === 'sim' ? 'video-sim-wave' : ''}`}
                style={{
                  opacity: Math.max(0.05, Math.min(1, 1 - videoSensing.transparency / 100)),
                }}
              >
                {webcamStatus === 'live' && (
                  <video
                    ref={videoElRef}
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: videoSensing.mode === 'on-flipped' ? 'scaleX(-1)' : undefined,
                    }}
                  />
                )}
              </div>
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
          </div>

          {/* Video Sensing HUD Badge */}
          {videoSensing.mode !== 'off' && (
            <div className="stage-video-badge">
              <Camera size={12} />
              <span>
                {webcamStatus === 'live' ? 'Webcam Live' : 'Motion Sensor Sim (Wave Mouse)'} ·{' '}
                <strong>{videoSensing.motion}</strong>
              </span>
            </div>
          )}

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

          {/* On-Stage Arcade Pad Overlay (Gamepad Extension) */}
          {virtualPadVisible && (
            <div className="stage-arcade-pad" aria-label="On-stage arcade controller">
              <div className="arcade-dpad">
                <button
                  type="button"
                  className={`dpad-btn up ${pressedPadBtns.up ? 'is-pressed' : ''}`}
                  title="D-Pad Up (ArrowUp / W)"
                  {...bindPadBtn('up')}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className={`dpad-btn left ${pressedPadBtns.left ? 'is-pressed' : ''}`}
                  title="D-Pad Left (ArrowLeft / A)"
                  {...bindPadBtn('left')}
                >
                  ◀
                </button>
                <div className="dpad-center" />
                <button
                  type="button"
                  className={`dpad-btn right ${pressedPadBtns.right ? 'is-pressed' : ''}`}
                  title="D-Pad Right (ArrowRight / D)"
                  {...bindPadBtn('right')}
                >
                  ▶
                </button>
                <button
                  type="button"
                  className={`dpad-btn down ${pressedPadBtns.down ? 'is-pressed' : ''}`}
                  title="D-Pad Down (ArrowDown / S)"
                  {...bindPadBtn('down')}
                >
                  ▼
                </button>
              </div>
              <div className="arcade-ab">
                <button
                  type="button"
                  className={`ab-btn btn-b ${pressedPadBtns.B ? 'is-pressed' : ''}`}
                  title="Arcade B Button (X / Shift)"
                  {...bindPadBtn('B')}
                >
                  B
                </button>
                <button
                  type="button"
                  className={`ab-btn btn-a ${pressedPadBtns.A ? 'is-pressed' : ''}`}
                  title="Arcade A Button (Space / Z)"
                  {...bindPadBtn('A')}
                >
                  A
                </button>
              </div>
            </div>
          )}

          {/* Screen Flash Overlay */}
          {flashState && (
            <div
              key={flashState.key}
              className="stage-flash-overlay"
              style={{ background: flashState.color }}
              onAnimationEnd={() => setFlashState(null)}
            />
          )}

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
