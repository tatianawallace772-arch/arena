// ============================================================================
// main.js — 3D Apple Watch simulator.
// Three.js scene, procedural watch model, custom orbit controls, HUD wiring.
// ============================================================================

import * as THREE from "./vendor/three.module.js";
import { WatchUI, W, H, safeStore } from "./watch-ui.js";

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const canvas3d = $("scene");
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true });
} catch (e) {
  $("webgl-error").classList.remove("hidden");
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 1, 3000);

// ---------------------------------------------------------------------------
// Studio environment (softbox reflections via PMREM)
// ---------------------------------------------------------------------------
{
  const env = new THREE.Scene();
  const sky = new THREE.SphereGeometry(120, 32, 16);
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true });
  const pos = sky.attributes.position;
  const colors = [];
  const cTop = new THREE.Color(0xf6f7fa), cMid = new THREE.Color(0x39404d), cBot = new THREE.Color(0x101318);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 120;
    const c = y > 0 ? cTop.clone().lerp(cMid, Math.min(y * 1.6, 1)) : cMid.clone().lerp(cBot, Math.min(-y * 2.2, 1));
    colors.push(c.r, c.g, c.b);
  }
  sky.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  env.add(new THREE.Mesh(sky, skyMat));
  const soft = (w, h, x, y, z, inten) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: inten })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  soft(34, 16, 2, 40, 10, 4.5);
  soft(26, 24, -32, 6, 22, 3.2);
  soft(20, 26, 34, 10, 6, 2.2);
  soft(36, 20, 0, 2, -34, 1.4);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.05);
  scene.environment = rt.texture;
  pmrem.dispose();
}

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
const keyLight = new THREE.DirectionalLight(0xffffff, 1.75);
keyLight.position.set(22, 30, 30);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -90; keyLight.shadow.camera.right = 90;
keyLight.shadow.camera.top = 90; keyLight.shadow.camera.bottom = -90;
keyLight.shadow.camera.near = 1; keyLight.shadow.camera.far = 160;
keyLight.shadow.bias = -0.0002;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
fillLight.position.set(-34, 8, -20);
scene.add(fillLight);
const screenGlow = new THREE.PointLight(0xffffff, 0.55, 90, 2);
screenGlow.position.set(0, 0, 48);
scene.add(screenGlow);

// ---------------------------------------------------------------------------
// Watch model
// ---------------------------------------------------------------------------
const watch = new THREE.Group();
scene.add(watch);

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// centered rounded box: sx along x, sy along y, sz along z
function makeRBox(sx, sy, sz, r) {
  const shape = roundedRectShape(sx, sz, r);
  const depth = Math.max(sy - 2 * r, 0.2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.85, bevelSegments: 4, curveSegments: 16,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(sy / 2 - r), 0);
  return g;
}

// case
const caseGeo = new THREE.ExtrudeGeometry(roundedRectShape(38, 44, 9), {
  depth: 7.8, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.1, bevelSegments: 6, curveSegments: 32,
});
caseGeo.rotateX(-Math.PI / 2);
caseGeo.translate(0, -3.9, 0);

const caseStyles = {
  silver: { color: 0xe2e4e8, metalness: 0.85, roughness: 0.26 },
  midnight: { color: 0x2b2e34, metalness: 0.85, roughness: 0.32 },
  graphite: { color: 0x43454a, metalness: 1.0, roughness: 0.30 },
  gold: { color: 0xd8b878, metalness: 1.0, roughness: 0.28 },
  starlight: { color: 0xdcd6c8, metalness: 0.85, roughness: 0.30 },
};
const caseMat = new THREE.MeshStandardMaterial({ envMapIntensity: 1.15, ...caseStyles.silver });
const caseMesh = new THREE.Mesh(caseGeo, caseMat);
caseMesh.castShadow = true; caseMesh.receiveShadow = true;
watch.add(caseMesh);

// bezel (black glass base under display)
const bezelGeo = new THREE.ShapeGeometry(roundedRectShape(37.2, 31.2, 8.2), 32);
const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.34, metalness: 0.25, envMapIntensity: 0.9 });
const bezel = new THREE.Mesh(bezelGeo, bezelMat);
bezel.position.z = 5.46;
watch.add(bezel);

