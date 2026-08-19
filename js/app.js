import { PlantAudio } from "./audio.js";
import { createState, step } from "./sim.js";
import { renderUnits, renderKpis, renderInspector, drawTrend, tickGauges } from "./ui.js";

const audio = new PlantAudio();
const state = createState();
let selected = "roast";
let last = performance.now();
let acc = 0;

const SPEEDS = [1, 4, 16, 60];

function inspHandlers() {
  return {
    onAdjust() {
      renderUnits(state);
      renderKpis(state);
    },
    onRebuild() {
      audio.click();
      renderUnits(state);
      renderKpis(state);
      renderInspector(state, selected, inspHandlers());
    },
  };
}

function select(unit) {
  selected = unit;
  document.querySelectorAll(".unit").forEach((el) => {
    el.classList.toggle("sel", el.dataset.unit === unit);
  });
  renderInspector(state, unit, inspHandlers());
  audio.click();
}

function setRunning(on) {
  if (state.trip && on) return;
  state.running = on;
  if (on && !state.log.find((l) => l.msg.includes("Plant started"))) {
    state.log.unshift({ t: state.time, kind: "good", msg: "Plant started — feed on, rectifiers armed" });
  }
  document.getElementById("btn-run").textContent = on ? "Pause" : "Start";
  audio.clunk();
}

function toggleSpeed() {
  const i = SPEEDS.indexOf(state.speed);
  state.speed = SPEEDS[(i + 1) % SPEEDS.length];
  audio.click();
}

function applyMute(m) {
  audio.setMuted(m);
  document.getElementById("btn-mute").setAttribute("aria-pressed", String(m));
  document.getElementById("audio-chip").textContent = m ? "MUTED" : "AUDIO";
}

async function enter(muted) {
  document.getElementById("boot").classList.add("gone");
  document.getElementById("app").classList.add("live");
  if (!muted) {
    await audio.unlock();
    applyMute(false);
  } else {
    applyMute(true);
    await audio.unlock();
    audio.setMuted(true);
  }
  setRunning(true);
}

function loop(now) {
  const dtReal = Math.min(0.08, (now - last) / 1000);
  last = now;
  acc += dtReal;
  const tick = 1 / 30;
  while (acc >= tick) {
    if (state.running) step(state, tick * state.speed);
    acc -= tick;
  }
  renderUnits(state);
  renderKpis(state);
  drawTrend(document.getElementById("trend"), state);
  audio.mix({
    running: state.running && !state.trip,
    roast: state.roastT > 200 ? Math.min(1, state.roastT / 950) : 0,
    acid: state.acidTph / 20,
    leach: state.leachX,
    cells: state.ce * state.set.cellsOnline,
    cast: Math.min(1, state.furnaceT / 480),
  });
  audio.alarm(state.alarms.length > 0 || state.trip);
  requestAnimationFrame(loop);
}

function bind() {
  document.querySelectorAll(".unit").forEach((el) => {
    el.addEventListener("click", () => select(el.dataset.unit));
  });
  document.getElementById("enter").addEventListener("click", () => enter(false));
  document.getElementById("enter-mute").addEventListener("click", () => enter(true));
  document.getElementById("btn-run").addEventListener("click", () => setRunning(!state.running));
  document.getElementById("btn-speed").addEventListener("click", toggleSpeed);
  document.getElementById("btn-mute").addEventListener("click", async () => {
    if (!audio.ctx) await audio.unlock();
    applyMute(!audio.muted);
  });
  document.getElementById("btn-help").addEventListener("click", () => {
    document.getElementById("help").classList.add("open");
  });
  document.getElementById("help-close").addEventListener("click", () => {
    document.getElementById("help").classList.remove("open");
  });
  document.getElementById("help").addEventListener("click", (e) => {
    if (e.target.id === "help") e.currentTarget.classList.remove("open");
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); setRunning(!state.running); }
    if (e.key === "m" || e.key === "M") applyMute(!audio.muted);
    if (e.key === "h" || e.key === "H") document.getElementById("help").classList.toggle("open");
    if (e.key === "Escape") document.getElementById("help").classList.remove("open");
    const map = { 1: "feed", 2: "roast", 3: "acid", 4: "leach", 5: "purify", 6: "cells", 7: "cast", 8: "yard" };
    if (map[e.key]) select(map[e.key]);
  });
  select("roast");
  requestAnimationFrame((t) => { last = t; loop(t); });
}

bind();
