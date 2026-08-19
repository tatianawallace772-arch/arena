/** Procedural plant audio — no sample files. */

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

export class PlantAudio {
  constructor() {
    this.enabled = false;
    this.muted = false;
    this.ctx = null;
    this.master = null;
    this.amb = null;
    this.layers = {};
    this.alarmOsc = null;
    this.alarmGain = null;
    this._alarmOn = false;
  }

  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.enabled = true;
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
    this._buildLayers();
    this.enabled = true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.22, this.ctx.currentTime, 0.05);
  }

  _noise(seconds = 2) {
    const n = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.052691;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  _filter(type, freq, q = 0.8) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  _gain(v) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  _osc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  _buildLayers() {
    const t = this.ctx.currentTime;

    const rumble = this._noise();
    const rumbleF = this._filter("lowpass", 90, 0.6);
    const rumbleG = this._gain(0);
    rumble.connect(rumbleF).connect(rumbleG).connect(this.master);
    rumble.start();
    this.layers.rumble = rumbleG;

    const air = this._noise();
    const airF = this._filter("bandpass", 1800, 0.5);
    const airG = this._gain(0);
    air.connect(airF).connect(airG).connect(this.master);
    air.start();
    this.layers.air = airG;

    const pump = this._osc("sawtooth", 42);
    const pumpF = this._filter("lowpass", 220);
    const pumpG = this._gain(0);
    pump.connect(pumpF).connect(pumpG).connect(this.master);
    pump.start(t);
    this.layers.pump = pumpG;
    this.layers.pumpOsc = pump;

    const hum = this._osc("sine", 50);
    const hum2 = this._osc("sine", 100);
    const humG = this._gain(0);
    const hum2G = this._gain(0);
    hum.connect(humG).connect(this.master);
    hum2.connect(hum2G).connect(this.master);
    hum.start(t);
    hum2.start(t);
    this.layers.hum = humG;
    this.layers.hum2 = hum2G;

    const hiss = this._noise();
    const hissF = this._filter("highpass", 2400);
    const hissG = this._gain(0);
    hiss.connect(hissF).connect(hissG).connect(this.master);
    hiss.start();
    this.layers.hiss = hissG;

    const melt = this._osc("triangle", 70);
    const meltG = this._gain(0);
    melt.connect(meltG).connect(this.master);
    melt.start(t);
    this.layers.melt = meltG;
    this.layers.meltOsc = melt;

    this.alarmOsc = this._osc("square", 880);
    this.alarmGain = this._gain(0);
    this.alarmOsc.connect(this.alarmGain).connect(this.master);
    this.alarmOsc.start(t);
  }

  /** Mix layers from plant state (0–1 intensities). */
  mix(s) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const run = s.running ? 1 : 0;
    const set = (g, v, tau = 0.25) => {
      if (!g) return;
      g.gain.setTargetAtTime(clamp(v, 0, 1) * run, now, tau);
    };
    set(this.layers.rumble, 0.18 + s.roast * 0.55, 0.4);
    set(this.layers.air, 0.04 + s.roast * 0.22 + s.acid * 0.08);
    set(this.layers.pump, 0.02 + s.leach * 0.12);
    set(this.layers.hum, 0.02 + s.cells * 0.16);
    set(this.layers.hum2, s.cells * 0.05);
    set(this.layers.hiss, s.cells * 0.07 + s.acid * 0.04);
    set(this.layers.melt, s.cast * 0.08);
    if (this.layers.pumpOsc) {
      this.layers.pumpOsc.frequency.setTargetAtTime(36 + s.leach * 18, now, 0.3);
    }
    if (this.layers.meltOsc) {
      this.layers.meltOsc.frequency.setTargetAtTime(55 + s.cast * 30, now, 0.4);
    }
  }

  alarm(on) {
    if (!this.ctx || !this.alarmGain) return;
    if (on === this._alarmOn) return;
    this._alarmOn = on;
    const now = this.ctx.currentTime;
    if (!on) {
      this.alarmGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }
    this.alarmGain.gain.setTargetAtTime(0.07, now, 0.02);
    const beep = () => {
      if (!this._alarmOn || !this.alarmOsc) return;
      const t = this.ctx.currentTime;
      this.alarmOsc.frequency.setValueAtTime(880, t);
      this.alarmOsc.frequency.setValueAtTime(620, t + 0.22);
      setTimeout(beep, 440);
    };
    beep();
  }

  click() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this._osc("square", 1400);
    const g = this._gain(0.04);
    o.connect(g).connect(this.master);
    o.start(t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.stop(t + 0.07);
  }

  clunk() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this._osc("sine", 90);
    const g = this._gain(0.12);
    o.connect(g).connect(this.master);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.start(t);
    o.stop(t + 0.22);
  }

  spark() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const n = this._noise(0.2);
    const f = this._filter("highpass", 3000);
    const g = this._gain(0.08);
    n.connect(f).connect(g).connect(this.master);
    n.start(t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.stop(t + 0.13);
  }
}
