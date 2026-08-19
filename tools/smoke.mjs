// ============================================================================
// smoke.mjs — headless runtime test for watch-ui.js.
// Runs every watch face, every app, taps, swipes, crown/side actions and the
// notification/control-center/wallet/water-lock flows against a mock 2D
// canvas context. Exits non-zero on any error.
// ============================================================================

import { WatchUI, W, H, APPS, FACES } from "../js/watch-ui.js";

// ---- mock canvas context -------------------------------------------------
function makeCtx() {
  const gradient = { addColorStop() {} };
  const noop = () => {};
  const fn = () => noop;
  return new Proxy({}, {
    get(t, prop) {
      if (prop === "measureText") return () => ({ width: 12 });
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => gradient;
      if (prop === "canvas") return mockCanvas;
      if (!(prop in t)) t[prop] = fn();
      return t[prop];
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
const mockCanvas = { width: W, height: H, getContext: () => ctx };
const ctx = makeCtx();

let failures = 0;
function check(cond, label) {
  if (cond) console.log("  ✓ " + label);
  else { failures++; console.error("  ✗ FAIL: " + label); }
}
function assertState(ui, expected, label) {
  check(ui.state === expected, `${label} → state '${ui.state}' (expected '${expected}')`);
}

// ---- harness --------------------------------------------------------------
const ui = new WatchUI(mockCanvas, { sound: () => {} });
const t0 = Date.UTC(2026, 7, 19, 9, 41, 12);
let now = t0;
const tick = (ms = 40) => { now += ms; ui.tick(ms / 1000, now); };
const tapAt = (id) => {
  const hit = ui.hit.find((h) => h.id === id);
  if (!hit) { check(false, `region '${id}' exists`); return; }
  ui.tap(hit.x + hit.w / 2, hit.y + hit.h / 2);
};

console.log("— faces —");
assertState(ui, "face", "initial state is face");
for (let i = 0; i < FACES.length; i++) {
  ui.faceIndex = i;
  ui.idle = 0;
  tick();
  check(true, `face '${FACES[i].id}' draws`);
}
ui.faceIndex = 0; ui.idle = 0;
ui.faceSwitch(1); tick(50); tick(300);
check(ui.faceIndex === 1, "crown scroll switches face");
ui.faceSwitch(-1); tick(400);
check(ui.faceIndex === 0, "crown scroll switches back");

console.log("— horizontal swipe changes face —");
ui.faceIndex = 0; tick(300);
const before = ui.faceIndex;
ui.swipe(100, 200, 420, 200); tick(400);
check(ui.faceIndex === (before + FACES.length - 1) % FACES.length, "swipe right = previous face");

console.log("— crown / grid / app launch —");
ui.crownPress(); tick(300);
assertState(ui, "grid", "crown opens grid");
check(ui.hit.some((h) => h.id === "app:calc"), "grid shows calculator icon");
tapAt("app:calc"); tick(50); tick(300);
assertState(ui, "app:calc", "tap opens calculator");

console.log("— calculator math —");
tapAt("1"); tapAt("add"); tapAt("2"); tapAt("eq");
check(ui.app.calc.disp === "3", `1 + 2 = ${ui.app.calc.disp}`);
tapAt("mul"); tapAt("6"); tapAt("eq");
check(ui.app.calc.disp === "18", `3 × 6 = ${ui.app.calc.disp}`);
tapAt("C"); tapAt("7"); tapAt("div"); tapAt("0"); tapAt("eq");
check(ui.app.calc.disp === "Err", `7 ÷ 0 = ${ui.app.calc.disp}`);
ui.crownPress(); tick(300);
assertState(ui, "face", "crown returns to face");

console.log("— every app opens, draws, receives taps —");
for (const app of APPS) {
  ui.openApp(app.id);
  tick(50); tick(300);
  assertState(ui, "app:" + app.id, `opens ${app.id}`);
  const hits = [...ui.hit];
  for (const h of hits.slice(0, 3)) {
    ui.tap(h.x + h.w / 2, h.y + h.h / 2);
    tick(30);
  }
  tick(250);
  ui.crownPress(); tick(300);
  assertState(ui, "face", `closes ${app.id}`);
}
// restore settings the app-loop taps may have toggled
ui.settings = { aod: true, wake: true, theater: false, sounds: true, airplane: false, water: false, dnd: false };

console.log("— timer completes and notifies —");
ui.openApp("timer");
tick(300);
tapAt("p1"); tapAt("start"); tick(300);
check(ui.app.timer.running, "timer running");
const notifBefore = ui.notifications.length;
for (let i = 0; i < 61; i++) { now += 1000; ui.tick(1, now); }
check(!ui.app.timer.running && ui.app.timer.done, "timer finished after 61s");
check(ui.notifications.length === notifBefore + 1, "timer pushed a notification");
ui.tick(0.05, now + 50); now += 50;
check(!!ui.banner, "banner is visible");
ui.crownPress(); tick(300);

console.log("— notification center —");
ui.swipe(240, 20, 240, 160); tick(300);
assertState(ui, "notifications", "swipe down opens notifications");
const nHits = ui.hit.filter((h) => h.id.startsWith("n"));
check(nHits.length >= 4, "notification list rendered");
ui.tap(nHits[0].x + 10, nHits[0].y + 10); tick(300);
ui.crownPress(); tick(300);
assertState(ui, "face", "crown closes notifications");

console.log("— control center —");
ui.swipe(240, H - 20, 240, 100); tick(300);
assertState(ui, "control", "swipe up opens control center");
tapAt("dnd"); tick(300);
check(ui.settings.dnd === true, "Do Not Disturb toggles on");
tapAt("dnd"); tick(300);
check(ui.settings.dnd === false, "Do Not Disturb toggles off");
tapAt("flashlight"); tick(300);
assertState(ui, "flashlight", "flashlight opens");
ui.tap(240, 200); tick(300);
assertState(ui, "flashlight", "tap cycles to red light");
ui.tap(240, 200); tick(300);
assertState(ui, "flashlight", "tap cycles to strobe");
ui.tap(240, 200); tick(300);
assertState(ui, "face", "third tap turns off");
check(ui.getLight().level >= 0.5, "normal light level restored");

console.log("— water lock —");
ui.open("waterlock"); tick(300);
assertState(ui, "waterlock", "water lock engaged");
for (let i = 0; i < 6; i++) { ui.crownScroll(1); tick(30); }
assertState(ui, "face", "six crown scrolls unlock");
check(ui.settings.water === false, "water lock setting cleared");

console.log("— wallet —");
ui.sideDouble(); tick(300);
assertState(ui, "wallet", "double side opens wallet");
tapAt("pay"); tick(300);
check(ui.wallet.paid > 0, "payment started");
tick(2000);
ui.crownPress(); tick(300);
assertState(ui, "face", "crown closes wallet");

console.log("— dock —");
ui.sidePress(); tick(300);
assertState(ui, "dock", "side button opens dock");
const card = ui.hit.find((h) => h.id.startsWith("card"));
check(!!card, "dock cards rendered");
if (card) { ui.tap(card.x + 20, card.y + 20); tick(300); }
check(ui.state.startsWith("app:"), "dock card opens app");
ui.sidePress(); tick(300);
assertState(ui, "dock", "side button reopens dock");
ui.sidePress(); tick(300);
assertState(ui, "face", "second side press closes dock");

console.log("— music crown volume —");
ui.openApp("music");
tick(300);
const vol0 = ui.app.music.vol;
ui.crownScroll(1); tick(30);
check(ui.app.music.vol === Math.min(1, vol0 + 0.1), "crown adjusts volume in Music");

console.log("— theater mode dims —");
ui.settings.theater = true; tick(300);
check(ui.brightness() < 0.1, "theater mode dims display");
check(ui.getLight().level < 0.1, "theater mode dims glow");
ui.settings.theater = false;

console.log("— AOD dims when idle —");
ui.crownPress(); tick(300);
ui.settings.aod = true;
ui.idle = 25; tick(300);
check(ui.brightness() < 0.3, "AOD dims after idle");
ui.wake(); tick(300);
check(ui.brightness() === 1, "wake restores brightness");

console.log("— battery & power reserve —");
ui.setBattery(5); tick(300);
check(ui.lowWarned, "low battery warning fired");
ui.setBattery(0); tick(300);
assertState(ui, "powerreserve", "empty battery enters power reserve");
ui.recharge(); tick(300);
assertState(ui, "face", "recharge exits power reserve");
check(ui.battery === 100, "battery at 100%");

console.log("— chronograph face tap —");
ui.faceIndex = FACES.findIndex((f) => f.id === "chrono");
ui.open("face"); tick(300);
check(!ui.faceData.chrono.running, "chrono initially stopped");
ui.tap(W / 2, H / 2); tick(100);
check(ui.faceData.chrono.running, "tap starts chrono");
ui.tap(W / 2, H / 2); tick(100);
check(!ui.faceData.chrono.running, "tap stops chrono");

console.log("— settings app toggle —");
ui.open("app:settings"); tick(300);
tapAt("theater"); tick(100);
check(ui.settings.theater === true, "settings toggle works");
ui.settings.theater = false;
ui.crownPress(); tick(300);

console.log("— hud —");
const hud = ui.hud();
check(hud.battery === 100 && typeof hud.stateLabel === "string", "hud() returns info");

console.log("— long soak (2 minutes simulated) —");
ui.wake();
for (let i = 0; i < 240; i++) { tick(500); ui.crownScroll(i % 2 ? 1 : -1); }
check(true, "soak complete without errors");

if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log("\nAll smoke checks passed ✔");