// display
const screenCanvas = document.createElement("canvas");
screenCanvas.width = W; screenCanvas.height = H;
const ui = new WatchUI(screenCanvas, { sound: playSound });
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.SRGBColorSpace;
screenTex.minFilter = THREE.LinearFilter;
screenTex.magFilter = THREE.LinearFilter;
screenTex.anisotropy = 8;
const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(35.5, 29.15), screenMat);
screenMesh.position.z = 5.68;
watch.add(screenMesh);

// glass
const glassGeo = new THREE.ShapeGeometry(roundedRectShape(37.6, 31.6, 8.6), 32);
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, roughness: 0.05, metalness: 0.05,
  clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.6, transparent: true, opacity: 1,
});
const glass = new THREE.Mesh(glassGeo, glassMat);
glass.position.z = 5.9;
watch.add(glass);

// digital crown
const crownGroup = new THREE.Group();
crownGroup.position.set(0, 8, 0);
watch.add(crownGroup);
const knurlCanvas = document.createElement("canvas");
knurlCanvas.width = 128; knurlCanvas.height = 64;
{
  const c = knurlCanvas.getContext("2d");
  c.fillStyle = "#8a8a8a"; c.fillRect(0, 0, 128, 64);
  for (let x = 2; x < 128; x += 9) {
    c.fillStyle = "#3c3c3c"; c.fillRect(x, 0, 4.5, 64);
  }
  c.fillStyle = "#a8a8a8"; c.fillRect(0, 0, 128, 2); c.fillRect(0, 62, 128, 2);
}
const knurlTex = new THREE.CanvasTexture(knurlCanvas);
knurlTex.colorSpace = THREE.SRGBColorSpace;
knurlTex.wrapS = THREE.RepeatWrapping;
const crownMat = new THREE.MeshStandardMaterial({ map: knurlTex, bumpMap: knurlTex, bumpScale: 1.4, envMapIntensity: 1.0 });
crownMat.copy(caseMat); crownMat.map = knurlTex; crownMat.bumpMap = knurlTex; crownMat.bumpScale = 1.4;
const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.7, 24), caseMat);
stem.rotation.z = Math.PI / 2; stem.position.x = 20.4;
const crownCap = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 2.2, 48), crownMat);
crownCap.rotation.z = Math.PI / 2; crownCap.position.x = 21.9;
crownCap.castShadow = true;
crownGroup.add(stem, crownCap);
const crownHit = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 4.6, 16), new THREE.MeshBasicMaterial({ visible: false }));
crownHit.rotation.z = Math.PI / 2; crownHit.position.x = 21.6;
crownGroup.add(crownHit);

// side button
const sideGroup = new THREE.Group();
sideGroup.position.set(0, -8.2, 0);
watch.add(sideGroup);
const sideMesh = new THREE.Mesh(makeRBox(2.0, 10.4, 3.6, 0.9), caseMat);
sideMesh.position.x = 20.2;
sideMesh.castShadow = true;
sideGroup.add(sideMesh);
const sideHit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 12, 5), new THREE.MeshBasicMaterial({ visible: false }));
sideHit.position.x = 20.2;
sideGroup.add(sideHit);

// lugs (band connectors)
const lugGeo = makeRBox(26, 5.6, 3.6, 1.2);
const lugTop = new THREE.Mesh(lugGeo, caseMat);
lugTop.position.set(0, 20.4, -4.9);
const lugBot = new THREE.Mesh(lugGeo, caseMat);
lugBot.position.set(0, -20.4, -4.9);
lugTop.castShadow = lugBot.castShadow = true;
watch.add(lugTop, lugBot);

// sensor on the back
const sensorMat = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.45, metalness: 0.3 });
const sensor = new THREE.Mesh(new THREE.CircleGeometry(9.4, 48), sensorMat);
sensor.position.z = -5.44; sensor.rotation.y = Math.PI;
watch.add(sensor);
const sensorLed = new THREE.Mesh(
  new THREE.TorusGeometry(4.2, 0.9, 10, 40),
  new THREE.MeshStandardMaterial({ color: 0x001108, emissive: 0x00ff66, emissiveIntensity: 0.05, roughness: 0.4 })
);
sensorLed.position.z = -5.42; sensorLed.rotation.x = Math.PI / 2;
watch.add(sensorLed);

