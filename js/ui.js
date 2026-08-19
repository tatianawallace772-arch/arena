import { formatClock, eStop, resetTrip, defaultSetpoints } from "./sim.js";

const UNITS = {
  feed: {
    title: "Concentrate feed",
    blurb: "Sphalerite (ZnS) concentrate from the mill. Grade swings change everything downstream.",
    chem: "ZnS concentrate · 48–58% Zn, ~31% S",
  },
  roast: {
    title: "Fluid-bed roaster",
    blurb: "Dead-roast sulfide to acid-soluble zinc oxide. Hold ~930 °C with modest excess air.",
    chem: "2 ZnS + 3 O₂ → 2 ZnO + 2 SO₂",
  },
  acid: {
    title: "Sulfuric acid plant",
    blurb: "Contact process converts roaster gas to H₂SO₄ for leach and cellhouse recycle.",
    chem: "2 SO₂ + O₂ → 2 SO₃ → H₂SO₄",
  },
  leach: {
    title: "Leach circuit",
    blurb: "Neutral leach dissolves ZnO while iron hydrolyzes to residue. pH is the lever.",
    chem: "ZnO + H₂SO₄ → ZnSO₄ + H₂O",
  },
  purify: {
    title: "Solution purification",
    blurb: "Zinc dust cements copper and cadmium. Starving the dust feed poisons electrowinning.",
    chem: "Cu²⁺ + Zn → Cu + Zn²⁺   Cd²⁺ + Zn → Cd + Zn²⁺",
  },
  cells: {
    title: "Electrowinning cellhouse",
    blurb: "Aluminum cathodes, Pb-Ag anodes. Current density, temperature, and impurities set CE.",
    chem: "Zn²⁺ + 2 e⁻ → Zn    H₂O → ½ O₂ + 2 H⁺ + 2 e⁻",
  },
  cast: {
    title: "Casting furnace",
    blurb: "Cathode sheets are melted and poured as SHG jumbo ingots. Stay above 430 °C.",
    chem: "Zn (s, cathode) → Zn (ℓ) → SHG ingot",
  },
  yard: {
    title: "Ingot yard",
    blurb: "Special high grade zinc, 99.995% Zn. Shift tonnage is the scoreboard.",
    chem: "SHG Zn ≥ 99.995%",
  },
  utils: {
    title: "Utilities",
    blurb: "Rectifiers dominate the power bill. Specific energy should sit near 3,000–3,400 kWh/t.",
    chem: "Cellhouse ~ 3.2–3.5 V · Faraday 1.2195 g Zn / A·h",
  },
};

