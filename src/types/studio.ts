export type StageMode = 'classic' | 'mobile' | 'widescreen';

export const STAGE_DIMENSIONS: Record<StageMode, { width: number; height: number; label: string }> = {
  classic: { width: 480, height: 360, label: '4:3 Classic Stage' },
  mobile: { width: 360, height: 600, label: 'Phone App (9:15)' },
  widescreen: { width: 640, height: 360, label: '16:9 Widescreen' },
};

export type RotationStyle = 'all around' | 'left-right' | "don't rotate";

export interface Costume {
  id: string;
  name: string;
  dataUrl: string;
}

export type SoundPreset =
  | 'jump'
  | 'coin'
  | 'magic'
  | 'cheer'
  | 'laser'
  | 'pop'
  | 'boing'
  | 'powerup'
  | 'win'
  | 'lose'
  | 'click'
  | 'custom';

export interface SoundAsset {
  id: string;
  name: string;
  preset: SoundPreset;
  pitch: number; // 0.5 to 2.0
  speed: number; // 0.5 to 2.0
  waveform?: OscillatorType;
  baseFreq?: number;
  duration?: number;
  customDataUrl?: string;
}

export interface GraphicEffects {
  color: number;
  brightness: number;
  ghost: number;
  fisheye: number;
  whirl: number;
  pixelate: number;
}

export interface SpeechBubble {
  type: 'say' | 'think';
  text: string;
  expiresAt?: number;
}

export interface PenState {
  isDown: boolean;
  color: string;
  size: number;
  hue: number;
}

export interface PhysicsState {
  vx: number;
  vy: number;
  gravity: number;
  bounce: number;
}

export interface SpriteModel {
  id: string;
  name: string;
  x: number;
  y: number;
  size: number;
  direction: number;
  rotationStyle: RotationStyle;
  visible: boolean;
  draggable: boolean;
  layerOrder: number;
  costumes: Costume[];
  currentCostumeIndex: number;
  sounds: SoundAsset[];
  effects: GraphicEffects;
  bubble: SpeechBubble | null;
  pen: PenState;
  physics: PhysicsState;
  workspaceState: Record<string, unknown> | null;
  // Runtime clone metadata
  isClone?: boolean;
  parentId?: string;
}

export type AppWidgetType = 'button' | 'label' | 'input' | 'slider' | 'progress' | 'card';

export interface AppWidget {
  id: string;
  type: AppWidgetType;
  label: string;
  value: string;
  placeholder?: string;
  min?: number;
  max?: number;
  x: number; // Scratch center-origin coordinates
  y: number;
  width: number;
  height: number;
  color: string;
  textColor: string;
  fontSize: number;
  borderRadius: number;
  visible: boolean;
}

export interface VariableModel {
  id: string;
  name: string;
  value: number | string;
  visible: boolean;
  readout: 'normal' | 'large' | 'slider';
  sliderMin: number;
  sliderMax: number;
  x: number;
  y: number;
}

export interface ListModel {
  id: string;
  name: string;
  items: (string | number)[];
  visible: boolean;
  x: number;
  y: number;
}

export interface BackdropModel {
  id: string;
  name: string;
  dataUrl: string;
}

export type ParticleKind = 'stars' | 'confetti' | 'hearts' | 'snow' | 'magic' | 'fire';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  vRot: number;
  kind: ParticleKind;
}

export interface ProjectModel {
  version: string;
  title: string;
  author: string;
  description: string;
  stageMode: StageMode;
  tempo: number;
  volume: number;
  backdrops: BackdropModel[];
  currentBackdropIndex: number;
  sprites: SpriteModel[];
  widgets: AppWidget[];
  variables: VariableModel[];
  lists: ListModel[];
}