// band — a flat loop in the x-y plane, behind the case
function buildBand() {
  const N = 240;
  const ax = 29, by = 34, halfW = 13, halfT = 1.6, cr = 1.0, z0 = -7.2;
  const cs = [];
  const corners = [[halfW - cr, halfT - cr], [-(halfW - cr), halfT - cr], [-(halfW - cr), -(halfT - cr)], [halfW - cr, -(halfT - cr)]];
  const ranges = [[0, Math.PI / 2], [Math.PI / 2, Math.PI], [Math.PI, Math.PI * 1.5], [Math.PI * 1.5, Math.PI * 2]];
  for (let q = 0; q < 4; q++) {
    const [cx0, cy0] = corners[q];
    const [a0, a1] = ranges[q];
    for (let i = 0; i <= 3; i++) {
      const ang = a0 + ((a1 - a0) * i) / 3;
      cs.push([cx0 + Math.cos(ang) * cr, cy0 + Math.sin(ang) * cr]);
    }
  }
  const positions = [], uvs = [], indices = [];
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const px = ax * Math.cos(th), py = by * Math.sin(th);
    const tx = -ax * Math.sin(th), ty = by * Math.cos(th);
    const tl = Math.hypot(tx, ty) || 1;
    const nx = ty / tl, ny = -tx / tl;
    for (const [u, w] of cs) {
      positions.push(px + nx * u, py + ny * u, z0 + w);
      uvs.push((u + halfW) / (2 * halfW), i / N);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < cs.length; j++) {
      const jn = (j + 1) % cs.length;
      const a = i * cs.length + j, b = (i + 1) * cs.length + j, c = (i + 1) * cs.length + jn, d = i * cs.length + jn;
      indices.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
const bandCanvas = document.createElement("canvas");
bandCanvas.width = 256; bandCanvas.height = 256;
{
  const c = bandCanvas.getContext("2d");
  c.fillStyle = "#c2c2c2"; c.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 15) {
    c.fillStyle = "rgba(0,0,0,0.22)"; c.fillRect(x, 0, 4, 256);
  }
  for (let i = 0; i < 900; i++) {
    c.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},0.03)`;
    c.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
}
const bandTex = new THREE.CanvasTexture(bandCanvas);
bandTex.colorSpace = THREE.SRGBColorSpace;
bandTex.wrapS = THREE.RepeatWrapping; bandTex.wrapT = THREE.RepeatWrapping;
const bandColors = ["#23262b", "#e8e8ea", "#e8b9c6", "#9fc2ae", "#4a6fa5", "#ff6f3c", "#d9485e", "#e3cf63"];
const bandMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color(bandColors[0]), map: bandTex, bumpMap: bandTex, bumpScale: 0.35,
  roughness: 0.55, metalness: 0.05, envMapIntensity: 0.55,
});
const bandMesh = new THREE.Mesh(buildBand(), bandMat);
bandMesh.castShadow = true; bandMesh.receiveShadow = true;
watch.add(bandMesh);

// clasp at the bottom of the loop
const claspMat = new THREE.MeshStandardMaterial({ color: 0xc9cdd3, metalness: 1.0, roughness: 0.32, envMapIntensity: 1.1 });
const clasp = new THREE.Mesh(makeRBox(32, 11, 3.2, 2), claspMat);
clasp.position.set(0, -33.8, -5.5);
clasp.castShadow = true;
watch.add(clasp);
const pin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 33, 20), claspMat);
pin.rotation.z = Math.PI / 2;
pin.position.set(0, -33.8, -2.4);
pin.castShadow = true;
watch.add(pin);

// ground shadow catcher
const ground = new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.ShadowMaterial({ opacity: 0.38 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -47;
ground.receiveShadow = true;
scene.add(ground);

// ---------------------------------------------------------------------------
// Orbit controls (custom: drag, wheel, pinch, damping, auto-rotate)
// ---------------------------------------------------------------------------
const orbit = { theta: 0.55, phi: 1.32, dist: 236, vTheta: 0, vPhi: 0, auto: true, lastInteract: 0 };
const TARGET = new THREE.Vector3(0, -7, 0);
function applyCamera() {
  const d = orbit.dist;
  camera.position.set(
    TARGET.x + d * Math.sin(orbit.phi) * Math.sin(orbit.theta),
    TARGET.y + d * Math.cos(orbit.phi),
    TARGET.z + d * Math.sin(orbit.phi) * Math.cos(orbit.theta)
  );
  camera.lookAt(TARGET);
}
applyCamera();

let resetTween = null;
function resetView() {
  resetTween = {
    t: 0, dur: 0.9,
    f0: [orbit.theta, orbit.phi, orbit.dist],
    f1: [0.55, 1.32, 236],
  };
}
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const interactives = [crownHit, sideHit, screenMesh];
let hoverName = null;
function hitTest(clientX, clientY) {
  const r = canvas3d.getBoundingClientRect();
  pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(interactives, false);
  if (!hits.length) return null;
  const o = hits[0].object;
  if (o === crownHit) return { kind: "crown", point: hits[0].point };
  if (o === sideHit) return { kind: "side", point: hits[0].point };
  return { kind: "screen", uv: hits[0].uv };
}

const pointers = new Map();
let lastSideClick = 0;
let crownSpinTarget = 0, crownSpin = 0;
let crownPressT = 0, sidePressT = 0;

const CURSORS = { crown: "pointer", side: "pointer", screen: "pointer", bg: "grab" };
const TOOLTIPS = {
  crown: "Digital Crown · scroll = change face · click = apps",
  side: "Side Button · click = dock · double-click = wallet",
  screen: "Display · tap to interact · swipe ↓ notifications · swipe ↑ control center",
};

function toScreenXY(uv) {
  return { x: uv.x * W, y: (1 - uv.y) * H };
}

canvas3d.addEventListener("pointerdown", (e) => {
  canvas3d.setPointerCapture(e.pointerId);
  orbit.lastInteract = performance.now();
  const hit = hitTest(e.clientX, e.clientY);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, hit, moved: 0, swiped: false, pinch: false });
  if (hit && hit.kind === "screen") {
    const p = toScreenXY(hit.uv);
    pointers.get(e.pointerId).suv = p;
  }
  if (hoverName) { $("tooltip").classList.add("hidden"); }
});

canvas3d.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (p) {
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.vx = dx; p.vy = dy;
    p.x = e.clientX; p.y = e.clientY;
    p.moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 2 && !p.pinch) {
      // pinch zoom
      const others = [...pointers.values()].filter((q) => q !== p);
      const q = others[0];
      const dPrev = Math.hypot(p.x - dx - q.x, p.y - dy - q.y);
      const dNow = Math.hypot(p.x - q.x, p.y - q.y);
      if (dPrev > 0) { orbit.dist = clamp(orbit.dist * (dPrev / dNow), 110, 480); }
      p.pinch = true; q.pinch = true;
      return;
    }
    if (p.pinch) return;
    if (p.hit && p.hit.kind === "screen") {
      if (!p.swiped && p.moved > 10) {
        const s = p.suv;
        const h2 = hitTest(e.clientX, e.clientY);
        if (h2 && h2.kind === "screen") {
          const c = toScreenXY(h2.uv);
          ui.swipe(s.x, s.y, c.x, c.y);
          p.swiped = true;
        }
      }
    } else {
      orbit.theta -= dx * 0.0052;
      orbit.phi = clamp(orbit.phi - dy * 0.0052, 0.18, Math.PI - 0.2);
      canvas3d.style.cursor = "grabbing";
    }
  } else if (pointers.size === 0) {
    const hit = hitTest(e.clientX, e.clientY);
    hoverName = hit ? hit.kind : null;
    canvas3d.style.cursor = hit ? CURSORS[hit.kind] : CURSORS.bg;
    const tip = $("tooltip");
    if (hit) {
      tip.textContent = TOOLTIPS[hit.kind];
      tip.classList.remove("hidden");
      tip.style.left = e.clientX + 16 + "px";
      tip.style.top = e.clientY + 18 + "px";
    } else tip.classList.add("hidden");
  }
});

canvas3d.addEventListener("pointerup", (e) => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!p) return;
  canvas3d.style.cursor = p.hit ? CURSORS[p.hit.kind] : CURSORS.bg;
  if (p.pinch) return;
  if (p.moved < 10) {
    if (!p.hit) return;
    if (p.hit.kind === "crown") {
      ui.crownPress();
      crownPressT = 0.16;
    } else if (p.hit.kind === "side") {
      const now = performance.now();
      if (now - lastSideClick < 420) { ui.sideDouble(); lastSideClick = 0; }
      else { ui.sidePress(); lastSideClick = now; }
      sidePressT = 0.16;
    } else if (p.hit.kind === "screen" && !p.swiped) {
      const c = toScreenXY(p.hit.uv);
      ui.tap(c.x, c.y);
    }
  } else if (!p.hit && (p.vx || p.vy)) {
    // inertia after a background drag
    orbit.vTheta = -p.vx * 0.006;
    orbit.vPhi = -p.vy * 0.006;
  }
});
canvas3d.addEventListener("pointercancel", (e) => pointers.delete(e.pointerId));
canvas3d.addEventListener("pointerleave", () => { $("tooltip").classList.add("hidden"); });

canvas3d.addEventListener("wheel", (e) => {
  e.preventDefault();
  orbit.lastInteract = performance.now();
  if (hoverName === "crown") {
    const dir = e.deltaY > 0 ? 1 : -1;
    ui.crownScroll(dir);
    crownSpinTarget += dir * 1.1;
  } else {
    orbit.dist = clamp(orbit.dist * Math.exp(e.deltaY * 0.0011), 110, 480);
  }
}, { passive: false });

window.addEventListener("contextmenu", (e) => e.preventDefault());

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------
let AC = null, soundOn = true;
function playSound(name) {
  if (!soundOn) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    const t = AC.currentTime;
    const tone = (freq, type, dur, gain, delay = 0, slide = 0) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t + delay);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + delay + dur);
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(gain, t + delay + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
      o.connect(g).connect(AC.destination);
      o.start(t + delay); o.stop(t + delay + dur + 0.03);
    };
    switch (name) {
      case "click": tone(2400, "sine", 0.04, 0.09); tone(1500, "sine", 0.05, 0.05, 0.012); break;
      case "tick": tone(1800, "square", 0.025, 0.035); break;
      case "chime": tone(880, "sine", 0.3, 0.06); tone(1320, "sine", 0.4, 0.04, 0.06); break;
      case "error": tone(200, "square", 0.2, 0.07); break;
      case "pay": tone(1200, "sine", 0.12, 0.08); tone(1800, "sine", 0.28, 0.06, 0.1); break;
      case "ping": tone(1300, "sine", 0.5, 0.05, 0, 2800); break;
      case "unlock": tone(700, "sine", 0.18, 0.07); tone(1050, "sine", 0.3, 0.06, 0.08); break;
      case "timer": tone(988, "sine", 0.25, 0.08); tone(988, "sine", 0.25, 0.08, 0.35); tone(1319, "sine", 0.4, 0.06, 0.7); break;
    }
  } catch { /* audio unavailable */ }
}

// ---------------------------------------------------------------------------
// HUD wiring
// ---------------------------------------------------------------------------
const prefs = safeStore.get("aw3d-prefs", { case: "silver", band: 0, face: 0 });
let currentCase = prefs.case || "silver";
let bandIndex = clamp(prefs.band | 0, 0, bandColors.length - 1);
ui.faceIndex = clamp(prefs.face | 0, 0, 4);
ui.battery = safeStore.get("aw3d-battery", 86);
applyCaseStyle(currentCase);
applyBandStyle(bandIndex);
soundOn = !!safeStore.get("aw3d-sound", true);
$("switchSound").checked = soundOn;
$("switchAuto").checked = orbit.auto;

function savePrefs() {
  safeStore.set("aw3d-prefs", { case: currentCase, band: bandIndex, face: ui.faceIndex });
}
function applyCaseStyle(id) {
  currentCase = id;
  const st = caseStyles[id] || caseStyles.silver;
  caseMat.color.setHex(st.color);
  caseMat.metalness = st.metalness;
  caseMat.roughness = st.roughness;
  crownMat.color.setHex(st.color);
  crownMat.metalness = st.metalness;
  crownMat.roughness = st.roughness;
  document.querySelectorAll(".case-swatch").forEach((b) => b.classList.toggle("active", b.dataset.case === id));
  savePrefs();
}
function applyBandStyle(i) {
  bandIndex = i;
  bandMat.color.set(bandColors[i]);
  document.querySelectorAll(".band-swatch").forEach((b) => b.classList.toggle("active", +b.dataset.band === i));
  savePrefs();
}

document.querySelectorAll(".case-swatch").forEach((b) =>
  b.addEventListener("click", () => { applyCaseStyle(b.dataset.case); playSound("click"); })
);
document.querySelectorAll(".band-swatch").forEach((b) =>
  b.addEventListener("click", () => { applyBandStyle(+b.dataset.band); playSound("click"); })
);

$("btnCrown").addEventListener("click", () => { ui.crownPress(); crownPressT = 0.16; });
$("btnSide").addEventListener("click", () => { ui.sidePress(); sidePressT = 0.16; });
$("btnFacePrev").addEventListener("click", () => { ui.faceSwitch(-1); crownSpinTarget -= 1.1; });
$("btnFaceNext").addEventListener("click", () => { ui.faceSwitch(1); crownSpinTarget += 1.1; });
$("btnReset").addEventListener("click", resetView);
$("btnNotify").addEventListener("click", () => {
  const pool = [
    { app: "Messages", title: "Sarah", body: "Are we still on for dinner tonight?", color: "#30d158", ic: "messages" },
    { app: "Activity", title: "Activity", body: "You're close! 12 more minutes to close your Exercise ring.", color: "#fa114f", ic: "activity" },
    { app: "Weather", title: "Weather", body: "Rain starting in 20 minutes in Cupertino.", color: "#0a84ff", ic: "weather" },
    { app: "Calendar", title: "Calendar", body: "Design review in 15 minutes — Room 4B.", color: "#ff375f", ic: "calendar" },
  ];
  ui.pushNotification(pool[Math.floor(Math.random() * pool.length)]);
  showToast("Notification sent to the watch");
});
$("btnCharge").addEventListener("click", () => { ui.recharge(); showToast("Battery recharged to 100%"); });
$("switchAuto").addEventListener("change", (e) => { orbit.auto = e.target.checked; showToast(orbit.auto ? "Auto-rotate on" : "Auto-rotate off"); });
$("switchSound").addEventListener("change", (e) => {
  soundOn = e.target.checked;
  ui.settings.sounds = soundOn;
  safeStore.set("aw3d-settings", ui.settings);
  safeStore.set("aw3d-sound", soundOn);
  if (soundOn) playSound("chime");
});
$("btnFullscreen").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
});
$("btnHelp").addEventListener("click", () => $("helpModal").classList.remove("hidden"));
$("btnPanel").addEventListener("click", () => document.body.classList.toggle("panel-open"));
$("btnPanelClose").addEventListener("click", () => document.body.classList.remove("panel-open"));
$("helpClose").addEventListener("click", () => { $("helpModal").classList.add("hidden"); safeStore.set("aw3d-help", true); });
$("helpModal").addEventListener("click", (e) => { if (e.target === $("helpModal")) $("helpModal").classList.add("hidden"); });

if (!safeStore.get("aw3d-help", false)) $("helpModal").classList.remove("hidden");
if (innerWidth > 860) document.body.classList.add("panel-open");

window.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  switch (e.key.toLowerCase()) {
    case "f": case "arrowright": ui.crownScroll(1); crownSpinTarget += 1.1; break;
    case "arrowleft": ui.crownScroll(-1); crownSpinTarget -= 1.1; break;
    case "c": ui.crownPress(); crownPressT = 0.16; break;
    case "s": ui.sidePress(); sidePressT = 0.16; break;
    case "a": $("switchAuto").click(); break;
    case "r": resetView(); break;
    case "m": $("switchSound").click(); break;
    case "h": $("btnHelp").click(); break;
  }
});

let toastTimer = null;
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.classList.add("hidden"), 300); }, 1900);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
let lastUiDraw = 0, lastHud = 0, batteryAcc = 0, lastSave = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const now = performance.now();

  // UI (screen canvas) at ~30 fps
  if (now - lastUiDraw > 33) {
    ui.tick((now - lastUiDraw) / 1000, Date.now());
    lastUiDraw = now;
    screenTex.needsUpdate = true;
  }

  // light follows screen state
  const L = ui.getLight();
  screenGlow.intensity = L.level;
  screenGlow.color.set(L.color);
  const sOn = ui.getSensorOn();
  sensorLed.material.emissiveIntensity = sOn ? 0.8 + 0.9 * Math.abs(Math.sin(now * 0.008)) : 0.05;

  // camera
  if (resetTween) {
    resetTween.t += dt;
    const f = Math.min(resetTween.t / resetTween.dur, 1);
    const e = 1 - Math.pow(1 - f, 3);
    orbit.theta = lerp(resetTween.f0[0], resetTween.f1[0], e);
    orbit.phi = lerp(resetTween.f0[1], resetTween.f1[1], e);
    orbit.dist = lerp(resetTween.f0[2], resetTween.f1[2], e);
    if (f >= 1) resetTween = null;
  } else {
    if (orbit.auto && now - orbit.lastInteract > 4000 && pointers.size === 0) {
      orbit.theta += dt * 0.14;
    } else {
      orbit.theta += orbit.vTheta * dt;
      orbit.phi = clamp(orbit.phi + orbit.vPhi * dt, 0.18, Math.PI - 0.2);
      orbit.vTheta *= Math.pow(0.001, dt);
      orbit.vPhi *= Math.pow(0.001, dt);
    }
  }
  applyCamera();

  // crown / button animations
  crownSpin += (crownSpinTarget - crownSpin) * Math.min(1, dt * 14);
  crownCap.rotation.x = crownSpin;
  if (crownPressT > 0) {
    crownPressT -= dt;
    const f = crownPressT > 0 ? crownPressT / 0.16 : 0;
    crownGroup.position.x = -Math.sin((1 - f) * Math.PI) * 0.45;
  }
  if (sidePressT > 0) {
    sidePressT -= dt;
    const f = sidePressT > 0 ? sidePressT / 0.16 : 0;
    sideGroup.position.x = -Math.sin((1 - f) * Math.PI) * 0.4;
  }

  // battery drain (~1% every 75 s)
  batteryAcc += dt;
  if (batteryAcc > 75) {
    batteryAcc = 0;
    ui.setBattery(ui.battery - 1);
  }
  if (now - lastSave > 5000) {
    lastSave = now;
    safeStore.set("aw3d-battery", ui.battery);
    savePrefs();
  }

  // HUD status
  if (now - lastHud > 250) {
    lastHud = now;
    const hud = ui.hud();
    $("statusFace").textContent = "Face: " + hud.face;
    $("statusState").textContent = hud.stateLabel;
    $("statusBattery").textContent = hud.battery + "%";
    $("faceName").textContent = hud.face;
    const d = new Date();
    $("statusClock").textContent = `${d.getHours()}:${pad2(d.getMinutes())}`;
    if ($("statusState").dataset.s !== hud.state) {
      $("statusState").dataset.s = hud.state;
      $("statusState").classList.remove("pop");
      void $("statusState").offsetWidth;
      $("statusState").classList.add("pop");
    }
  }

  renderer.render(scene, camera);
}
function pad2(n) { return String(n).padStart(2, "0"); }

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
renderer.setSize(innerWidth, innerHeight, false);

showToast("Drag to rotate · scroll to zoom · scroll over the crown to change faces");
animate();