function fmt(n, d = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

function ledClass(state, unit) {
  if (!state.running) return "off";
  const map = {
    feed: state.set.feedRate > 1 ? "ok" : "off",
    roast: state.conversion < 0.88 || state.roastT > 985 ? "warn" : "ok",
    acid: state.acidConv < 0.9 ? "warn" : "ok",
    leach: state.leachFe > 3.5 || state.leachX < 0.88 ? "warn" : "ok",
    purify: state.cd > 2.2 || state.cu > 2 ? "bad" : "ok",
    cells: state.ce < 0.84 ? "warn" : "ok",
    cast: state.furnaceT < 420 ? "warn" : "ok",
    yard: state.purity < 99.99 ? "bad" : "ok",
    utils: state.kwhPerT > 3800 ? "warn" : "ok",
  };
  const v = map[unit];
  if (v === "ok") return "";
  return v || "off";
}

export function renderUnits(state) {
  const set = {
    feed: [`${fmt(state.set.feedRate * (state.running ? 1 : 0), 1)}`, `Zn grade ${fmt(state.concGrade, 1)}%`],
    roast: [`${fmt(state.roastT, 0)}`, `Conversion ${(state.conversion * 100).toFixed(1)}%`],
    acid: [`${fmt(state.acidTph, 1)}`, `Conversion ${(state.acidConv * 100).toFixed(1)}%`],
    leach: [`${fmt(state.plsZn, 0)}`, `Extraction ${(state.leachX * 100).toFixed(1)}%`],
    purify: [`${fmt(state.cd, 2)}`, `Cu residual ${fmt(state.cu, 2)} mg/L`],
    cells: [`${fmt(state.cathodeTph, 2)}`, `CE ${(state.ce * 100).toFixed(1)}% · ${fmt(state.cellV, 2)} V`],
    cast: [`${fmt(state.castTph, 2)}`, `Furnace ${fmt(state.furnaceT, 0)} °C`],
    yard: [`${fmt(state.shiftT, 1)}`, `Purity ${state.purity.toFixed(4)}%`],
    utils: [`${fmt(state.powerMW, 1)}`, `kWh/t ${state.kwhPerT ? fmt(state.kwhPerT, 0) : "—"}`],
  };
  for (const [id, [pv, sub]] of Object.entries(set)) {
    const el = document.getElementById("u-" + id);
    el.querySelector("[data-pv]").childNodes[0].nodeValue = pv;
    el.querySelector("[data-sub]").textContent = sub;
    const led = el.querySelector("[data-led]");
    led.className = "led " + ledClass(state, id);
    const hot = {
      roast: state.alarms.some((a) => /roast|overtemp/i.test(a)),
      leach: state.alarms.some((a) => /iron|acid/i.test(a)),
      purify: state.alarms.some((a) => /purif/i.test(a)),
      cells: state.alarms.some((a) => /efficiency|energy/i.test(a)),
      yard: state.alarms.some((a) => /purity/i.test(a)),
    };
    el.classList.toggle("alarm", Boolean(hot[id]));
  }
  document.getElementById("flow").classList.toggle("running", state.running && !state.trip);
  document.getElementById("feed-label").textContent = `CONC ${state.concGrade.toFixed(1)}% Zn`;
}

export function renderKpis(state) {
  document.getElementById("k-zn").textContent = fmt(state.cathodeTph, 2);
  document.getElementById("k-pur").textContent = state.running || state.shiftT > 0 ? state.purity.toFixed(3) : "—";
  document.getElementById("k-ce").textContent = state.ce ? (state.ce * 100).toFixed(1) : "—";
  document.getElementById("k-kwh").textContent = state.kwhPerT ? fmt(state.kwhPerT, 0) : "—";
  document.getElementById("k-rec").textContent = state.recovery ? fmt(state.recovery, 1) : "—";
  document.getElementById("k-shift").textContent = fmt(state.shiftT, 1);
  document.getElementById("clock").textContent = formatClock(state.time);

  const chip = document.getElementById("status-chip");
  if (state.trip) { chip.textContent = "TRIP"; chip.className = "chip bad"; }
  else if (state.alarms.length) { chip.textContent = "ALARM"; chip.className = "chip bad"; }
  else if (state.running) { chip.textContent = "RUN"; chip.className = "chip good"; }
  else { chip.textContent = "STANDBY"; chip.className = "chip"; }

  document.getElementById("speed-chip").textContent = state.speed + "×";
  const toast = document.getElementById("toast");
  if (state.event) {
    toast.textContent = state.event;
    toast.classList.add("show");
  } else {
    toast.classList.remove("show");
  }
}

function slider(id, label, min, max, step, value, unit) {
  const shown = id === "cellsOnline" ? `${Math.round(value * 100)} %` : `${value} ${unit}`;
  return `<div class="ctrl">
    <div class="lab"><span>${label}</span><b id="v-${id}">${shown}</b></div>
    <input type="range" id="s-${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
  </div>`;
}

export function renderInspector(state, unit, handlers) {
  const meta = UNITS[unit] || { title: "Select a unit", blurb: "Click a process unit.", chem: "" };
  document.getElementById("insp-title").textContent = meta.title;
  document.getElementById("insp-blurb").textContent = meta.blurb;
  const body = document.getElementById("insp-body");
  const g = (label, val, key) =>
    `<div class="gauge"><label>${label}</label><b data-g="${key || ""}">${val}</b></div>`;
  const sp = state.set;
  let controls = "";
  let gauges = "";

  if (unit === "feed") {
    gauges = g("Feed Zn", fmt(state.set.feedRate * state.concGrade / 100, 2) + " t/h", "feedZn") + g("Sulfur", fmt(state.concS, 1) + " %", "concS");
    controls = slider("feedRate", "Concentrate rate", 0, 50, 0.5, sp.feedRate, "t/h");
  } else if (unit === "roast") {
    gauges = g("Bed temp", fmt(state.roastT, 0) + " °C", "roastT") + g("SO₂ gas", fmt(state.so2Pct, 1) + " %", "so2") +
      g("Conversion", (state.conversion * 100).toFixed(1) + " %", "conv") + g("Calcine silo", fmt(state.calcineInv, 0) + " t", "calcine");
    controls = slider("roastTemp", "Temperature SP", 850, 1020, 1, sp.roastTemp, "°C") +
      slider("airExcess", "Excess air", 4, 35, 1, sp.airExcess, "%");
  } else if (unit === "acid") {
    gauges = g("H₂SO₄ make", fmt(state.acidTph, 2) + " t/h", "acidTph") + g("Conversion", (state.acidConv * 100).toFixed(1) + " %", "acidConv") +
      g("Acid tank", fmt(state.acidInv, 0) + " t", "acidInv") + g("SO₂ in", fmt(state.so2Pct, 1) + " %", "so2");
  } else if (unit === "leach") {
    gauges = g("PLS Zn", fmt(state.plsZn, 0) + " g/L", "plsZn") + g("Extraction", (state.leachX * 100).toFixed(1) + " %", "leachX") +
      g("Fe in PLS", fmt(state.leachFe, 2) + " g/L", "leachFe") + g("pH SP", fmt(sp.leachPH, 2), "leachPH");
    controls = slider("leachPH", "Leach pH", 3.6, 5.6, 0.05, sp.leachPH, "") +
      slider("leachTemp", "Leach temperature", 50, 95, 1, sp.leachTemp, "°C");
  } else if (unit === "purify") {
    gauges = g("Cd residual", fmt(state.cd, 2) + " mg/L", "cd") + g("Cu residual", fmt(state.cu, 2) + " mg/L", "cu") +
      g("Purified Zn", fmt(state.purifiedZn, 0) + " g/L", "purZn") + g("Dust factor", fmt(sp.dustFactor, 2) + "×", "dust");
    controls = slider("dustFactor", "Zinc dust stoichiometry", 0.7, 1.4, 0.01, sp.dustFactor, "×");
  } else if (unit === "cells") {
    gauges = g("Cathode Zn", fmt(state.cathodeTph, 2) + " t/h", "cathode") + g("CE", (state.ce * 100).toFixed(1) + " %", "ce") +
      g("Cell voltage", fmt(state.cellV, 2) + " V", "volt") + g("CD", fmt(sp.currentDensity, 0) + " A/m²", "cdens");
    controls = slider("currentDensity", "Current density", 280, 720, 5, sp.currentDensity, "A/m²") +
      slider("cellTemp", "Electrolyte temp", 30, 48, 0.5, sp.cellTemp, "°C") +
      slider("cellsOnline", "Rectifier load", 0, 1, 0.01, sp.cellsOnline, "");
  } else if (unit === "cast") {
    gauges = g("Cast rate", fmt(state.castTph, 2) + " t/h", "cast") + g("Furnace", fmt(state.furnaceT, 0) + " °C", "furn") +
      g("Melt heel", fmt(state.meltInv, 1) + " t", "melt") + g("Purity", state.purity.toFixed(4) + " %", "pur");
    controls = slider("castTemp", "Furnace SP", 400, 520, 1, sp.castTemp, "°C");
  } else if (unit === "yard") {
    gauges = g("Shift ingots", fmt(state.shiftT, 2) + " t", "shift") + g("SHG purity", state.purity.toFixed(4) + " %", "pur") +
      g("Recovery", fmt(state.recovery, 1) + " %", "rec") + g("Nameplate", "15 t/h");
  } else if (unit === "utils") {
    gauges = g("Plant load", fmt(state.powerMW, 1) + " MW", "mw") + g("Specific energy", state.kwhPerT ? fmt(state.kwhPerT, 0) + " kWh/t" : "—", "kwh") +
      g("Cellhouse", fmt(state.cellV, 2) + " V", "volt") + g("Alarms", String(state.alarms.length), "alarms");
  }

  const logHtml = state.log.slice(0, 8).map((l) => {
    const hh = formatClock(l.t);
    return `<div class="${l.kind}">${hh}  ${l.msg}</div>`;
  }).join("");

  body.innerHTML = `
    ${meta.chem ? `<div class="chem">${meta.chem}</div>` : ""}
    <div class="gauges">${gauges}</div>
    ${controls}
    <div class="insp-actions">
      <button class="btn" id="opt-defaults">Restore defaults</button>
      <button class="btn btn-danger" id="opt-trip">${state.trip ? "Reset trip" : "Emergency trip"}</button>
    </div>
    <div class="log">${logHtml || "<div>No events yet.</div>"}</div>
  `;

  body.querySelectorAll("input[type=range]").forEach((el) => {
    const key = el.id.slice(2);
    el.addEventListener("input", () => {
      let v = Number(el.value);
      state.set[key] = v;
      const label = document.getElementById("v-" + key);
      const unitMap = { feedRate: "t/h", roastTemp: "°C", airExcess: "%", leachPH: "", leachTemp: "°C", dustFactor: "×", currentDensity: "A/m²", cellTemp: "°C", cellsOnline: "", castTemp: "°C" };
      label.textContent = (key === "cellsOnline" ? Math.round(v * 100) + " %" : v + " " + (unitMap[key] || ""));
      handlers.onAdjust();
    });
  });
  body.querySelector("#opt-defaults")?.addEventListener("click", () => {
    state.set = { ...defaultSetpoints(), cellsOnline: state.set.cellsOnline };
    handlers.onRebuild();
  });
  body.querySelector("#opt-trip")?.addEventListener("click", () => {
    if (state.trip) resetTrip(state); else eStop(state);
    handlers.onRebuild();
  });
}

export function tickGauges(state) {
  const vals = {
    feedZn: fmt(state.set.feedRate * state.concGrade / 100, 2) + " t/h",
    concS: fmt(state.concS, 1) + " %",
    roastT: fmt(state.roastT, 0) + " °C",
    so2: fmt(state.so2Pct, 1) + " %",
    conv: (state.conversion * 100).toFixed(1) + " %",
    calcine: fmt(state.calcineInv, 0) + " t",
    acidTph: fmt(state.acidTph, 2) + " t/h",
    acidConv: (state.acidConv * 100).toFixed(1) + " %",
    acidInv: fmt(state.acidInv, 0) + " t",
    plsZn: fmt(state.plsZn, 0) + " g/L",
    leachX: (state.leachX * 100).toFixed(1) + " %",
    leachFe: fmt(state.leachFe, 2) + " g/L",
    leachPH: fmt(state.set.leachPH, 2),
    cd: fmt(state.cd, 2) + " mg/L",
    cu: fmt(state.cu, 2) + " mg/L",
    purZn: fmt(state.purifiedZn, 0) + " g/L",
    dust: fmt(state.set.dustFactor, 2) + "×",
    cathode: fmt(state.cathodeTph, 2) + " t/h",
    ce: (state.ce * 100).toFixed(1) + " %",
    volt: fmt(state.cellV, 2) + " V",
    cdens: fmt(state.set.currentDensity, 0) + " A/m²",
    cast: fmt(state.castTph, 2) + " t/h",
    furn: fmt(state.furnaceT, 0) + " °C",
    melt: fmt(state.meltInv, 1) + " t",
    pur: state.purity.toFixed(4) + " %",
    shift: fmt(state.shiftT, 2) + " t",
    rec: fmt(state.recovery, 1) + " %",
    mw: fmt(state.powerMW, 1) + " MW",
    kwh: state.kwhPerT ? fmt(state.kwhPerT, 0) + " kWh/t" : "—",
    alarms: String(state.alarms.length),
  };
  document.querySelectorAll("[data-g]").forEach((el) => {
    const k = el.getAttribute("data-g");
    if (k && vals[k] != null) el.textContent = vals[k];
  });
}

export function drawTrend(canvas, state) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#243040";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(0, (h * i) / 4); ctx.lineTo(w, (h * i) / 4); ctx.stroke();
  }
  const zn = state.histZn;
  if (zn.length < 2) return;
  const maxZ = Math.max(16, ...zn);
  ctx.beginPath();
  zn.forEach((v, i) => {
    const x = (i / (80 - 1)) * w;
    const y = h - (v / maxZ) * (h - 8) - 4;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = "#3ecfcf";
  ctx.lineWidth = 2;
  ctx.stroke();
  const pur = state.histPur;
  ctx.beginPath();
  pur.forEach((v, i) => {
    const x = (i / (80 - 1)) * w;
    const y = h - ((v - 99.97) / 0.03) * (h - 8) - 4;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = "#f0a020";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export { UNITS };
