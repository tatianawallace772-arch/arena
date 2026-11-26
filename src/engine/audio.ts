import type { SoundAsset, SoundPreset } from '../types/studio';

class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 0.8;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setVolume(percent: number): void {
    this.volume = Math.max(0, Math.min(1, percent / 100));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  getVolume(): number {
    return Math.round(this.volume * 100);
  }

  stopAll(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(String(text));
      utter.rate = 1.05;
      utter.pitch = 1.15;
      utter.volume = this.volume;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
      // Safety fallback timeout so script never hangs if browser TTS doesn't fire onend
      setTimeout(resolve, Math.max(1200, String(text).length * 95));
    });
  }

  playAsset(asset: SoundAsset): Promise<void> {
    if (asset.customDataUrl) {
      return new Promise((resolve) => {
        const audio = new Audio(asset.customDataUrl);
        audio.volume = this.volume;
        audio.playbackRate = Math.max(0.4, Math.min(2.5, asset.speed || 1));
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
    }
    if (asset.preset === 'custom') {
      return this.playCustomTone(
        asset.waveform || 'triangle',
        (asset.baseFreq || 440) * (asset.pitch || 1),
        (asset.duration || 0.3) / (asset.speed || 1)
      );
    }
    return this.playPreset(asset.preset, asset.pitch || 1, asset.speed || 1);
  }

  playCustomTone(type: OscillatorType, freq: number, durationSec: number): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return Promise.resolve();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 1.25), now + durationSec * 0.5);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.85), now + durationSec);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + durationSec);
    return new Promise((r) => setTimeout(r, durationSec * 1000));
  }

  playPreset(preset: SoundPreset, pitch = 1, speed = 1): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return Promise.resolve();
    const now = ctx.currentTime;
    const out = this.masterGain;
    const durScale = 1 / Math.max(0.35, speed);

    const tone = (
      freqStart: number,
      freqEnd: number,
      startOffset: number,
      dur: number,
      type: OscillatorType = 'sine',
      vol = 0.25
    ) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(30, freqStart * pitch), now + startOffset);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd * pitch), now + startOffset + dur);
      }
      g.gain.setValueAtTime(vol, now + startOffset);
      g.gain.exponentialRampToValueAtTime(0.001, now + startOffset + dur);
      osc.connect(g);
      g.connect(out);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + dur + 0.02);
    };

    let totalDuration = 0.25 * durScale;

    switch (preset) {
      case 'jump':
        tone(240, 660, 0, 0.18 * durScale, 'sine', 0.28);
        totalDuration = 0.18 * durScale;
        break;
      case 'coin':
        tone(987.77, 987.77, 0, 0.08 * durScale, 'square', 0.16);
        tone(1318.5, 1318.5, 0.07 * durScale, 0.26 * durScale, 'square', 0.16);
        totalDuration = 0.33 * durScale;
        break;
      case 'magic':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, idx) => {
          tone(f, f * 1.03, idx * 0.055 * durScale, 0.22 * durScale, 'triangle', 0.2);
        });
        totalDuration = 0.45 * durScale;
        break;
      case 'cheer':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          tone(f, f, idx * 0.07 * durScale, 0.18 * durScale, 'triangle', 0.22);
        });
        totalDuration = 0.4 * durScale;
        break;
      case 'laser':
        tone(1100, 140, 0, 0.2 * durScale, 'sawtooth', 0.18);
        totalDuration = 0.2 * durScale;
        break;
      case 'pop':
        tone(420, 160, 0, 0.08 * durScale, 'sine', 0.32);
        totalDuration = 0.09 * durScale;
        break;
      case 'boing':
        tone(180, 520, 0, 0.12 * durScale, 'sine', 0.26);
        tone(520, 260, 0.1 * durScale, 0.12 * durScale, 'sine', 0.22);
        tone(260, 460, 0.2 * durScale, 0.14 * durScale, 'sine', 0.18);
        totalDuration = 0.34 * durScale;
        break;
      case 'powerup':
        [330, 392, 523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          tone(f, f, idx * 0.05 * durScale, 0.09 * durScale, 'square', 0.14);
        });
        totalDuration = 0.38 * durScale;
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, idx) => {
          const d = idx === 5 ? 0.35 : 0.11;
          tone(f, f, idx * 0.1 * durScale, d * durScale, 'triangle', 0.24);
        });
        totalDuration = 0.85 * durScale;
        break;
      case 'lose':
        [392, 370, 349.23, 311.13].forEach((f, idx) => {
          tone(f, f * 0.94, idx * 0.16 * durScale, 0.22 * durScale, 'sawtooth', 0.16);
        });
        totalDuration = 0.72 * durScale;
        break;
      case 'click':
      default:
        tone(760, 420, 0, 0.045 * durScale, 'triangle', 0.22);
        totalDuration = 0.05 * durScale;
        break;
    }

    return new Promise((r) => setTimeout(r, totalDuration * 1000));
  }

  playMidiNote(midi: number, beats: number, tempoBpm = 120): Promise<void> {
    const ctx = this.ensureContext();
    const durSec = Math.max(0.05, (60 / Math.max(30, tempoBpm)) * beats);
    if (!ctx || !this.masterGain) return Promise.resolve();
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + durSec * 0.96);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + durSec);
    return new Promise((r) => setTimeout(r, durSec * 1000));
  }
}

export const audioEngine = new StudioAudioEngine();
