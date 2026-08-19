/** Roast–leach–electrowin zinc plant, simplified but mass-consistent. */

const FARADAY_ZN = 1.2195; // g Zn per ampere-hour (Zn2+)
const NAMEPLATE_TPH = 15; // cathode design rate
const CATHODE_AREA = 26000; // m² equivalent cellhouse (~15 t/h at 520 A/m², 91% CE)

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function approach(cur, tgt, rate, dt) {
  const d = tgt - cur;
  const max = rate * dt;
  if (Math.abs(d) <= max) return tgt;
  return cur + Math.sign(d) * max;
}

export function defaultSetpoints() {
  return {
    feedRate: 38,          // t/h concentrate
    roastTemp: 930,        // °C
    airExcess: 18,         // %
    acidBypass: 0,         // 0–1 trip
    leachTemp: 72,         // °C
    leachPH: 4.8,
    dustFactor: 1.05,      // relative to stoichiometric
    currentDensity: 520,   // A/m²
    cellTemp: 38,          // °C
    cellsOnline: 1,        // 0–1 fraction
    castTemp: 460,         // °C
  };
}

export function createState() {
  return {
    running: false,
    time: 6 * 3600, // 06:00 plant clock, seconds
    speed: 1,
    set: defaultSetpoints(),
    concGrade: 52.4, // % Zn
    concS: 31.2,
    roastT: 25,
    conversion: 0,
    so2Pct: 0,
    calcineInv: 40,
    acidTph: 0,
    acidConv: 0,
    acidInv: 180,
    plsZn: 0,
    leachX: 0,
    leachFe: 0,
    cd: 40,
    cu: 80,
    purifiedZn: 0,
    ce: 0,
    cellV: 0,
    cathodeTph: 0,
    purity: 99.995,
    kwhPerT: 0,
    powerMW: 2.1,
    recovery: 0,
    shiftT: 0,
    castTph: 0,
    furnaceT: 30,
    meltInv: 8,
    alarms: [],
    event: null,
    eventT: 0,
    log: [],
    histZn: [],
    histPur: [],
    trip: false,
  };
}

function log(state, kind, msg) {
  state.log.unshift({ t: state.time, kind, msg });
  if (state.log.length > 40) state.log.pop();
}

function maybeEvent(state, dt) {
  if (!state.running || state.trip) return;
  state.eventT -= dt;
  if (state.eventT > 0) return;
  state.eventT = 50 + Math.random() * 80;
  const roll = Math.random();
  if (roll < 0.28) {
    state.concGrade = clamp(50 + Math.random() * 6, 48, 58);
    state.event = `Concentrate assay swing — feed now ${state.concGrade.toFixed(1)}% Zn`;
    state.eventAge = 0;
    log(state, "warn", state.event);
  } else if (roll < 0.42) {
    state.set.airExcess = clamp(state.set.airExcess + (Math.random() * 10 - 4), 5, 35);
    state.event = "Roaster blower drift — air excess shifted";
    state.eventAge = 0;
    log(state, "warn", state.event);
  } else if (roll < 0.55) {
    state.event = "Cellhouse short cleared on row 12 — watch current efficiency";
    state.eventAge = 0;
    log(state, "warn", state.event);
    state.ceHit = 0.04;
  } else if (roll < 0.68) {
    state.event = "Zinc dust feeder hesitation — purification load rising";
    state.eventAge = 0;
    log(state, "warn", state.event);
    state.dustHit = 0.25;
  } else if (roll < 0.8) {
    state.event = "Grid dip — rectifier voltage sag 4%";
    state.eventAge = 0;
    log(state, "bad", state.event);
    state.voltHit = 0.04;
  } else {
    state.event = null;
  }
}

export function fadeEvent(state, dt) {
  if (!state.event) return;
  state.eventAge = (state.eventAge || 0) + dt;
  if (state.eventAge > 14) {
    state.event = null;
    state.eventAge = 0;
  }
}

