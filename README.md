#  Apple Watch 3D — Interactive Simulator

A fully functional, interactive 3D Apple Watch simulator that runs in the browser.
Built with **Three.js** (bundled locally — no CDN required) and a custom
watchOS-style UI engine rendered onto the watch's display.

## ✨ What works

**The watch itself**
- Procedurally modeled 3D watch: case, black bezel, curved glass, knurled digital
  crown, side button, lugs, heart-rate sensor, and a sport-band loop with clasp
- Studio lighting, softbox reflections, real-time shadows
- Drag to rotate (with inertia), scroll to zoom, pinch on touch, gentle auto-rotate
- 5 case finishes and 8 band colors, persisted between visits

**watchOS simulation (on the display)**
- 5 animated watch faces (live clock, sweeping second hands): **Infograph,
  Modular, California, Solar, Chronograph**
- Scroll over the crown (or press `F`) to switch faces; swipe the face sideways too
- **App grid** (crown click) with 12 apps — most are genuinely interactive:
  - **Calculator** — full four-function math
  - **Timer** — presets, countdown ring, notification when done
  - **Heart Rate** — live ECG trace, measuring (the sensor LEDs on the back light up!)
  - **Music** — play/pause/next, real progress, crown = volume
  - **Messages** — threads, bubbles, canned replies
  - **Workout** — ticking metrics, pause/end summary
  - **Activity, Weather, Photos, Breathe, Compass, Settings** (working toggles)
- **Dock** (side button) · **Wallet** (double-click side button — tap the card to "pay")
- **Notification Center** (swipe down) with banner alerts
- **Control Center** (swipe up): airplane mode, Wi-Fi, Do Not Disturb, flashlight
  (white / red / strobe — it lights up the scene!), theater mode, water lock
  (unlock by scrolling the crown), ping iPhone
- Always-On Display that dims when idle, battery that drains, low-battery warnings
  and a Power Reserve state, WebAudio haptic-style sounds

## 🚀 Running

Any static server works — no build step, no dependencies to install:

```bash
# Python
python3 -m http.server 8000          # → http://localhost:8000

# or Node
npx serve .
```

Open `index.html` from the server root (ES modules require http, not `file://`).

## 🕹 Controls

| Input | Action |
|---|---|
| Drag background | Rotate the watch |
| Scroll / pinch | Zoom |
| Scroll **over the crown** | Change watch face |
| Click crown | App grid (click again to go back) |
| Click side button | Dock · **double-click** = Wallet |
| Tap the display | Interact with the UI |
| Swipe down / up from display edges | Notification Center / Control Center |
| Swipe sideways on the face | Previous / next face |

Keyboard: `F` face · `C` crown · `S` side button · `A` auto-rotate · `R` reset view · `H` help · `M` sound

The **Control Panel** (right side) lets you swap case/band, recharge the battery,
send test notifications, and more.

## 🧱 Structure

```
index.html          — page shell, HUD, control panel, help modal
css/style.css       — page chrome
js/vendor/three.module.js — Three.js r160 (vendored locally)
js/watch-ui.js      — the watchOS canvas UI engine (faces, apps, gestures)
js/main.js          — 3D scene, watch model, controls, HUD wiring
tools/smoke.mjs     — headless runtime test of the UI engine (node tools/smoke.mjs)
```

## 🧪 Tests

```bash
node tools/smoke.mjs   # exercises every face, app, gesture and flow
```

No build tools, no runtime dependencies — plain ES modules.
