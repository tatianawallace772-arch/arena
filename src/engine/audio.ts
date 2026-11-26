import type {
  DrumKind,
  MusicInstrument,
  SoundAsset,
  SoundPreset,
  TTSVoice,
} from '../types/studio';

class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.8;
  public currentInstrument: MusicInstrument = 'piano';
  public currentVoice: TTSVoice = 'alto';
  public currentLanguage = 'en-US';

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = ctx.sampleRate * 1.0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
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

  setInstrument(inst: MusicInstrument): void {
    this.currentInstrument = inst;
  }

  setVoice(voice: TTSVoice): void {
    this.currentVoice = voice;
  }

  setLanguage(lang: string): void {
    this.currentLanguage = lang;
  }

  stopAll(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  private playKittenMeows(wordCount: number): Promise<void> {
    const ctx = this.ensureContext();
    const count = Math.max(1, Math.min(8, wordCount));
    if (!ctx || !this.masterGain) return Promise.resolve();
    const now = ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const t0 = now + i * 0.28;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, t0);
      osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.09);
      osc.frequency.exponentialRampToValueAtTime(490, t0 + 0.24);
      g.gain.setValueAtTime(0.01, t0);
      g.gain.linearRampToValueAtTime(0.24, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.26);
    }
    return new Promise((r) => setTimeout(r, count * 280));
  }

  speak(rawText: string): Promise<void> {
    const words = String(rawText).trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return Promise.resolve();

    const spokenText =
      this.currentVoice === 'kitten' ? words.map(() => 'meow').join(' ') : String(rawText);

    if (this.currentVoice === 'kitten') {
      void this.playKittenMeows(words.length);
    }

    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setTimeout(resolve, Math.min(1800, words.length * 280));
        return;
      }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(spokenText);
      utter.lang = this.currentLanguage;
      utter.volume = this.volume;

      switch (this.currentVoice) {
        case 'alto':
          utter.pitch = 1.18;
          utter.rate = 1.04;
          break;
        case 'tenor':
          utter.pitch = 0.86;
          utter.rate = 1.0;
          break;
        case 'squeak':
          utter.pitch = 1.85;
          utter.rate = 1.25;
          break;
        case 'giant':
          utter.pitch = 0.45;
          utter.rate = 0.78;
          break;
        case 'kitten':
          utter.pitch = 1.9;
          utter.rate = 1.3;
          break;
      }

      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      utter.onend = finish;
      utter.onerror = finish;
      window.speechSynthesis.speak(utter);
      setTimeout(finish, Math.max(900, spokenText.length * 85));
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
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(30, freqEnd * pitch),
          now + startOffset + dur
        );
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
    const out = this.masterGain;

    const inst = this.currentInstrument;
    const osc1 = ctx.createOscillator();
    const g = ctx.createGain();

    let wave: OscillatorType = 'triangle';
    let attack = 0.01;
    let peak = 0.26;
    let harmonicRatio = 0;

    switch (inst) {
      case 'piano':
        wave = 'triangle';
        harmonicRatio = 2;
        attack = 0.008;
        break;
      case 'epiano':
        wave = 'sine';
        harmonicRatio = 3;
        attack = 0.012;
        break;
      case 'organ':
        wave = 'sine';
        harmonicRatio = 2;
        attack = 0.025;
        peak = 0.22;
        break;
      case 'guitar':
        wave = 'sawtooth';
        attack = 0.005;
        peak = 0.18;
        break;
      case 'synth':
        wave = 'sawtooth';
        harmonicRatio = 1.005;
        attack = 0.015;
        peak = 0.2;
        break;
      case 'flute':
        wave = 'sine';
        attack = 0.06;
        peak = 0.24;
        break;
      case 'chiptune':
        wave = 'square';
        attack = 0.004;
        peak = 0.16;
        break;
      case 'marimba':
        wave = 'sine';
        harmonicRatio = 4;
        attack = 0.004;
        peak = 0.3;
        break;
    }

    osc1.type = wave;
    osc1.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(peak, now + attack);
    if (inst === 'organ' || inst === 'flute') {
      g.gain.setValueAtTime(peak * 0.85, now + Math.max(attack, durSec * 0.78));
    }
    g.gain.exponentialRampToValueAtTime(0.001, now + durSec * 0.98);

    osc1.connect(g);
    g.connect(out);
    osc1.start(now);
    osc1.stop(now + durSec);

    if (harmonicRatio > 0) {
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * harmonicRatio, now);
      g2.gain.setValueAtTime(peak * 0.28, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + durSec * 0.65);
      osc2.connect(g2);
      g2.connect(out);
      osc2.start(now);
      osc2.stop(now + durSec * 0.7);
    }

    return new Promise((r) => setTimeout(r, durSec * 1000));
  }

  playDrum(drum: DrumKind, beats: number, tempoBpm = 120): Promise<void> {
    const ctx = this.ensureContext();
    const waitDur = Math.max(0.05, (60 / Math.max(30, tempoBpm)) * beats);
    if (!ctx || !this.masterGain) return Promise.resolve();
    const now = ctx.currentTime;
    const out = this.masterGain;

    const triggerNoise = (filterType: BiquadFilterType, cutoff: number, dur: number, vol: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer(ctx);
      const flt = ctx.createBiquadFilter();
      flt.type = filterType;
      flt.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(flt);
      flt.connect(g);
      g.connect(out);
      src.start(now);
      src.stop(now + dur);
    };

    switch (drum) {
      case 'bass': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
        g.gain.setValueAtTime(0.45, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(g);
        g.connect(out);
        osc.start(now);
        osc.stop(now + 0.23);
        break;
      }
      case 'snare': {
        triggerNoise('highpass', 1200, 0.16, 0.28);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(210, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);
        g.gain.setValueAtTime(0.24, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(g);
        g.connect(out);
        osc.start(now);
        osc.stop(now + 0.11);
        break;
      }
      case 'sidestick': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(840, now);
        g.gain.setValueAtTime(0.22, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.connect(g);
        g.connect(out);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case 'crash':
        triggerNoise('highpass', 3200, 0.55, 0.24);
        break;
      case 'openhihat':
        triggerNoise('highpass', 5800, 0.28, 0.2);
        break;
      case 'closedhihat':
        triggerNoise('highpass', 6800, 0.06, 0.2);
        break;
      case 'tambourine':
        triggerNoise('bandpass', 7200, 0.16, 0.24);
        break;
      case 'clap':
        triggerNoise('bandpass', 1600, 0.14, 0.3);
        break;
    }

    return new Promise((r) => setTimeout(r, waitDur * 1000));
  }
}

export const audioEngine = new StudioAudioEngine();