export function step(state, dt) {
  const sp = state.set;
  maybeEvent(state, dt);
  fadeEvent(state, dt);
  if (state.dustHit) state.dustHit = Math.max(0, state.dustHit - dt * 0.01);
  if (state.ceHit) state.ceHit = Math.max(0, state.ceHit - dt * 0.008);
  if (state.voltHit) state.voltHit = Math.max(0, state.voltHit - dt * 0.01);

  const run = state.running && !state.trip ? 1 : 0;
  if (state.running) state.time += dt;

  const feed = sp.feedRate * run;
  const znFeed = feed * (state.concGrade / 100);

  // Roaster: ZnS + 1.5 O2 → ZnO + SO2. Peak conversion near 930 °C, 15–20% excess air.
  const tTarget = run ? sp.roastTemp : 25;
  state.roastT = approach(state.roastT, tTarget, run ? 18 : 8, dt);
  const tempFit = Math.exp(-Math.pow((state.roastT - 932) / 70, 2));
  const airFit = Math.exp(-Math.pow((sp.airExcess - 17) / 12, 2));
  const convTgt = run ? clamp(0.22 + 0.76 * tempFit * airFit, 0.15, 0.985) : 0;
  state.conversion = approach(state.conversion, convTgt, 0.12, dt);
  state.so2Pct = run ? clamp(8.5 * state.conversion * (state.concS / 31), 0, 12) : 0;
  const znCal = znFeed * state.conversion;
  state.calcineInv = clamp(state.calcineInv + (feed * 0.92 - feed * run) * dt / 3600, 5, 120);

  // Acid plant: 2 SO2 + O2 → 2 SO3 → H2SO4. Conversion falls if SO2 too lean or rich.
  const so2Fit = clamp(1 - Math.abs(state.so2Pct - 8.2) / 9, 0, 1);
  state.acidConv = approach(state.acidConv, run ? 0.97 * so2Fit : 0, 0.15, dt);
  const sFeed = feed * (state.concS / 100) * state.conversion;
  state.acidTph = sFeed * (98 / 32) * state.acidConv; // rough SO2 sulfur → H2SO4
  state.acidInv = clamp(state.acidInv + (state.acidTph - 12 * run) * dt / 3600, 20, 400);

  // Leach: ZnO + H2SO4 → ZnSO4 + H2O. Iron stays out near pH 4.5–5.2.
  const pHfit = Math.exp(-Math.pow((sp.leachPH - 4.75) / 0.55, 2));
  const lTfit = clamp((sp.leachTemp - 50) / 35, 0, 1);
  const sulfidePenalty = 1 - (1 - state.conversion) * 0.7;
  const acidOk = clamp(state.acidInv / 80, 0, 1);
  const xTgt = run ? clamp(0.35 + 0.62 * pHfit * lTfit * sulfidePenalty * acidOk, 0.2, 0.985) : 0;
  state.leachX = approach(state.leachX, xTgt, 0.1, dt);
  const znToSol = znCal * state.leachX;
  state.plsZn = approach(state.plsZn, run ? 145 + (znToSol - 14) * 3.2 : 20, 12, dt);
  const iron = clamp((5.2 - sp.leachPH) * 1.8 + (1 - state.conversion) * 4, 0.05, 12);
  state.leachFe = approach(state.leachFe, run ? iron : 0.1, 1.2, dt);

  // Purification: Me2+ + Zn → Me + Zn2+. Dust factor & iron load.
  const dust = sp.dustFactor * (1 - (state.dustHit || 0));
  const cuTgt = run ? clamp(80 / (dust * 18) + state.leachFe * 0.4, 0.05, 40) : 0.2;
  const cdTgt = run ? clamp(45 / (dust * 14) + (sp.leachPH < 4.2 ? 4 : 0), 0.08, 30) : 0.2;
  state.cu = approach(state.cu, cuTgt, 4, dt);
  state.cd = approach(state.cd, cdTgt, 3.5, dt);
  state.purifiedZn = approach(state.purifiedZn, run ? state.plsZn * 0.97 : 10, 10, dt);

  // Electrowinning
  const cd = sp.currentDensity * sp.cellsOnline * run;
  const impurity = state.cu * 0.012 + state.cd * 0.018 + state.leachFe * 0.03;
  const tempFitC = Math.exp(-Math.pow((sp.cellTemp - 38) / 8, 2));
  const cdFit = clamp(1 - Math.abs(sp.currentDensity - 500) / 420, 0.45, 1);
  let ce = 0.93 * tempFitC * cdFit * clamp(1 - impurity, 0.35, 1) * (1 - (state.ceHit || 0));
  if (state.purifiedZn < 80) ce *= clamp(state.purifiedZn / 80, 0.2, 1);
  state.ce = approach(state.ce, run ? ce : 0, 0.08, dt);
  const volts = (3.05 + (sp.currentDensity - 450) / 900 + (state.voltHit || 0) * 3) * (run ? 1 : 0);
  state.cellV = approach(state.cellV, volts, 0.4, dt);
  const amps = cd * CATHODE_AREA;
  const faradayTph = (amps * FARADAY_ZN * state.ce) / 1e6; // g/h → t/h
  const znLimited = state.purifiedZn / 145 * NAMEPLATE_TPH * 1.05;
  state.cathodeTph = approach(state.cathodeTph, run ? Math.min(faradayTph, znLimited) : 0, 2.5, dt);

  const purity = 99.999 - state.cu * 0.004 - state.cd * 0.006 - Math.max(0, 0.008 - state.ce) * 2;
  state.purity = approach(state.purity, clamp(purity, 99.90, 99.9995), 0.01, dt);

  // Casting
  const fTgt = run ? sp.castTemp : 30;
  state.furnaceT = approach(state.furnaceT, fTgt, 22, dt);
  const meltOk = state.furnaceT > 430 ? 1 : clamp((state.furnaceT - 380) / 50, 0, 1);
  state.meltInv = clamp(state.meltInv + (state.cathodeTph - 12 * meltOk * run) * dt / 3600, 0.5, 40);
  state.castTph = approach(state.castTph, state.cathodeTph * meltOk, 2, dt);
  if (state.running) state.shiftT += state.castTph * dt / 3600;

  // Energy & recovery
  const cellMW = (amps * state.cellV) / 1e6;
  const aux = 1.8 + 2.6 * run + 2.4 * (state.roastT / 930) * run + 1.1 * sp.cellsOnline * run;
  state.powerMW = cellMW + aux;
  state.kwhPerT = state.castTph > 0.4 ? (state.powerMW * 1000) / state.castTph : 0;
  state.recovery = znFeed > 0.5 ? clamp((state.castTph / znFeed) * 100, 0, 99.5) : 0;

  // Alarms
  const alarms = [];
  if (state.roastT > 990 && run) alarms.push("Roaster overtemp");
  if (state.conversion < 0.88 && run && state.roastT > 400) alarms.push("Low roast conversion");
  if (state.leachFe > 3.5) alarms.push("Iron in PLS");
  if (state.cd > 2.5 || state.cu > 2.2) alarms.push("Purification off-spec");
  if (state.ce < 0.84 && run && sp.cellsOnline > 0.5) alarms.push("Low current efficiency");
  if (state.purity < 99.99 && run && state.castTph > 1) alarms.push("Purity below SHG");
  if (state.acidInv < 40 && run) alarms.push("Acid inventory low");
  if (state.kwhPerT > 3800 && state.castTph > 2) alarms.push("High specific energy");
  if (state.trip) alarms.push("Emergency trip");
  const newAlarm = alarms.some((a) => !state.alarms.includes(a));
  if (newAlarm) log(state, "bad", alarms[0]);
  state.alarms = alarms;

  // History for sparkline (plant minutes)
  if (!state._acc) state._acc = 0;
  state._acc += dt;
  if (state._acc > 8) {
    state._acc = 0;
    state.histZn.push(state.cathodeTph);
    state.histPur.push(state.purity);
    if (state.histZn.length > 80) { state.histZn.shift(); state.histPur.shift(); }
  }
}

export function eStop(state) {
  state.trip = true;
  state.running = false;
  state.set.cellsOnline = 0;
  state.event = "Emergency trip — rectifiers open, feed stopped";
  state.eventAge = 0;
}

export function resetTrip(state) {
  state.trip = false;
  state.event = "Trip reset — ready to start";
  state.eventAge = 0;
}

export function formatClock(sec) {
  const s = ((sec % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const shift = h < 14 ? 1 : h < 22 ? 2 : 3;
  return `SHIFT ${shift} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
