/* Web Audio stingers — no external files needed */
const ASNSounds = (() => {
  let ctx;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, t, dur, type = "sine", gain = 0.08) {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime + t);
    g.gain.setValueAtTime(0.0001, c.currentTime + t);
    g.gain.exponentialRampToValueAtTime(gain, c.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(c.currentTime + t);
    o.stop(c.currentTime + t + dur + 0.02);
  }
  return {
    unlock() { ac(); },
    login() { tone(523, 0, 0.12, "triangle", 0.06); tone(659, 0.1, 0.12); tone(784, 0.2, 0.22); },
    message() { tone(880, 0, 0.08, "square", 0.04); tone(1175, 0.08, 0.1, "square", 0.035); },
    nudge() {
      for (let i = 0; i < 8; i++) tone(180 - i * 8, i * 0.04, 0.06, "sawtooth", 0.05);
    },
    signin() { tone(660, 0, 0.1); tone(880, 0.1, 0.16); },
    wink() { tone(523, 0, 0.08); tone(784, 0.08, 0.08); tone(1046, 0.16, 0.18, "triangle", 0.06); },
    error() { tone(200, 0, 0.18, "square", 0.05); tone(160, 0.16, 0.22, "square", 0.05); },
    shutdown() { tone(784, 0, 0.12); tone(659, 0.12, 0.12); tone(523, 0.24, 0.28); }
  };
})();
