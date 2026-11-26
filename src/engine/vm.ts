import { type BlocklyBlockNode, getInputBlock, getTopBlocks } from '../blockly/astTypes';
import { BUILTIN_SOUNDS } from '../data/assets';
import { audioEngine } from './audio';
import {
  type AppWidget,
  type ParticleKind,
  STAGE_DIMENSIONS,
  type SpriteModel,
  type StageMode,
  type VariableModel,
} from '../types/studio';

export interface VMCallbacks {
  onStateChange: () => void;
  onPenLine: (x1: number, y1: number, x2: number, y2: number, color: string, size: number) => void;
  onPenStamp: (sprite: SpriteModel) => void;
  onPenClear: () => void;
  onSpawnParticles: (kind: ParticleKind, count: number, x: number, y: number) => void;
  onScreenShake: (intensity: number) => void;
  onToast: (message: string) => void;
  onAskPrompt: (question: string, spriteName: string) => Promise<string>;
  onSwitchBackdrop: (nameOrNext: string, isNext: boolean) => void;
}

interface ThreadHandle {
  id: string;
  spriteId: string;
  epoch: number;
  alive: boolean;
}

function hslToHex(h: number, s = 85, l = 55): string {
  const hue = ((h % 360) + 360) % 360;
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const color = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export class ScratchAppVM {
  public sprites: SpriteModel[] = [];
  public clones: SpriteModel[] = [];
  public widgets: AppWidget[] = [];
  public variables: VariableModel[] = [];
  public stageMode: StageMode = 'classic';
  public tempo = 120;
  public turboMode = false;
  public isRunning = false;

  // Live sensing state
  public pressedKeys = new Set<string>();
  public mouseX = 0;
  public mouseY = 0;
  public mouseDown = false;
  public answer = '';
  private timerStart = performance.now();

  private epoch = 0;
  private threads = new Map<string, ThreadHandle>();
  private frameResolvers: (() => void)[] = [];
  private rafId: number | null = null;
  private callbacks: VMCallbacks;

  constructor(callbacks: VMCallbacks) {
    this.callbacks = callbacks;
    this.startLoop();
  }

  private startLoop(): void {
    const tick = () => {
      const now = performance.now();
      // Expire speech bubbles
      let changed = false;
      for (const sp of this.getAllSprites()) {
        if (sp.bubble?.expiresAt && now >= sp.bubble.expiresAt) {
          sp.bubble = null;
          changed = true;
        }
      }
      if (this.frameResolvers.length > 0) {
        const pending = this.frameResolvers.splice(0, this.frameResolvers.length);
        for (const resolve of pending) resolve();
        changed = true;
      }
      // Clean finished threads
      if (this.isRunning && this.threads.size === 0) {
        this.isRunning = false;
        changed = true;
      }
      if (changed) {
        this.callbacks.onStateChange();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  destroy(): void {
    this.stopAll();
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  get stageHalfSize(): { hw: number; hh: number } {
    const dim = STAGE_DIMENSIONS[this.stageMode];
    return { hw: dim.width / 2, hh: dim.height / 2 };
  }

  get activeThreadCount(): number {
    return this.threads.size;
  }

  getAllSprites(): SpriteModel[] {
    return [...this.sprites, ...this.clones];
  }

  syncProjectState(
    sprites: SpriteModel[],
    widgets: AppWidget[],
    variables: VariableModel[],
    stageMode: StageMode,
    tempo: number
  ): void {
    this.sprites = sprites;
    this.widgets = widgets;
    this.variables = variables;
    this.stageMode = stageMode;
    this.tempo = tempo;
  }

  resetTimer(): void {
    this.timerStart = performance.now();
  }

  getTimerSeconds(): number {
    return Math.round(((performance.now() - this.timerStart) / 1000) * 100) / 100;
  }

  stopAll(): void {
    this.epoch++;
    for (const t of this.threads.values()) {
      t.alive = false;
    }
    this.threads.clear();
    this.clones = [];
    for (const sp of this.sprites) {
      sp.bubble = null;
    }
    this.isRunning = false;
    audioEngine.stopAll();
    this.callbacks.onStateChange();
  }

  private waitNextFrame(thread: ThreadHandle): Promise<void> {
    if (!thread.alive || thread.epoch !== this.epoch) return Promise.resolve();
    return new Promise((resolve) => {
      this.frameResolvers.push(resolve);
    });
  }

  private waitSeconds(secs: number, thread: ThreadHandle): Promise<void> {
    const ms = Math.max(0, secs * 1000);
    if (ms === 0) return this.waitNextFrame(thread);
    const end = performance.now() + ms;
    return new Promise((resolve) => {
      const check = () => {
        if (!thread.alive || thread.epoch !== this.epoch || performance.now() >= end) {
          resolve();
        } else {
          this.frameResolvers.push(check);
        }
      };
      this.frameResolvers.push(check);
    });
  }

  triggerGreenFlag(): void {
    this.stopAll();
    this.resetTimer();
    this.isRunning = true;
    for (const sp of this.sprites) {
      const tops = getTopBlocks(sp.workspaceState);
      for (const top of tops) {
        if (top.type === 'event_whenflagclicked' && top.next?.block) {
          this.spawnThread(sp, top.next.block);
        }
      }
    }
    this.callbacks.onStateChange();
  }

  triggerKeyPressed(key: string): void {
    for (const sp of this.getAllSprites()) {
      const tops = getTopBlocks(sp.workspaceState);
      for (const top of tops) {
        if (top.type === 'event_whenkeypressed' && top.next?.block) {
          const wanted = String(top.fields?.KEY ?? ' ');
          if (wanted === 'any' || wanted.toLowerCase() === key.toLowerCase() || wanted === key) {
            this.isRunning = true;
            this.spawnThread(sp, top.next.block);
          }
        }
      }
    }
  }

  triggerSpriteClicked(spriteId: string): void {
    const target = this.getAllSprites().find((s) => s.id === spriteId);
    if (!target || !target.visible) return;
    const tops = getTopBlocks(target.workspaceState);
    for (const top of tops) {
      if (top.type === 'event_whenthisspriteclicked' && top.next?.block) {
        this.isRunning = true;
        this.spawnThread(target, top.next.block);
      }
    }
  }

  triggerWidgetClicked(widgetId: string): void {
    audioEngine.playPreset('click', 1, 1);
    for (const sp of this.getAllSprites()) {
      const tops = getTopBlocks(sp.workspaceState);
      for (const top of tops) {
        if (top.type === 'appui_when_clicked' && top.next?.block) {
          const wanted = String(top.fields?.WIDGET ?? '');
          if (wanted === widgetId) {
            this.isRunning = true;
            this.spawnThread(sp, top.next.block);
          }
        }
      }
    }
  }

  async triggerBroadcast(message: string, wait: boolean): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const sp of this.getAllSprites()) {
      const tops = getTopBlocks(sp.workspaceState);
      for (const top of tops) {
        if (top.type === 'event_whenbroadcastreceived' && top.next?.block) {
          if (String(top.fields?.MESSAGE ?? '') === message) {
            this.isRunning = true;
            promises.push(this.spawnThread(sp, top.next.block));
          }
        }
      }
    }
    if (wait && promises.length > 0) {
      await Promise.all(promises);
    }
  }

  runBlockStackPreview(sprite: SpriteModel, startBlock: BlocklyBlockNode): void {
    this.isRunning = true;
    const first = startBlock.type.startsWith('event_') || startBlock.type === 'control_start_as_clone' || startBlock.type === 'appui_when_clicked'
      ? startBlock.next?.block
      : startBlock;
    if (first) {
      void this.spawnThread(sprite, first);
    }
  }

  private spawnThread(sprite: SpriteModel, firstBlock: BlocklyBlockNode): Promise<void> {
    const id = `th_${Math.random().toString(36).slice(2, 10)}`;
    const handle: ThreadHandle = {
      id,
      spriteId: sprite.id,
      epoch: this.epoch,
      alive: true,
    };
    this.threads.set(id, handle);
    this.callbacks.onStateChange();

    return this.executeStack(sprite, firstBlock, handle)
      .catch((err) => {
        console.warn('Script error:', err);
      })
      .finally(() => {
        handle.alive = false;
        this.threads.delete(id);
        this.callbacks.onStateChange();
      });
  }

  private moveSpriteTo(sprite: SpriteModel, nx: number, ny: number): void {
    const { hw, hh } = this.stageHalfSize;
    const clampedX = Math.max(-hw - 40, Math.min(hw + 40, nx));
    const clampedY = Math.max(-hh - 40, Math.min(hh + 40, ny));
    if (sprite.pen.isDown) {
      this.callbacks.onPenLine(
        sprite.x,
        sprite.y,
        clampedX,
        clampedY,
        sprite.pen.color,
        sprite.pen.size
      );
    }
    sprite.x = clampedX;
    sprite.y = clampedY;
  }

  private evalValue(sprite: SpriteModel, node: BlocklyBlockNode | undefined): string | number | boolean {
    if (!node) return 0;
    const f = node.fields ?? {};

    switch (node.type) {
      case 'math_number_scratch':
        return Number(f.NUM ?? 0);
      case 'text_scratch':
        return String(f.TEXT ?? '');
      case 'motion_xposition':
        return Math.round(sprite.x * 10) / 10;
      case 'motion_yposition':
        return Math.round(sprite.y * 10) / 10;
      case 'motion_direction':
        return Math.round(sprite.direction);
      case 'looks_size':
        return Math.round(sprite.size);
      case 'looks_costumename':
        return sprite.costumes[sprite.currentCostumeIndex]?.name ?? '';
      case 'sensing_touchingobject': {
        const target = String(f.TOUCHINGOBJECTMENU ?? '_mouse_');
        return this.checkTouching(sprite, target);
      }
      case 'sensing_keypressed': {
        const k = String(f.KEY_OPTION ?? ' ');
        if (k === 'any') return this.pressedKeys.size > 0;
        return this.pressedKeys.has(k) || this.pressedKeys.has(k.toLowerCase());
      }
      case 'sensing_mousedown':
        return this.mouseDown;
      case 'sensing_mousex':
        return Math.round(this.mouseX);
      case 'sensing_mousey':
        return Math.round(this.mouseY);
      case 'sensing_distanceto': {
        const target = String(f.DISTANCETOMENU ?? '_mouse_');
        if (target === '_mouse_') {
          return Math.round(Math.hypot(this.mouseX - sprite.x, this.mouseY - sprite.y));
        }
        const other = this.sprites.find((s) => s.name === target || s.id === target);
        if (!other) return 9999;
        return Math.round(Math.hypot(other.x - sprite.x, other.y - sprite.y));
      }
      case 'sensing_answer':
        return this.answer;
      case 'sensing_timer':
        return this.getTimerSeconds();
      case 'data_variable': {
        const vName = String(f.VARIABLE ?? 'score');
        const v = this.variables.find((item) => item.name === vName || item.id === vName);
        return v ? v.value : 0;
      }
      case 'appui_get_value': {
        const wId = String(f.WIDGET ?? '');
        const w = this.widgets.find((item) => item.id === wId || item.label === wId);
        if (!w) return '';
        const asNum = Number(w.value);
        return w.value !== '' && !Number.isNaN(asNum) ? asNum : w.value;
      }
      case 'operator_add':
        return Number(this.evalValue(sprite, getInputBlock(node, 'NUM1'))) + Number(this.evalValue(sprite, getInputBlock(node, 'NUM2')));
      case 'operator_subtract':
        return Number(this.evalValue(sprite, getInputBlock(node, 'NUM1'))) - Number(this.evalValue(sprite, getInputBlock(node, 'NUM2')));
      case 'operator_multiply':
        return Number(this.evalValue(sprite, getInputBlock(node, 'NUM1'))) * Number(this.evalValue(sprite, getInputBlock(node, 'NUM2')));
      case 'operator_divide': {
        const denom = Number(this.evalValue(sprite, getInputBlock(node, 'NUM2')));
        return denom === 0 ? 0 : Number(this.evalValue(sprite, getInputBlock(node, 'NUM1'))) / denom;
      }
      case 'operator_mod': {
        const denom = Number(this.evalValue(sprite, getInputBlock(node, 'NUM2')));
        return denom === 0 ? 0 : Number(this.evalValue(sprite, getInputBlock(node, 'NUM1'))) % denom;
      }
      case 'operator_random': {
        const a = Number(this.evalValue(sprite, getInputBlock(node, 'FROM')));
        const b = Number(this.evalValue(sprite, getInputBlock(node, 'TO')));
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        if (Number.isInteger(min) && Number.isInteger(max)) {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        return min + Math.random() * (max - min);
      }
      case 'operator_gt': {
        const a = this.evalValue(sprite, getInputBlock(node, 'OPERAND1'));
        const b = this.evalValue(sprite, getInputBlock(node, 'OPERAND2'));
        return Number(a) > Number(b);
      }
      case 'operator_lt': {
        const a = this.evalValue(sprite, getInputBlock(node, 'OPERAND1'));
        const b = this.evalValue(sprite, getInputBlock(node, 'OPERAND2'));
        return Number(a) < Number(b);
      }
      case 'operator_equals': {
        const a = this.evalValue(sprite, getInputBlock(node, 'OPERAND1'));
        const b = this.evalValue(sprite, getInputBlock(node, 'OPERAND2'));
        return String(a).toLowerCase() === String(b).toLowerCase() || Number(a) === Number(b);
      }
      case 'operator_and':
        return Boolean(this.evalValue(sprite, getInputBlock(node, 'OPERAND1'))) && Boolean(this.evalValue(sprite, getInputBlock(node, 'OPERAND2')));
      case 'operator_or':
        return Boolean(this.evalValue(sprite, getInputBlock(node, 'OPERAND1'))) || Boolean(this.evalValue(sprite, getInputBlock(node, 'OPERAND2')));
      case 'operator_not':
        return !this.evalValue(sprite, getInputBlock(node, 'OPERAND'));
      case 'operator_join':
        return String(this.evalValue(sprite, getInputBlock(node, 'STRING1'))) + String(this.evalValue(sprite, getInputBlock(node, 'STRING2')));
      case 'operator_round':
        return Math.round(Number(this.evalValue(sprite, getInputBlock(node, 'NUM'))));
      case 'operator_mathop': {
        const n = Number(this.evalValue(sprite, getInputBlock(node, 'NUM')));
        const op = String(f.OPERATOR ?? 'abs');
        switch (op) {
          case 'abs':
            return Math.abs(n);
          case 'floor':
            return Math.floor(n);
          case 'ceiling':
            return Math.ceil(n);
          case 'sqrt':
            return n >= 0 ? Math.sqrt(n) : 0;
          case 'sin':
            return Math.sin((n * Math.PI) / 180);
          case 'cos':
            return Math.cos((n * Math.PI) / 180);
          default:
            return n;
        }
      }
      default:
        return 0;
    }
  }

  private getSpriteHitRadius(sp: SpriteModel): number {
    // Visual width on stage is roughly (size / 100) * 110 px for 512px sprites or ~75px for SVG sprites
    const isLargeSheet = sp.costumes[sp.currentCostumeIndex]?.dataUrl.startsWith('/sprites/');
    const basePx = isLargeSheet ? 220 : 95;
    return Math.max(14, ((sp.size / 100) * basePx) * 0.36);
  }

  private checkTouching(sprite: SpriteModel, target: string): boolean {
    if (!sprite.visible) return false;
    const r1 = this.getSpriteHitRadius(sprite);
    const { hw, hh } = this.stageHalfSize;

    if (target === '_mouse_') {
      return Math.hypot(this.mouseX - sprite.x, this.mouseY - sprite.y) <= r1;
    }
    if (target === '_edge_') {
      return (
        sprite.x - r1 <= -hw ||
        sprite.x + r1 >= hw ||
        sprite.y - r1 <= -hh ||
        sprite.y + r1 >= hh
      );
    }

    const candidates = this.getAllSprites().filter(
      (s) => s.id !== sprite.id && s.visible && (s.name === target || s.id === target || s.parentId === target)
    );
    for (const other of candidates) {
      const r2 = this.getSpriteHitRadius(other);
      if (Math.hypot(other.x - sprite.x, other.y - sprite.y) <= r1 + r2) {
        return true;
      }
    }
    return false;
  }

  private async executeStack(
    sprite: SpriteModel,
    first: BlocklyBlockNode | undefined,
    thread: ThreadHandle
  ): Promise<void> {
    let cur = first;
    let opsSinceYield = 0;

    while (cur && thread.alive && thread.epoch === this.epoch) {
      const f = cur.fields ?? {};

      switch (cur.type) {
        // ---- MOTION ----
        case 'motion_movesteps': {
          const steps = Number(this.evalValue(sprite, getInputBlock(cur, 'STEPS')));
          const rad = ((90 - sprite.direction) * Math.PI) / 180;
          this.moveSpriteTo(sprite, sprite.x + Math.cos(rad) * steps, sprite.y + Math.sin(rad) * steps);
          break;
        }
        case 'motion_turnright': {
          const deg = Number(this.evalValue(sprite, getInputBlock(cur, 'DEGREES')));
          sprite.direction = ((((sprite.direction + deg + 180) % 360) + 360) % 360) - 180;
          break;
        }
        case 'motion_turnleft': {
          const deg = Number(this.evalValue(sprite, getInputBlock(cur, 'DEGREES')));
          sprite.direction = ((((sprite.direction - deg + 180) % 360) + 360) % 360) - 180;
          break;
        }
        case 'motion_gotoxy': {
          const x = Number(this.evalValue(sprite, getInputBlock(cur, 'X')));
          const y = Number(this.evalValue(sprite, getInputBlock(cur, 'Y')));
          this.moveSpriteTo(sprite, x, y);
          break;
        }
        case 'motion_goto': {
          const to = String(f.TO ?? '_random_');
          const { hw, hh } = this.stageHalfSize;
          if (to === '_random_') {
            this.moveSpriteTo(
              sprite,
              Math.round((Math.random() * 2 - 1) * (hw - 32)),
              Math.round((Math.random() * 2 - 1) * (hh - 32))
            );
          } else if (to === '_mouse_') {
            this.moveSpriteTo(sprite, this.mouseX, this.mouseY);
          } else {
            const other = this.sprites.find((s) => s.name === to || s.id === to);
            if (other) this.moveSpriteTo(sprite, other.x, other.y);
          }
          break;
        }
        case 'motion_glidesecstoxy': {
          const secs = Math.max(0.02, Number(this.evalValue(sprite, getInputBlock(cur, 'SECS'))));
          const tx = Number(this.evalValue(sprite, getInputBlock(cur, 'X')));
          const ty = Number(this.evalValue(sprite, getInputBlock(cur, 'Y')));
          const sx = sprite.x;
          const sy = sprite.y;
          const start = performance.now();
          const durMs = secs * 1000;
          while (thread.alive && thread.epoch === this.epoch) {
            const t = Math.min(1, (performance.now() - start) / durMs);
            this.moveSpriteTo(sprite, sx + (tx - sx) * t, sy + (ty - sy) * t);
            if (t >= 1) break;
            await this.waitNextFrame(thread);
          }
          break;
        }
        case 'motion_pointindirection':
          sprite.direction = Number(f.DIRECTION ?? 90);
          break;
        case 'motion_pointtowards': {
          const to = String(f.TOWARDS ?? '_mouse_');
          let tx = this.mouseX;
          let ty = this.mouseY;
          if (to !== '_mouse_') {
            const other = this.sprites.find((s) => s.name === to || s.id === to);
            if (other) {
              tx = other.x;
              ty = other.y;
            }
          }
          const angleRad = Math.atan2(ty - sprite.y, tx - sprite.x);
          sprite.direction = Math.round(90 - (angleRad * 180) / Math.PI);
          break;
        }
        case 'motion_changexby':
          this.moveSpriteTo(sprite, sprite.x + Number(this.evalValue(sprite, getInputBlock(cur, 'DX'))), sprite.y);
          break;
        case 'motion_setx':
          this.moveSpriteTo(sprite, Number(this.evalValue(sprite, getInputBlock(cur, 'X'))), sprite.y);
          break;
        case 'motion_changeyby':
          this.moveSpriteTo(sprite, sprite.x, sprite.y + Number(this.evalValue(sprite, getInputBlock(cur, 'DY'))));
          break;
        case 'motion_sety':
          this.moveSpriteTo(sprite, sprite.x, Number(this.evalValue(sprite, getInputBlock(cur, 'Y'))));
          break;
        case 'motion_ifonedgebounce': {
          const { hw, hh } = this.stageHalfSize;
          const r = Math.min(36, this.getSpriteHitRadius(sprite));
          if (sprite.x - r < -hw) {
            sprite.x = -hw + r;
            sprite.direction = -sprite.direction;
          } else if (sprite.x + r > hw) {
            sprite.x = hw - r;
            sprite.direction = -sprite.direction;
          }
          if (sprite.y - r < -hh) {
            sprite.y = -hh + r;
            sprite.direction = 180 - sprite.direction;
          } else if (sprite.y + r > hh) {
            sprite.y = hh - r;
            sprite.direction = 180 - sprite.direction;
          }
          break;
        }
        case 'motion_setrotationstyle':
          sprite.rotationStyle = (f.STYLE as SpriteModel['rotationStyle']) ?? 'all around';
          break;

        // ---- LOOKS ----
        case 'looks_sayforsecs': {
          const msg = String(this.evalValue(sprite, getInputBlock(cur, 'MESSAGE')));
          const secs = Number(this.evalValue(sprite, getInputBlock(cur, 'SECS')));
          sprite.bubble = { type: 'say', text: msg, expiresAt: performance.now() + secs * 1000 };
          this.callbacks.onStateChange();
          await this.waitSeconds(secs, thread);
          if (sprite.bubble?.text === msg) sprite.bubble = null;
          break;
        }
        case 'looks_say': {
          const msg = String(this.evalValue(sprite, getInputBlock(cur, 'MESSAGE')));
          sprite.bubble = msg ? { type: 'say', text: msg } : null;
          break;
        }
        case 'looks_thinkforsecs': {
          const msg = String(this.evalValue(sprite, getInputBlock(cur, 'MESSAGE')));
          const secs = Number(this.evalValue(sprite, getInputBlock(cur, 'SECS')));
          sprite.bubble = { type: 'think', text: msg, expiresAt: performance.now() + secs * 1000 };
          this.callbacks.onStateChange();
          await this.waitSeconds(secs, thread);
          if (sprite.bubble?.text === msg) sprite.bubble = null;
          break;
        }
        case 'looks_switchcostumeto': {
          const wanted = String(f.COSTUME ?? '');
          const idx = sprite.costumes.findIndex((c) => c.name === wanted || c.id === wanted);
          if (idx >= 0) sprite.currentCostumeIndex = idx;
          break;
        }
        case 'looks_nextcostume':
          if (sprite.costumes.length > 0) {
            sprite.currentCostumeIndex = (sprite.currentCostumeIndex + 1) % sprite.costumes.length;
          }
          break;
        case 'looks_switchbackdropto':
          this.callbacks.onSwitchBackdrop(String(f.BACKDROP ?? ''), false);
          break;
        case 'looks_nextbackdrop':
          this.callbacks.onSwitchBackdrop('', true);
          break;
        case 'looks_changesizeby':
          sprite.size = Math.max(5, Math.min(400, sprite.size + Number(this.evalValue(sprite, getInputBlock(cur, 'CHANGE')))));
          break;
        case 'looks_setsizeto':
          sprite.size = Math.max(5, Math.min(400, Number(this.evalValue(sprite, getInputBlock(cur, 'SIZE')))));
          break;
        case 'looks_changeeffectby': {
          const eff = String(f.EFFECT ?? 'color') as keyof SpriteModel['effects'];
          const delta = Number(this.evalValue(sprite, getInputBlock(cur, 'CHANGE')));
          if (eff in sprite.effects) sprite.effects[eff] += delta;
          break;
        }
        case 'looks_seteffectto': {
          const eff = String(f.EFFECT ?? 'color') as keyof SpriteModel['effects'];
          const val = Number(this.evalValue(sprite, getInputBlock(cur, 'VALUE')));
          if (eff in sprite.effects) sprite.effects[eff] = val;
          break;
        }
        case 'looks_cleargraphiceffects':
          sprite.effects = { color: 0, brightness: 0, ghost: 0, fisheye: 0, whirl: 0, pixelate: 0 };
          break;
        case 'looks_show':
          sprite.visible = true;
          break;
        case 'looks_hide':
          sprite.visible = false;
          break;

        // ---- SOUND ----
        case 'sound_play':
        case 'sound_playuntildone': {
          const sndKey = String(f.SOUND ?? 'magic');
          const asset =
            sprite.sounds.find((s) => s.name === sndKey || s.id === sndKey || s.preset === sndKey) ??
            BUILTIN_SOUNDS.find((s) => s.name === sndKey || s.id === sndKey || s.preset === sndKey) ??
            BUILTIN_SOUNDS[0];
          const p = audioEngine.playAsset(asset);
          if (cur.type === 'sound_playuntildone') {
            await p;
          }
          break;
        }
        case 'sound_playnote': {
          const note = Number(f.NOTE ?? 60);
          const beats = Number(this.evalValue(sprite, getInputBlock(cur, 'BEATS')));
          await audioEngine.playMidiNote(note, beats, this.tempo);
          break;
        }
        case 'sound_speak': {
          const text = String(this.evalValue(sprite, getInputBlock(cur, 'TEXT')));
          sprite.bubble = { type: 'say', text, expiresAt: performance.now() + 2200 };
          this.callbacks.onStateChange();
          await audioEngine.speak(text);
          break;
        }
        case 'sound_setvolumeto':
          audioEngine.setVolume(Number(this.evalValue(sprite, getInputBlock(cur, 'VOLUME'))));
          break;
        case 'sound_stopallsounds':
          audioEngine.stopAll();
          break;

        // ---- EVENTS ----
        case 'event_broadcast':
          void this.triggerBroadcast(String(f.MESSAGE ?? 'message1'), false);
          break;
        case 'event_broadcastandwait':
          await this.triggerBroadcast(String(f.MESSAGE ?? 'message1'), true);
          break;

        // ---- CONTROL ----
        case 'control_wait': {
          const d = Number(this.evalValue(sprite, getInputBlock(cur, 'DURATION')));
          await this.waitSeconds(d, thread);
          break;
        }
        case 'control_repeat': {
          const times = Math.max(0, Math.floor(Number(this.evalValue(sprite, getInputBlock(cur, 'TIMES')))));
          const substack = getInputBlock(cur, 'SUBSTACK');
          for (let i = 0; i < times && thread.alive && thread.epoch === this.epoch; i++) {
            if (substack) await this.executeStack(sprite, substack, thread);
            if (!this.turboMode || i % 12 === 11) {
              await this.waitNextFrame(thread);
            }
          }
          break;
        }
        case 'control_forever': {
          const substack = getInputBlock(cur, 'SUBSTACK');
          let iter = 0;
          while (thread.alive && thread.epoch === this.epoch) {
            if (substack) await this.executeStack(sprite, substack, thread);
            iter++;
            if (!this.turboMode || iter % 12 === 0) {
              await this.waitNextFrame(thread);
            }
          }
          return;
        }
        case 'control_if': {
          if (Boolean(this.evalValue(sprite, getInputBlock(cur, 'CONDITION')))) {
            const substack = getInputBlock(cur, 'SUBSTACK');
            if (substack) await this.executeStack(sprite, substack, thread);
          }
          break;
        }
        case 'control_if_else': {
          if (Boolean(this.evalValue(sprite, getInputBlock(cur, 'CONDITION')))) {
            const s1 = getInputBlock(cur, 'SUBSTACK');
            if (s1) await this.executeStack(sprite, s1, thread);
          } else {
            const s2 = getInputBlock(cur, 'SUBSTACK2');
            if (s2) await this.executeStack(sprite, s2, thread);
          }
          break;
        }
        case 'control_wait_until': {
          while (
            thread.alive &&
            thread.epoch === this.epoch &&
            !Boolean(this.evalValue(sprite, getInputBlock(cur, 'CONDITION')))
          ) {
            await this.waitNextFrame(thread);
          }
          break;
        }
        case 'control_repeat_until': {
          const substack = getInputBlock(cur, 'SUBSTACK');
          while (
            thread.alive &&
            thread.epoch === this.epoch &&
            !Boolean(this.evalValue(sprite, getInputBlock(cur, 'CONDITION')))
          ) {
            if (substack) await this.executeStack(sprite, substack, thread);
            await this.waitNextFrame(thread);
          }
          break;
        }
        case 'control_stop': {
          const opt = String(f.STOP_OPTION ?? 'all');
          if (opt === 'all') {
            this.stopAll();
          } else {
            thread.alive = false;
          }
          return;
        }
        case 'control_create_clone_of': {
          if (this.clones.length < 120) {
            const opt = String(f.CLONE_OPTION ?? '_myself_');
            const source =
              opt === '_myself_'
                ? sprite
                : this.sprites.find((s) => s.name === opt || s.id === opt) ?? sprite;
            const clone: SpriteModel = {
              ...source,
              id: `clone_${Math.random().toString(36).slice(2, 9)}`,
              isClone: true,
              parentId: source.parentId ?? source.id,
              effects: { ...source.effects },
              pen: { ...source.pen },
              physics: { ...source.physics },
              bubble: null,
            };
            this.clones.push(clone);
            const tops = getTopBlocks(clone.workspaceState);
            for (const top of tops) {
              if (top.type === 'control_start_as_clone' && top.next?.block) {
                void this.spawnThread(clone, top.next.block);
              }
            }
          }
          break;
        }
        case 'control_delete_this_clone': {
          if (sprite.isClone) {
            this.clones = this.clones.filter((c) => c.id !== sprite.id);
            thread.alive = false;
            return;
          }
          break;
        }

        // ---- SENSING ----
        case 'sensing_askandwait': {
          const q = String(this.evalValue(sprite, getInputBlock(cur, 'QUESTION')));
          const ans = await this.callbacks.onAskPrompt(q, sprite.name);
          this.answer = ans;
          break;
        }
        case 'sensing_resettimer':
          this.resetTimer();
          break;

        // ---- VARIABLES ----
        case 'data_setvariableto': {
          const vName = String(f.VARIABLE ?? 'score');
          const val = this.evalValue(sprite, getInputBlock(cur, 'VALUE'));
          const v = this.variables.find((item) => item.name === vName || item.id === vName);
          if (v) v.value = typeof val === 'boolean' ? String(val) : val;
          break;
        }
        case 'data_changevariableby': {
          const vName = String(f.VARIABLE ?? 'score');
          const delta = Number(this.evalValue(sprite, getInputBlock(cur, 'VALUE')));
          const v = this.variables.find((item) => item.name === vName || item.id === vName);
          if (v) v.value = Math.round((Number(v.value || 0) + delta) * 1000) / 1000;
          break;
        }
        case 'data_showvariable': {
          const vName = String(f.VARIABLE ?? 'score');
          const v = this.variables.find((item) => item.name === vName || item.id === vName);
          if (v) v.visible = true;
          break;
        }
        case 'data_hidevariable': {
          const vName = String(f.VARIABLE ?? 'score');
          const v = this.variables.find((item) => item.name === vName || item.id === vName);
          if (v) v.visible = false;
          break;
        }

        // ---- PEN ----
        case 'pen_clear':
          this.callbacks.onPenClear();
          break;
        case 'pen_stamp':
          this.callbacks.onPenStamp(sprite);
          break;
        case 'pen_pendown':
          sprite.pen.isDown = true;
          break;
        case 'pen_penup':
          sprite.pen.isDown = false;
          break;
        case 'pen_setpencolorto':
          sprite.pen.color = String(f.COLOR ?? '#7C3AED');
          break;
        case 'pen_changepenhueby': {
          const dh = Number(this.evalValue(sprite, getInputBlock(cur, 'HUE')));
          sprite.pen.hue = (sprite.pen.hue + dh) % 360;
          sprite.pen.color = hslToHex(sprite.pen.hue);
          break;
        }
        case 'pen_setpensizeto':
          sprite.pen.size = Math.max(1, Math.min(80, Number(this.evalValue(sprite, getInputBlock(cur, 'SIZE')))));
          break;

        // ---- APP UI MAKER ----
        case 'appui_set_text': {
          const wId = String(f.WIDGET ?? '');
          const txt = String(this.evalValue(sprite, getInputBlock(cur, 'TEXT')));
          const w = this.widgets.find((item) => item.id === wId || item.label === wId);
          if (w) w.label = txt;
          break;
        }
        case 'appui_set_value': {
          const wId = String(f.WIDGET ?? '');
          const val = String(this.evalValue(sprite, getInputBlock(cur, 'VALUE')));
          const w = this.widgets.find((item) => item.id === wId || item.label === wId);
          if (w) w.value = val;
          break;
        }
        case 'appui_set_visible': {
          const wId = String(f.WIDGET ?? '');
          const vis = f.VISIBILITY !== 'hide';
          const w = this.widgets.find((item) => item.id === wId || item.label === wId);
          if (w) w.visible = vis;
          break;
        }
        case 'appui_create_button': {
          const id = String(f.ID ?? 'my_btn');
          const lbl = String(this.evalValue(sprite, getInputBlock(cur, 'LABEL')));
          const bx = Number(this.evalValue(sprite, getInputBlock(cur, 'X')));
          const by = Number(this.evalValue(sprite, getInputBlock(cur, 'Y')));
          const existing = this.widgets.find((item) => item.id === id);
          if (existing) {
            existing.label = lbl;
            existing.x = bx;
            existing.y = by;
            existing.visible = true;
          } else {
            this.widgets.push({
              id,
              type: 'button',
              label: lbl,
              value: '',
              x: bx,
              y: by,
              width: 132,
              height: 38,
              color: '#7C3AED',
              textColor: '#FFFFFF',
              fontSize: 13,
              borderRadius: 12,
              visible: true,
            });
          }
          break;
        }
        case 'appui_toast': {
          const msg = String(this.evalValue(sprite, getInputBlock(cur, 'MESSAGE')));
          this.callbacks.onToast(msg);
          break;
        }

        // ---- JUICE FX ----
        case 'fx_particles': {
          const kind = (String(f.KIND ?? 'stars') as ParticleKind) || 'stars';
          const count = Math.max(1, Math.min(80, Number(this.evalValue(sprite, getInputBlock(cur, 'COUNT')))));
          this.callbacks.onSpawnParticles(kind, count, sprite.x, sprite.y);
          break;
        }
        case 'fx_screenshake': {
          const intensity = Math.max(1, Math.min(25, Number(this.evalValue(sprite, getInputBlock(cur, 'INTENSITY')))));
          this.callbacks.onScreenShake(intensity);
          break;
        }
      }

      opsSinceYield++;
      if (opsSinceYield >= 48) {
        opsSinceYield = 0;
        await this.waitNextFrame(thread);
      }

      cur = cur.next?.block;
    }
  }
}
