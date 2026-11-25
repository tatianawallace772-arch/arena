/**
 * Cookie Bakery — a tiny Web Audio engine for the Gingerbread Calendar.
 *
 * Everything is synthesised on the fly: no audio files, no network requests.
 *  - `play(name)` fires short UI sound effects (a candy-cane "ting" for saves,
 *    a cinnamon-dusted pop for stickers, a sugar sprinkle for deletes…).
 *  - `startMusic() / stopMusic()` run a generative music-box loop: a soft
 *    celesta-ish bell triad over a sleigh-bell shimmer, in a pentatonic
 *    gingerbread key, with a new phrase every couple of bars.
 *
 * The AudioContext is created lazily on the first user gesture so browsers
 * never block it, and every gain is ramped to avoid clicks.
 */

export type SfxName =
  | 'tap'
  | 'save'
  | 'place'
  | 'delete'
  | 'toggle'
  | 'open'
  | 'close'
  | 'error'
  | 'celebrate';

export type MusicMood = 'gingerbread' | 'frost' | 'quiet';

interface ToneOptions {
  freq: number;
  type?: OscillatorType;
  start?: number;
  duration?: number;
  gain?: number;
  attack?: number;
  release?: number;
  detune?: number;
  pan?: number;
  /** Add a soft bell partial one octave up. */
  sparkle?: boolean;
  destination?: AudioNode;
}

const PENTATONIC = [0, 2, 4, 7, 9]; // major pentatonic
const MOODS: Record<MusicMood, { root: number; tempo: number; shuffle: number; shimmer: number }> = {
  gingerbread: { root: 392.0, tempo: 100, shuffle: 4, shimmer: 0.1 }, // G4, cozy waltz
  frost: { root: 440.0, tempo: 78, shuffle: 8, shimmer: 0.16 }, // A4, slower + airier
  quiet: { root: 329.63, tempo: 64, shuffle: 10, shimmer: 0.05 }, // E4, barely there
};

class BakeryAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicTimer: number | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicOn = false;
  private mood: MusicMood = 'gingerbread';
  private step = 0;
  private nextNoteTime = 0;

  sfxVolume = 0.5;
  musicVolume = 0.22;

  /** Create (or resume) the AudioContext. Safe to call from any handler. */
  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(this.master);

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 4200;
      this.musicFilter.Q.value = 0.4;

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0;
      this.musicBus.connect(this.musicFilter);
      this.musicFilter.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  get available(): boolean {
    return typeof window !== 'undefined' && Boolean(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  get isMusicOn(): boolean {
    return this.musicOn;
  }

  setSfxVolume(v: number) {
    this.sfxVolume = clamp01(v);
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  setMusicVolume(v: number) {
    this.musicVolume = clamp01(v);
    if (this.musicBus && this.ctx && this.musicOn) {
      this.musicBus.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.15);
    }
  }

  setMood(mood: MusicMood) {
    this.mood = mood;
  }

  /** Low-level single tone. */
  private tone({
    freq,
    type = 'sine',
    start = 0,
    duration = 0.4,
    gain = 0.2,
    attack = 0.008,
    release = 0.25,
    detune = 0,
    pan = 0,
    sparkle = false,
    destination,
  }: ToneOptions) {
    const ctx = this.ctx;
    const dest = destination ?? this.sfxBus;
    if (!ctx || !dest) return;
    const t0 = ctx.currentTime + start;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration + release);

    const panner = ctx.createStereoPanner();
    panner.pan.value = clampNum(pan, -1, 1);

    osc.connect(env);
    env.connect(panner);
    panner.connect(dest);
    osc.start(t0);
    osc.stop(t0 + duration + release + 0.05);

    if (sparkle) {
      const bell = ctx.createOscillator();
      bell.type = 'triangle';
      bell.frequency.value = freq * 2;
      const bellEnv = ctx.createGain();
      bellEnv.gain.setValueAtTime(0.0001, t0);
      bellEnv.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * 0.28), t0 + attack);
      bellEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + duration * 0.8 + release);
      bell.connect(bellEnv);
      bellEnv.connect(panner);
      bell.start(t0);
      bell.stop(t0 + duration + release + 0.05);
    }
  }

  /** Filtered noise burst — sprinkles, snips, whooshes. */
  private noise({
    start = 0,
    duration = 0.2,
    gain = 0.12,
    type = 'highpass',
    freq = 2400,
    q = 0.9,
    pan = 0,
    destination,
  }: {
    start?: number;
    duration?: number;
    gain?: number;
    type?: BiquadFilterType;
    freq?: number;
    q?: number;
    pan?: number;
    destination?: AudioNode;
  }) {
    const ctx = this.ctx;
    const dest = destination ?? this.sfxBus;
    if (!ctx || !dest) return;
    if (!this.noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 1.2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const t0 = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    const panner = ctx.createStereoPanner();
    panner.pan.value = clampNum(pan, -1, 1);

    src.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(dest);
    src.start(t0);
    src.stop(t0 + duration + 0.03);
  }

  /** Play one named UI sound. */
  play(name: SfxName) {
    const ctx = this.ensure();
    if (!ctx) return;
    switch (name) {
      case 'tap':
        this.tone({ freq: 880, type: 'triangle', duration: 0.08, gain: 0.12, release: 0.09 });
        break;
      case 'save': // two-note candy-cane ting
        this.tone({ freq: 1046.5, type: 'triangle', duration: 0.12, gain: 0.16, sparkle: true });
        this.tone({ freq: 1568, type: 'sine', duration: 0.16, gain: 0.14, start: 0.07, sparkle: true });
        this.tone({ freq: 2093, type: 'sine', duration: 0.14, gain: 0.07, start: 0.14 });
        break;
      case 'place': // soft cookie press
        this.tone({ freq: 523.25, type: 'sine', duration: 0.1, gain: 0.16 });
        this.tone({ freq: 392, type: 'triangle', duration: 0.18, gain: 0.12, start: 0.04, pan: 0.1 });
        this.noise({ duration: 0.1, gain: 0.05, freq: 3200 });
        break;
      case 'delete':
        this.noise({ duration: 0.22, gain: 0.1, type: 'bandpass', freq: 1800, q: 1.4, pan: -0.2 });
        this.tone({ freq: 330, type: 'triangle', duration: 0.12, gain: 0.1 });
        break;
      case 'toggle':
        this.tone({ freq: 660, type: 'square', duration: 0.05, gain: 0.06, release: 0.05 });
        break;
      case 'open':
        this.tone({ freq: 587.33, type: 'sine', duration: 0.1, gain: 0.1, sparkle: true });
        this.tone({ freq: 880, type: 'sine', duration: 0.12, gain: 0.08, start: 0.06 });
        break;
      case 'close':
        this.tone({ freq: 587.33, type: 'sine', duration: 0.09, gain: 0.08 });
        this.tone({ freq: 440, type: 'sine', duration: 0.12, gain: 0.07, start: 0.05 });
        break;
      case 'error':
        this.tone({ freq: 220, type: 'sawtooth', duration: 0.12, gain: 0.07, release: 0.1 });
        this.tone({ freq: 185, type: 'sawtooth', duration: 0.16, gain: 0.06, start: 0.09 });
        break;
      case 'celebrate': {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((f, i) => {
          this.tone({
            freq: f,
            type: 'triangle',
            duration: 0.18,
            gain: 0.13,
            start: i * 0.055,
            sparkle: i % 2 === 0,
            pan: (i - 2) * 0.18,
          });
        });
        this.noise({ duration: 0.7, gain: 0.06, type: 'highpass', freq: 5200, start: 0.05 });
        break;
      }
      default:
        break;
    }
  }

  /** Schedule the next music-box phrase. */
  private scheduleStep() {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn) return;
    const mood = MOODS[this.mood];
    const beat = 60 / mood.tempo;
    const bar = beat * 3; // waltz: 3 beats

    while (this.nextNoteTime < ctx.currentTime + 0.6) {
      const start = Math.max(0, this.nextNoteTime - ctx.currentTime);
      const s = this.step;
      const phrase = Math.floor(s / 12);
      const inPhrase = s % 12;

      // Melody: step through the pentatonic scale with an octave lift.
      const degreeIndex = (inPhrase * 3 + phrase * 2) % 10;
      const octave = degreeIndex >= 5 ? 1 : 0;
      const semis = PENTATONIC[degreeIndex % 5] + octave * 12;
      const freq = mood.root * Math.pow(2, semis / 12);

      if (inPhrase !== 5 && inPhrase !== 11) {
        this.tone({
          freq,
          type: 'sine',
          start,
          duration: beat * 0.85,
          gain: 0.16,
          attack: 0.02,
          release: 0.6,
          pan: octave ? 0.22 : -0.16,
          sparkle: inPhrase % 4 === 0,
          destination: this.musicBus ?? undefined,
        });
      }

      // Bass on the downbeat of each bar.
      if (inPhrase % 3 === 0) {
        this.tone({
          freq: mood.root / 4,
          type: 'sine',
          start,
          duration: beat * 1.4,
          gain: 0.12,
          attack: 0.03,
          release: 0.5,
          destination: this.musicBus ?? undefined,
        });
        // Sleigh-bell shimmer on the downbeat.
        this.noise({
          start,
          duration: 0.16,
          gain: mood.shimmer,
          type: 'bandpass',
          freq: 6400,
          q: 2.2,
          pan: 0.35,
          destination: this.musicBus ?? undefined,
        });
        this.noise({
          start: start + 0.04,
          duration: 0.12,
          gain: mood.shimmer * 0.7,
          type: 'bandpass',
          freq: 7600,
          q: 2.6,
          pan: -0.35,
          destination: this.musicBus ?? undefined,
        });
      }

      // Closing cadence every four phrases.
      if (s % 48 === 47) {
        this.tone({
          freq: mood.root,
          type: 'sine',
          start,
          duration: bar,
          gain: 0.14,
          attack: 0.03,
          release: 0.9,
          sparkle: true,
          destination: this.musicBus ?? undefined,
        });
      }

      this.step += 1;
      this.nextNoteTime += beat * (this.step % mood.shuffle === 0 ? 1.25 : 1);
    }
  }

  startMusic(mood: MusicMood = this.mood) {
    const ctx = this.ensure();
    if (!ctx || !this.musicBus) return;
    this.mood = mood;
    if (this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNoteTime = ctx.currentTime + 0.15;
    this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
    this.musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.musicBus.gain.exponentialRampToValueAtTime(this.musicVolume, ctx.currentTime + 1.6);
    this.scheduleStep();
    this.musicTimer = window.setInterval(() => this.scheduleStep(), 200);
  }

  stopMusic() {
    const ctx = this.ctx;
    this.musicOn = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (ctx && this.musicBus) {
      this.musicBus.gain.cancelScheduledValues(ctx.currentTime);
      this.musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
    }
  }

  toggleMusic(mood?: MusicMood): boolean {
    if (this.musicOn) this.stopMusic();
    else this.startMusic(mood);
    return this.musicOn;
  }

  /** Duck the soundtrack while a modal is open. */
  duck(on: boolean) {
    if (!this.ctx || !this.musicBus || !this.musicOn) return;
    this.musicBus.gain.setTargetAtTime(on ? this.musicVolume * 0.35 : this.musicVolume, this.ctx.currentTime, 0.2);
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
  }
}

const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clamp01 = (v: number) => clampNum(v, 0, 1);

export const bakeryAudio = new BakeryAudio();
export type { BakeryAudio };
