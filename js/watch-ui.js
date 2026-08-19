// ============================================================================
// watch-ui.js — a watchOS-style interface rendered onto a 2D canvas.
// Pure logic + canvas drawing. No DOM access (storage is safely wrapped).
// ============================================================================

export const W = 480, H = 394;
const TAU = Math.PI * 2;
const FONT = `-apple-system, "SF Pro Display", "Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif`;
const SERIF = `Georgia, "Times New Roman", "Times", serif`;

// ---------- safe storage (works even when localStorage is blocked) ----------
export const safeStore = {
  mem: {},
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return k in this.mem ? this.mem[k] : d;
    }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { this.mem[k] = v; }
  },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const pad = (n) => String(n).padStart(2, "0");

// ---------- drawing helpers ----------
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, color) { rr(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }
function circle(ctx, x, y, r, color) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = color; ctx.fill(); }
function ring(ctx, x, y, r, w, color, a0 = -Math.PI / 2, a1 = Math.PI * 1.5) {
  ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.stroke();
}
function text(ctx, s, x, y, size, color, o = {}) {
  ctx.font = `${o.w || 400} ${size}px ${o.serif ? SERIF : FONT}`;
  ctx.fillStyle = color; ctx.textAlign = o.a || "left"; ctx.textBaseline = o.b || "alphabetic";
  ctx.fillText(s, x, y);
}
function vGrad(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}
function rGrad(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [p, c] of stops) g.addColorStop(p, c);
  return g;
}
function hexRgb(h) {
  h = h.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function mix(c1, c2, t) {
  const a = hexRgb(c1), b = hexRgb(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

// ---------- vector icon set ----------
function icon(ctx, name, x, y, r, color) {
  ctx.save(); ctx.translate(x, y); ctx.lineCap = "round"; ctx.lineJoin = "round";
  const c = color || "#fff";
  switch (name) {
    case "activity":
      ring(ctx, 0, 0, r * 0.95, r * 0.30, "#fa114f"); ring(ctx, 0, 0, r * 0.60, r * 0.30, "#30d158"); ring(ctx, 0, 0, r * 0.25, r * 0.30, "#0a84ff"); break;
    case "calc": {
      const s = r * 0.34, o = r * 0.40;
      fillRR(ctx, -o - s / 2, -o - s / 2, s, s, s * 0.3, c); fillRR(ctx, o - s / 2, -o - s / 2, s, s, s * 0.3, c);
      fillRR(ctx, -o - s / 2, o - s / 2, s, s, s * 0.3, c); fillRR(ctx, o - s / 2, o - s / 2, s, s, s * 0.3, c);
      break;
    }
    case "timer":
      ring(ctx, 0, 0, r * 0.8, r * 0.2, c);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.34, -r * 0.45); ctx.strokeStyle = c; ctx.lineWidth = r * 0.2; ctx.stroke();
      fillRR(ctx, -r * 0.16, -r * 0.86, r * 0.32, r * 0.18, r * 0.08, c);
      break;
    case "heart":
      ctx.beginPath();
      ctx.moveTo(0, r * 0.75);
      ctx.bezierCurveTo(-r * 1.05, r * 0.08, -r * 0.55, -r * 0.78, 0, -r * 0.25);
      ctx.bezierCurveTo(r * 0.55, -r * 0.78, r * 1.05, r * 0.08, 0, r * 0.75);
      ctx.fillStyle = c; ctx.fill();
      break;
    case "sun":
      circle(ctx, 0, 0, r * 0.4, c);
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.1;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58); ctx.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); ctx.stroke();
      }
      break;
    case "cloud":
      ctx.fillStyle = c;
      circle(ctx, -r * 0.25, r * 0.1, r * 0.3, c); circle(ctx, r * 0.05, -r * 0.05, r * 0.4, c); circle(ctx, r * 0.38, r * 0.12, r * 0.26, c);
      fillRR(ctx, -r * 0.45, r * 0.05, r * 0.95, r * 0.32, r * 0.16, c);
      break;
    case "rain":
      icon(ctx, "cloud", 0, -r * 0.15, r * 0.8, c);
      ctx.strokeStyle = "#64d2ff"; ctx.lineWidth = r * 0.12;
      for (const [dx, dy] of [[-0.5, 0.55], [0, 0.8], [0.5, 0.55]]) {
        ctx.beginPath(); ctx.moveTo(dx * r, dy * r); ctx.lineTo(dx * r - r * 0.14, dy * r + r * 0.34); ctx.stroke();
      }
      break;
    case "weather": {
      circle(ctx, -r * 0.18, -r * 0.22, r * 0.3, c);
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.09;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath(); ctx.moveTo(-r * 0.18 + Math.cos(a) * r * 0.45, -r * 0.22 + Math.sin(a) * r * 0.45); ctx.lineTo(-r * 0.18 + Math.cos(a) * r * 0.6, -r * 0.22 + Math.sin(a) * r * 0.6); ctx.stroke();
      }
      ctx.fillStyle = c;
      circle(ctx, r * 0.12, r * 0.3, r * 0.3, c); circle(ctx, r * 0.42, r * 0.18, r * 0.26, c);
      fillRR(ctx, -r * 0.3, r * 0.12, r * 0.86, r * 0.3, r * 0.15, c);
      break;
    }
    case "moon": {
      ctx.beginPath();
      ctx.arc(-r * 0.08, 0, r * 0.62, 0, TAU);
      ctx.arc(r * 0.22, 0, r * 0.55, Math.PI * 0.9, Math.PI * 2.3, true);
      ctx.fillStyle = c; ctx.fill();
      break;
    }
    case "music":
      circle(ctx, r * 0.25, r * 0.45, r * 0.24, c);
      ctx.beginPath(); ctx.moveTo(r * 0.45, r * 0.42); ctx.lineTo(r * 0.45, -r * 0.5); ctx.lineTo(-r * 0.15, -r * 0.5);
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.16; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.42, -r * 0.5); ctx.lineTo(r * 0.62, -r * 0.28); ctx.stroke();
      break;
    case "messages":
      rr(ctx, -r * 0.62, -r * 0.5, r * 1.24, r * 1.0, r * 0.34); ctx.fillStyle = c; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * 0.42, r * 0.44); ctx.lineTo(-r * 0.42, r * 0.8); ctx.lineTo(r * 0.1, r * 0.44); ctx.closePath(); ctx.fill();
      break;
    case "photos": {
      const cs = ["#ffd60a", "#ff9f0a", "#ff375f", "#bf5af2", "#0a84ff", "#30d158"];
      circle(ctx, 0, -r * 0.25, r * 0.45, cs[0]); circle(ctx, r * 0.22, r * 0.02, r * 0.38, cs[3]);
      circle(ctx, r * 0.2, r * 0.28, r * 0.34, cs[5]); circle(ctx, -r * 0.24, r * 0.18, r * 0.36, cs[4]);
      circle(ctx, -r * 0.02, -r * 0.4, r * 0.3, cs[1]);
      break;
    }
    case "breathe":
      for (const f of [0.95, 0.66, 0.37]) ring(ctx, 0, 0, r * f, r * 0.14, c);
      break;
    case "settings":
      ring(ctx, 0, 0, r * 0.42, r * 0.18, c);
      for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate((i / 8) * TAU); fillRR(ctx, -r * 0.1, -r * 0.85, r * 0.2, r * 0.3, r * 0.05, c); ctx.restore(); }
      break;
    case "compass":
      ring(ctx, 0, 0, r * 0.92, r * 0.12, c);
      ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.22, 0); ctx.lineTo(0, r * 0.12); ctx.closePath(); ctx.fillStyle = "#ff453a"; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, r * 0.7); ctx.lineTo(-r * 0.22, 0); ctx.lineTo(0, -r * 0.12); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      circle(ctx, 0, 0, r * 0.08, "#ffd60a");
      break;
    case "workout":
      fillRR(ctx, -r * 0.85, -r * 0.5, r * 0.3, r * 1.0, r * 0.12, c);
      fillRR(ctx, r * 0.55, -r * 0.5, r * 0.3, r * 1.0, r * 0.12, c);
      fillRR(ctx, -r * 0.55, -r * 0.14, r * 1.1, r * 0.28, r * 0.12, c);
      break;
    case "wallet":
      rr(ctx, -r * 0.7, -r * 0.5, r * 1.4, r * 1.0, r * 0.22); ctx.fillStyle = c; ctx.fill();
      fillRR(ctx, -r * 0.7, -r * 0.5, r * 1.4, r * 0.32, r * 0.16, "rgba(0,0,0,0.35)");
      break;
    case "wifi":
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.16;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, -r * 0.15, r * (0.35 + i * 0.23), Math.PI * 1.18, Math.PI * 1.82); ctx.stroke(); }
      circle(ctx, 0, r * 0.55, r * 0.12, c);
      break;
    case "airplane":
      ctx.beginPath();
      ctx.moveTo(r * 0.55, -r * 0.55); ctx.lineTo(-r * 0.1, -r * 0.2); ctx.lineTo(-r * 0.25, -r * 0.55); ctx.lineTo(-r * 0.42, -r * 0.45);
      ctx.lineTo(-r * 0.25, r * 0.02); ctx.lineTo(-r * 0.6, r * 0.35); ctx.lineTo(-r * 0.75, r * 0.2); ctx.lineTo(-r * 0.55, r * 0.62);
      ctx.lineTo(-r * 0.15, r * 0.55); ctx.lineTo(-r * 0.05, r * 0.78); ctx.lineTo(r * 0.05, r * 0.72); ctx.lineTo(0, r * 0.5); ctx.lineTo(r * 0.3, r * 0.3);
      ctx.lineTo(r * 0.45, r * 0.15); ctx.lineTo(r * 0.3, r * 0.12); ctx.lineTo(r * 0.28, r * 0.35); ctx.lineTo(r * 0.55, r * 0.42); ctx.lineTo(r * 0.55, -r * 0.55);
      ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      break;
    case "flashlight":
      fillRR(ctx, -r * 0.3, -r * 0.55, r * 0.6, r * 0.55, r * 0.12, c);
      ctx.beginPath(); ctx.moveTo(-r * 0.26, -r * 0.5); ctx.lineTo(-r * 0.8, r * 0.4); ctx.lineTo(r * 0.8, r * 0.4); ctx.lineTo(r * 0.26, -r * 0.5); ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.fill();
      break;
    case "phone":
      rr(ctx, -r * 0.38, -r * 0.65, r * 0.76, r * 1.3, r * 0.18); ctx.strokeStyle = c; ctx.lineWidth = r * 0.14; ctx.stroke();
      fillRR(ctx, -r * 0.18, -r * 0.5, r * 0.36, r * 0.1, r * 0.05, c);
      break;
    case "bell":
      ctx.beginPath();
      ctx.arc(0, r * 0.2, r * 0.62, Math.PI * 0.95, Math.PI * 2.05);
      ctx.quadraticCurveTo(-r * 0.62, -r * 0.5, 0, -r * 0.45);
      ctx.quadraticCurveTo(r * 0.62, -r * 0.5, r * 0.62, r * 0.2);
      ctx.fillStyle = c; ctx.fill();
      fillRR(ctx, -r * 0.22, r * 0.62, r * 0.44, r * 0.16, r * 0.08, c);
      circle(ctx, 0, r * 0.9, r * 0.1, c);
      break;
    case "battery":
      rr(ctx, -r * 0.72, -r * 0.45, r * 1.3, r * 0.9, r * 0.22); ctx.strokeStyle = c; ctx.lineWidth = r * 0.13; ctx.stroke();
      fillRR(ctx, r * 0.6, -r * 0.13, r * 0.16, r * 0.26, r * 0.05, c);
      break;
    case "drop":
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.bezierCurveTo(r * 0.6, -r * 0.1, r * 0.55, r * 0.55, 0, r * 0.7);
      ctx.bezierCurveTo(-r * 0.55, r * 0.55, -r * 0.6, -r * 0.1, 0, -r * 0.7);
      ctx.fillStyle = c; ctx.fill();
      break;
    case "check":
      ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(-r * 0.15, r * 0.45); ctx.lineTo(r * 0.6, -r * 0.4);
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.18; ctx.stroke();
      break;
    case "close":
      ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.45); ctx.lineTo(r * 0.45, r * 0.45);
      ctx.moveTo(r * 0.45, -r * 0.45); ctx.lineTo(-r * 0.45, r * 0.45);
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.18; ctx.stroke();
      break;
    case "chevL":
      ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.55); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(r * 0.2, r * 0.55);
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.2; ctx.stroke();
      break;
    case "chevR":
      ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.55); ctx.lineTo(r * 0.35, 0); ctx.lineTo(-r * 0.2, r * 0.55);
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.2; ctx.stroke();
      break;
    case "play":
      ctx.beginPath(); ctx.moveTo(-r * 0.35, -r * 0.55); ctx.lineTo(r * 0.55, 0); ctx.lineTo(-r * 0.35, r * 0.55); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      break;
    case "pause":
      fillRR(ctx, -r * 0.5, -r * 0.55, r * 0.38, r * 1.1, r * 0.08, c);
      fillRR(ctx, r * 0.12, -r * 0.55, r * 0.38, r * 1.1, r * 0.08, c);
      break;
    case "next":
      ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.5); ctx.lineTo(r * 0.15, 0); ctx.lineTo(-r * 0.45, r * 0.5); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      fillRR(ctx, r * 0.22, -r * 0.5, r * 0.16, r * 1.0, r * 0.05, c);
      break;
    case "prev":
      ctx.beginPath(); ctx.moveTo(r * 0.45, -r * 0.5); ctx.lineTo(-r * 0.15, 0); ctx.lineTo(r * 0.45, r * 0.5); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      fillRR(ctx, -r * 0.38, -r * 0.5, r * 0.16, r * 1.0, r * 0.05, c);
      break;
    case "calendar":
      rr(ctx, -r * 0.6, -r * 0.5, r * 1.2, r * 1.0, r * 0.18); ctx.strokeStyle = c; ctx.lineWidth = r * 0.12; ctx.stroke();
      fillRR(ctx, -r * 0.6, -r * 0.5, r * 1.2, r * 0.28, r * 0.12, c);
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.8); ctx.lineTo(-r * 0.3, -r * 0.42); ctx.moveTo(r * 0.3, -r * 0.8); ctx.lineTo(r * 0.3, -r * 0.42); ctx.stroke();
      break;
  }
  ctx.restore();
}

// ---------- analog helpers ----------
function hand(ctx, cx, cy, angle, len, lw, color, tail = 0) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, lw * 0.9); ctx.lineTo(len, 0); ctx.lineTo(0, -lw * 0.9);
  if (tail) ctx.lineTo(-tail, 0);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
function ticks(ctx, cx, cy, r, n, len, lw, color, every = 5, majorLen, majorLw) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2;
    const major = i % every === 0;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - (major ? majorLen : len)), cy + Math.sin(a) * (r - (major ? majorLen : len)));
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.strokeStyle = color; ctx.lineWidth = major ? majorLw : lw; ctx.stroke();
  }
}
function activityRings(ctx, x, y, r, lw, fr) {
  ring(ctx, x, y, r, lw, "#3a3a3c");
  if (fr.move > 0.001) ring(ctx, x, y, r, lw, "#fa114f", -Math.PI / 2, -Math.PI / 2 + fr.move * TAU);
  ring(ctx, x, y, r * 0.73, lw, "#3a3a3c");
  if (fr.ex > 0.001) ring(ctx, x, y, r * 0.73, lw, "#30d158", -Math.PI / 2, -Math.PI / 2 + fr.ex * TAU);
  ring(ctx, x, y, r * 0.46, lw, "#3a3a3c");
  if (fr.std > 0.001) ring(ctx, x, y, r * 0.46, lw, "#0a84ff", -Math.PI / 2, -Math.PI / 2 + fr.std * TAU);
}

// ============================================================================
// WATCH FACES
// ============================================================================
const FACES = [
  {
    id: "infograph", name: "Infograph", accent: "#ff9f0a",
    draw(S, ctx) {
      const P = S.parts, cx = 240, cy = 197;
      ticks(ctx, cx, cy, 132, 60, 4.5, 1, "#7c7e84", 5, 9, 2.4);
      // corner complications
      const corners = [[52, 62], [428, 62], [52, 332], [428, 332]];
      const cfn = [
        () => { text(ctx, S.dayShort().toUpperCase(), 52, 56, 11, "#9a9ca1", { a: "center", w: 600 }); text(ctx, String(S.now.getDate()), 52, 82, 24, "#fff", { a: "center", w: 600 }); },
        () => activityRings(ctx, 428, 62, 16, 4.5, { move: 0.86, ex: 0.75, std: 0.83 }),
        () => { icon(ctx, "sun", 52, 332, 11, "#ffd60a"); text(ctx, S.weatherTemp() + "°", 74, 338, 18, "#fff", { w: 500 }); },
        () => { icon(ctx, "battery", 428, 332, 10, "#30d158"); text(ctx, Math.round(S.battery) + "%", 398, 338, 18, "#fff", { a: "right", w: 500 }); },
      ];
      cfn.forEach((f, i) => { const [x, y] = corners[i]; ctx.save(); ctx.translate(x, y); f(); ctx.restore(); });
      // inner complications
      const inner = [
        { x: cx - 64, y: cy - 64, ic: "messages", v: "3" },
        { x: cx + 64, y: cy - 64, ic: "heart", v: "72" },
        { x: cx - 64, y: cy + 64, ic: "timer", v: "3:00" },
        { x: cx + 64, y: cy + 64, ic: "sun", v: "UV 4" },
      ];
      for (const it of inner) {
        icon(ctx, it.ic, it.x, it.y, 11, it.ic === "sun" ? "#ffd60a" : it.ic === "heart" ? "#ff375f" : "#ff9f0a");
        text(ctx, it.v, it.x + 18, it.y + 5, 13, "#fff", { w: 500 });
      }
      // hands
      const ang = (v) => (v / 60) * TAU - Math.PI / 2;
      hand(ctx, cx, cy, ang(((P.h % 12) + P.m / 60) * 5), 50, 6, "#fff");
      hand(ctx, cx, cy, ang(P.m + P.s / 60), 80, 5, "#fff");
      hand(ctx, cx, cy, ang(P.s + P.ms / 1000), 90, 1.8, "#ff9f0a", 14);
      circle(ctx, cx, cy, 4.2, "#ff9f0a"); circle(ctx, cx, cy, 2, "#111");
    },
  },
  {
    id: "modular", name: "Modular", accent: "#ff9f0a",
    draw(S, ctx) {
      const P = S.parts;
      const box = (x, y, w, h) => { rr(ctx, x, y, w, h, 14); ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1; ctx.stroke(); };
      box(24, 46, 118, 64); box(338, 46, 118, 64);
      box(130, 128, 220, 118);
      box(24, 286, 132, 80); box(174, 286, 132, 80); box(324, 286, 132, 80);
      text(ctx, S.dayShort().toUpperCase(), 40, 66, 11, "#9a9ca1", { w: 600 });
      text(ctx, String(S.now.getDate()), 40, 94, 24, "#fff", { w: 600 });
      text(ctx, S.time12(), 448, 100, 54, "#fff", { a: "right", w: 300 });
      activityRings(ctx, 240, 187, 34, 7, { move: 0.86, ex: 0.75, std: 0.83 });
      text(ctx, "68%", 240, 193, 15, "#fff", { a: "center", w: 600 });
      text(ctx, "MOVE", 240, 226, 9, "#9a9ca1", { a: "center", w: 700 });
      const cells = [
        { ic: "sun", t: S.weatherTemp() + "°", c: "#ffd60a" },
        { ic: "heart", t: "72 BPM", c: "#ff375f" },
        { ic: "timer", t: "3:00", c: "#ff9f0a" },
      ];
      cells.forEach((c, i) => {
        const x = 90 + i * 150;
        icon(ctx, c.ic, x - 22, 326, 13, c.c);
        text(ctx, c.t, x, 332, 16, "#fff", { w: 500 });
      });
    },
  },
  {
    id: "california", name: "California", accent: "#ff3b30",
    draw(S, ctx) {
      const P = S.parts, cx = 240, cy = 197;
      ring(ctx, cx, cy, 133, 1.6, "rgba(255,255,255,0.25)");
      ticks(ctx, cx, cy, 96, 60, 3, 1, "rgba(255,255,255,0.35)", 5, 6, 1.8);
      for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * TAU - Math.PI / 2;
        const major = i % 3 === 0;
        text(ctx, String(i), cx + Math.cos(a) * 108, cy + Math.sin(a) * 108 + (major ? 10 : 5), major ? 26 : 14, major ? "#f2f2f4" : "#a9abb0", { a: "center", serif: true });
      }
      text(ctx, "CALIFORNIA", cx, cy + 74, 8.5, "rgba(255,255,255,0.5)", { a: "center", w: 600 });
      const ang = (v) => (v / 60) * TAU - Math.PI / 2;
      hand(ctx, cx, cy, ang(((P.h % 12) + P.m / 60) * 5), 44, 6, "#fff");
      hand(ctx, cx, cy, ang(P.m + P.s / 60), 74, 5, "#fff");
      hand(ctx, cx, cy, ang(P.s + P.ms / 1000), 84, 1.6, "#ff3b30", 13);
      circle(ctx, cx, cy, 3, "#ff3b30");
    },
  },
  {
    id: "solar", name: "Solar", accent: "#ffd60a",
    draw(S, ctx) {
      const P = S.parts;
      const t = clamp((P.h + P.m / 60 - 6) / 12.5, 0, 1);
      // sky
      const keys = [[0, "#0a0d2a", "#241a3d"], [0.14, "#31417e", "#d97f4a"], [0.38, "#3f7fd9", "#a8d8f0"], [0.62, "#3f7fd9", "#cfe8f7"], [0.86, "#5b3f8e", "#f08a4a"], [1, "#0a0d2a", "#241a3d"]];
      let top = "#000", bot = "#000";
      for (let i = 0; i < keys.length - 1; i++) {
        if (t >= keys[i][0] && t <= keys[i + 1][0]) {
          const f = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
          top = mix(keys[i][1], keys[i + 1][1], f); bot = mix(keys[i][2], keys[i + 1][2], f);
        }
      }
      ctx.fillStyle = vGrad(ctx, 0, 0, 0, H, [[0, top], [1, bot]]);
      ctx.fillRect(0, 0, W, H);
      // stars
      const dark = t < 0.16 ? 1 - t / 0.16 : t > 0.84 ? (t - 0.84) / 0.16 : 0;
      if (dark > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${(dark * 0.8).toFixed(2)})`;
        for (let i = 0; i < 60; i++) {
          const sx = ((i * 137.5 + 51) % 480), sy = ((i * 89.3 + 13) % 240);
          ctx.fillRect(sx, sy, 1.4, 1.4);
        }
      }
      // sun path
      const a = Math.PI * (1 - t);
      const sx = 240 - Math.cos(a) * 172, sy = 296 - Math.sin(a) * 126;
      ctx.fillStyle = rGrad(ctx, sx, sy, 62, [[0, "rgba(255,220,120,0.5)"], [1, "rgba(255,220,120,0)"]]);
      ctx.beginPath(); ctx.arc(sx, sy, 62, 0, TAU); ctx.fill();
      ctx.fillStyle = rGrad(ctx, sx, sy, 24, [[0, "#fff6d8"], [0.7, "#ffd60a"], [1, "#ff9f0a"]]);
      ctx.beginPath(); ctx.arc(sx, sy, 24, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.6; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.ellipse(240, 296, 172, 126, 0, Math.PI, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(240, 296, 172, 126, 0, Math.PI, Math.PI * 1.999); ctx.stroke();
      // digital time
      text(ctx, S.time12(), 240, 356, 40, "#fff", { a: "center", w: 300 });
      text(ctx, S.dayShort() + " " + S.now.getDate(), 240, 378, 12, "rgba(255,255,255,0.75)", { a: "center", w: 500 });
    },
  },
  {
    id: "chrono", name: "Chronograph", accent: "#ff9f0a",
    draw(S, ctx) {
      const P = S.parts, cx = 240, cy = 197;
      const C = S.faceData.chrono;
      // tachymeter labels
      const labels = [["400", 0], ["240", 1], ["160", 2], ["120", 3], ["80", 4], ["60", 5], ["40", 6], ["30", 7]];
      ring(ctx, cx, cy, 133, 1.4, "rgba(255,255,255,0.25)");
      for (const [l, i] of labels) {
        const a = (i / 8) * TAU - Math.PI / 2;
        text(ctx, l, cx + Math.cos(a) * 121, cy + Math.sin(a) * 121 + 3, 8.5, "#8a8c92", { a: "center", w: 500 });
      }
      ticks(ctx, cx, cy, 110, 60, 3, 1, "rgba(255,255,255,0.4)", 5, 7, 2);
      // subdials
      const sub = (x, y, r, n, val, major) => {
        ring(ctx, x, y, r, 1, "rgba(255,255,255,0.22)");
        ticks(ctx, x, y, r - 2, n, 2, 0.7, "rgba(255,255,255,0.3)", major, 4, 1.2);
        hand(ctx, x, y, (val / n) * TAU - Math.PI / 2, r - 5, 1.6, "#e6e7ea");
        circle(ctx, x, y, 1.4, "#e6e7ea");
      };
      sub(cx - 72, cy, 27, 60, P.s + P.ms / 1000, 5); // running seconds
      sub(cx + 72, cy, 27, 30, C.running ? (C.ms / 60000) % 30 : 0, 5); // chrono minutes
      // main hands
      const ang = (v) => (v / 60) * TAU - Math.PI / 2;
      hand(ctx, cx, cy, ang(((P.h % 12) + P.m / 60) * 5), 40, 5.4, "#fff");
      hand(ctx, cx, cy, ang(P.m + P.s / 60), 62, 4, "#fff");
      const cs = (C.running ? C.ms : 0) / 1000 % 60;
      hand(ctx, cx, cy, ang(cs), 98, 1.8, "#ff9f0a", 16);
      circle(ctx, cx, cy, 3.6, "#ff9f0a"); circle(ctx, cx, cy, 1.7, "#111");
      if (!C.running && C.ms === 0) {
        text(ctx, "Tap to start", cx, cy + 96, 10, "rgba(255,255,255,0.45)", { a: "center" });
      }
    },
  },
];

// ============================================================================
// APPS
// ============================================================================
const APPS = [
  {
    id: "calc", name: "Calculator", color: "#ff9f0a", icon: "calc",
    enter(S, A) { A.disp = "0"; A.acc = null; A.op = null; A.fresh = true; },
    draw(S, ctx, A) {
      S.chrome(ctx, "Calculator", "#ff9f0a");
      const fmt = (n) => {
        if (!isFinite(n)) return "Err";
        let s = String(Math.round(n * 1e8) / 1e8);
        if (s.length > 9) s = Number(n).toExponential(4);
        return s;
      };
      const sym = { add: "+", sub: "−", mul: "×", div: "÷" };
      if (A.acc !== null && A.op) text(ctx, `${fmt(A.acc)} ${sym[A.op]}`, 464, 70, 15, "#8e8e93", { a: "right" });
      text(ctx, A.disp, 464, 114, A.disp.length > 8 ? 32 : 44, "#fff", { a: "right", w: 300 });
      const rows = [
        ["C", "neg", "pct", "div"],
        ["7", "8", "9", "mul"],
        ["4", "5", "6", "sub"],
        ["1", "2", "3", "add"],
        ["0", null, "dot", "eq"],
      ];
      const bw = 106, bh = 38, gap = 8, m = 16;
      const labels = { C: "C", neg: "±", pct: "%", div: "÷", mul: "×", sub: "−", add: "+", dot: ".", eq: "=" };
      rows.forEach((row, ri) => {
        const y = 128 + ri * (bh + gap);
        let x = m;
        row.forEach((id, ci) => {
          if (!id) { x += bw + gap; return; }
          const w = id === "0" ? bw * 2 + gap : bw;
          const isOp = ["div", "mul", "sub", "add", "eq"].includes(id);
          const isFn = ["C", "neg", "pct"].includes(id);
          fillRR(ctx, x, y, w, bh, 9, isOp ? "#ff9f0a" : isFn ? "#a5a5ab" : "#303033");
          text(ctx, labels[id] || id, x + w / 2, y + bh / 2 + 7, 19, isOp || !isFn ? "#fff" : "#000", { a: "center", w: 500 });
          S.addHit(id, x, y, w, bh);
          x += w + gap;
        });
      });
    },
    tap(S, A, id) {
      const num = (v) => parseFloat(v);
      const apply = (a, op, b) => (op === "add" ? a + b : op === "sub" ? a - b : op === "mul" ? a * b : op === "div" ? a / b : b);
      const fmt = (n) => (isFinite(n) ? String(Math.round(n * 1e8) / 1e8) : "Err");
      if (!isNaN(id)) {
        A.disp = A.fresh || A.disp === "0" ? id : A.disp === "Err" ? id : A.disp + id;
        if (A.disp.length > 10) A.disp = A.disp.slice(0, 10);
        A.fresh = false;
      } else if (id === "dot") {
        if (A.fresh) { A.disp = "0."; A.fresh = false; } else if (!A.disp.includes(".")) A.disp += ".";
      } else if (id === "C") { A.disp = "0"; A.acc = null; A.op = null; A.fresh = true; }
      else if (id === "neg") { A.disp = fmt(-num(A.disp)); A.fresh = false; }
      else if (id === "pct") { A.disp = fmt(num(A.disp) / 100); A.fresh = false; }
      else if (id === "eq") {
        if (A.op !== null && A.acc !== null) { A.disp = fmt(apply(A.acc, A.op, num(A.disp))); A.acc = null; A.op = null; A.fresh = true; }
      } else {
        if (A.op !== null && A.acc !== null && !A.fresh) { A.disp = fmt(apply(A.acc, A.op, num(A.disp))); }
        A.acc = num(A.disp); A.op = id; A.fresh = true;
      }
      S.sound("click");
    },
  },
  {
    id: "timer", name: "Timer", color: "#ff9f0a", icon: "timer",
    enter(S, A) { if (!A.dur) { A.dur = 300; A.left = 300; A.running = false; A.done = false; } },
    draw(S, ctx, A) {
      S.chrome(ctx, "Timer", "#ff9f0a");
      const frac = clamp(A.left / A.dur, 0, 1);
      ring(ctx, 240, 185, 102, 8, "#333336");
      ring(ctx, 240, 185, 102, 8, A.done ? "#30d158" : "#ff9f0a", -Math.PI / 2, -Math.PI / 2 + frac * TAU);
      const mm = Math.floor(A.left / 60), ss = Math.floor(A.left % 60);
      text(ctx, `${mm}:${pad(ss)}`, 240, 198, 52, "#fff", { a: "center", w: 300 });
      text(ctx, A.running ? "Running" : A.done ? "Time's up" : "Ready", 240, 226, 11, A.done ? "#30d158" : "#8e8e93", { a: "center", w: 500 });
      if (!A.running && !A.done) {
        const presets = [[1, "1 min"], [3, "3 min"], [5, "5 min"], [10, "10 min"]];
        presets.forEach(([mns, lb], i) => {
          const x = 30 + i * 108, w = 94;
          const sel = Math.round(A.dur / 60) === mns;
          fillRR(ctx, x, 258, w, 30, 15, sel ? "#ff9f0a" : "#2c2c2e");
          text(ctx, lb, x + w / 2, 278, 13, sel ? "#000" : "#fff", { a: "center", w: 600 });
          S.addHit("p" + mns, x, 258, w, 30);
        });
        circle(ctx, 240, 332, 34, "#ff9f0a");
        icon(ctx, "play", 242, 332, 15, "#000");
        S.addHit("start", 206, 298, 68, 68);
      } else if (A.running) {
        fillRR(ctx, 96, 320, 120, 36, 18, "#2c2c2e"); text(ctx, "Cancel", 156, 344, 14, "#fff", { a: "center", w: 600 });
        S.addHit("cancel", 96, 320, 120, 36);
        fillRR(ctx, 264, 320, 120, 36, 18, "#ff9f0a"); text(ctx, "Pause", 324, 344, 14, "#000", { a: "center", w: 600 });
        S.addHit("pause", 264, 320, 120, 36);
      } else {
        fillRR(ctx, 140, 320, 200, 36, 18, "#30d158"); text(ctx, "Dismiss", 240, 344, 14, "#000", { a: "center", w: 600 });
        S.addHit("dismiss", 140, 320, 200, 36);
      }
    },
    tick(S, A, dt) {
      if (A.running) {
        A.left -= dt;
        if (A.left <= 0) {
          A.left = 0; A.running = false; A.done = true;
          S.pushNotification({ app: "Timer", title: "Timer", body: "Your timer is done.", color: "#ff9f0a", ic: "timer" });
          S.sound("timer");
        }
      }
    },
    tap(S, A, id) {
      if (id === "start") { A.running = true; S.sound("tick"); }
      else if (id === "pause") { A.running = false; S.sound("tick"); }
      else if (id === "cancel") { A.left = A.dur; A.running = false; S.sound("tick"); }
      else if (id === "dismiss") { A.done = false; A.left = A.dur; S.sound("tick"); }
      else if (id.startsWith("p")) { A.dur = parseInt(id.slice(1)) * 60; A.left = A.dur; S.sound("tick"); }
    },
  },
  {
    id: "activity", name: "Activity", color: "#16171a", icon: "activity",
    enter(S, A) { A.t = 0; },
    draw(S, ctx, A) {
      S.chrome(ctx, "Activity", "#fa114f");
      const e = easeOut(clamp(A.t, 0, 1));
      const fr = { move: 0.86 * e, ex: 0.75 * e, std: 0.83 * e };
      activityRings(ctx, 240, 178, 112, 15, fr);
      text(ctx, "620", 240, 160, 30, "#fff", { a: "center", w: 600 });
      text(ctx, "ACTIVE CAL", 240, 178, 10, "#fa114f", { a: "center", w: 700 });
      text(ctx, "30", 178, 210, 16, "#30d158", { a: "center", w: 600 });
      text(ctx, "MIN", 178, 222, 8, "#8e8e93", { a: "center", w: 700 });
      text(ctx, "10", 302, 210, 16, "#0a84ff", { a: "center", w: 600 });
      text(ctx, "HRS", 302, 222, 8, "#8e8e93", { a: "center", w: 700 });
      fillRR(ctx, 24, 288, 206, 66, 14, "#1c1c1e");
      text(ctx, "6,842", 40, 316, 22, "#fff", { w: 600 });
      text(ctx, "STEPS", 40, 336, 10, "#8e8e93", { w: 700 });
      fillRR(ctx, 250, 288, 206, 66, 14, "#1c1c1e");
      text(ctx, "4.3", 266, 316, 22, "#fff", { w: 600 });
      text(ctx, "KM", 266, 336, 10, "#8e8e93", { w: 700 });
    },
    tick(S, A, dt) { if (A.t < 1) A.t += dt * 0.7; },
  },
  {
    id: "heart", name: "Heart Rate", color: "#ff375f", icon: "heart",
    enter(S, A) { A.t = 0; A.bpm = 72; A.measuring = 0; A.last = null; },
    draw(S, ctx, A) {
      S.chrome(ctx, "Heart Rate", "#ff375f");
      ctx.strokeStyle = "rgba(255,255,255,0.045)"; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, 340); ctx.stroke(); }
      for (let y = 60; y <= 340; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const ecg = (x) => {
        const t = A.t + x * 0.0045;
        const beat = t % 0.9;
        let y = Math.sin(t * 3.1) * 0.04;
        const g = (pos, w, amp) => amp * Math.exp(-Math.pow((beat - pos) * w, 2));
        return y + g(0.02, 95, 1.0) + g(0.09, 45, -0.4) + g(0.16, 40, 0.3) + g(0.3, 26, 0.32) + g(0.74, 30, 0.13);
      };
      ctx.strokeStyle = "#30d158"; ctx.lineWidth = 1.6; ctx.lineJoin = "round";
      ctx.beginPath();
      for (let x = 0; x <= W; x += 4) {
        const y = 195 - ecg(x) * 84;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      const pulse = 1 + Math.sin(A.t * 6) * 0.08;
      icon(ctx, "heart", 84, 122, 17 * pulse, "#ff375f");
      text(ctx, String(A.bpm), 84, 180, 46, "#fff", { a: "center", w: 300 });
      text(ctx, "BPM", 84, 200, 11, "#8e8e93", { a: "center", w: 700 });
      text(ctx, A.measuring > 0 ? "Measuring…" : A.last ? "Last: " + A.last : "Resting", 84, 226, 11, "#8e8e93", { a: "center" });
      fillRR(ctx, 150, 316, 180, 40, 20, "#ff375f");
      text(ctx, A.measuring > 0 ? "Measuring…" : "Measure", 240, 342, 15, "#fff", { a: "center", w: 600 });
      S.addHit("measure", 150, 316, 180, 40);
    },
    tick(S, A, dt) {
      A.t += dt;
      if (A.measuring > 0) {
        A.measuring -= dt;
        if (A.measuring <= 0) { A.bpm = 62 + Math.floor(Math.random() * 14); A.last = A.bpm + " BPM"; S.sound("chime"); }
      }
    },
    tap(S, A, id) { if (id === "measure" && A.measuring <= 0) { A.measuring = 3; S.sound("tick"); } },
  },
  {
    id: "weather", name: "Weather", color: "#0a84ff", icon: "weather",
    enter(S, A) {},
    draw(S, ctx, A) {
      S.chrome(ctx, "Weather", "#0a84ff");
      const wh = (h) => {
        const t = h + S.parts.m / 60;
        const temp = Math.round(15 + 8 * Math.sin((Math.PI * (t - 9)) / 14));
        const cond = t >= 14 && t <= 17 ? "rain" : t > 6.5 && t < 19.5 ? "sun" : "moon";
        return { temp, cond };
      };
      const cur = wh(S.parts.h);
      text(ctx, "Cupertino", 24, 66, 13, "#9a9ca1", { w: 600 });
      text(ctx, cur.temp + "°", 24, 152, 88, "#fff", { w: 200 });
      text(ctx, cur.cond === "rain" ? "Rain" : cur.cond === "sun" ? "Sunny" : "Clear", 28, 182, 17, "#fff", { w: 500 });
      text(ctx, "H:" + (cur.temp + 2) + "°  L:" + (cur.temp - 3) + "°", 28, 206, 12, "#9a9ca1");
      icon(ctx, cur.cond === "rain" ? "rain" : cur.cond === "sun" ? "sun" : "moon", 396, 128, 44, cur.cond === "sun" ? "#ffd60a" : cur.cond === "rain" ? "#64d2ff" : "#e8e8ea");
      fillRR(ctx, 16, 240, W - 32, 138, 20, "rgba(44,44,48,0.65)");
      text(ctx, "Hourly", 32, 268, 11, "#9a9ca1", { w: 700 });
      for (let i = 0; i < 6; i++) {
        const hh = (S.parts.h + (i + 1) * 2) % 24;
        const f = wh(hh);
        const x = 44 + i * 68;
        text(ctx, hh === 0 ? "12A" : hh > 12 ? hh - 12 + "P" : hh + "A", x + 30, 288, 11, "#9a9ca1", { a: "center" });
        icon(ctx, f.cond === "rain" ? "rain" : f.cond === "sun" ? "sun" : "moon", x + 30, 320, 14, f.cond === "sun" ? "#ffd60a" : f.cond === "rain" ? "#64d2ff" : "#e8e8ea");
        text(ctx, f.temp + "°", x + 30, 362, 15, "#fff", { a: "center", w: 600 });
      }
    },
  },
  {
    id: "music", name: "Music", color: "#ff2d55", icon: "music",
    enter(S, A) {
      A.tracks = [
        { t: "Midnight City", a: "M83", d: 243, g: ["#3a1c71", "#d76d77", "#ffaf7b"] },
        { t: "Blinding Lights", a: "The Weeknd", d: 200, g: ["#0f2027", "#203a43", "#2c5364"] },
        { t: "Sunset Lover", a: "Petit Biscuit", d: 236, g: ["#f7971e", "#ffd200", "#e56b1f"] },
      ];
      if (A.track === undefined) { A.track = 0; A.pos = 42; A.playing = true; A.vol = 0.65; A.volShow = 0; }
    },
    draw(S, ctx, A) {
      S.chrome(ctx, "Music", "#ff2d55");
      const tr = A.tracks[A.track];
      ctx.save(); rr(ctx, 180, 64, 120, 120, 18); ctx.clip();
      ctx.fillStyle = vGrad(ctx, 180, 64, 0, 120, [[0, tr.g[0]], [0.55, tr.g[1]], [1, tr.g[2]]]);
      ctx.fillRect(180, 64, 120, 120);
      ctx.restore();
      icon(ctx, "music", 240, 124, 24, "rgba(255,255,255,0.9)");
      text(ctx, tr.t, 240, 218, 18, "#fff", { a: "center", w: 600 });
      text(ctx, tr.a, 240, 240, 12, "#9a9ca1", { a: "center" });
      const frac = clamp(A.pos / tr.d, 0, 1);
      fillRR(ctx, 60, 258, 360, 3, 1.5, "#333336");
      fillRR(ctx, 60, 258, 360 * frac, 3, 1.5, "#ff2d55");
      const t0 = Math.floor(A.pos), t1 = tr.d;
      text(ctx, `${Math.floor(t0 / 60)}:${pad(t0 % 60)}`, 60, 276, 10, "#8e8e93");
      text(ctx, `-${Math.floor((t1 - t0) / 60)}:${pad((t1 - t0) % 60)}`, 420, 276, 10, "#8e8e93", { a: "right" });
      circle(ctx, 150, 328, 21, "#2c2c2e"); icon(ctx, "prev", 150, 328, 11, "#fff");
      S.addHit("prev", 128, 306, 44, 44);
      circle(ctx, 240, 328, 32, "#fff"); icon(ctx, A.playing ? "pause" : "play", A.playing ? 240 : 243, 328, 13, "#000");
      S.addHit("play", 204, 292, 72, 72);
      circle(ctx, 330, 328, 21, "#2c2c2e"); icon(ctx, "next", 330, 328, 11, "#fff");
      S.addHit("next", 308, 306, 44, 44);
      if (A.volShow > 0) {
        ring(ctx, 44, 60, 24, 5, "#333336");
        ring(ctx, 44, 60, 24, 5, "#ff2d55", -Math.PI / 2, -Math.PI / 2 + A.vol * TAU);
        text(ctx, "VOL " + Math.round(A.vol * 100), 76, 65, 12, "#fff", { w: 600 });
      }
    },
    tick(S, A, dt) {
      if (A.volShow > 0) A.volShow -= dt;
      if (A.playing) {
        A.pos += dt;
        if (A.pos >= A.tracks[A.track].d) { A.track = (A.track + 1) % A.tracks.length; A.pos = 0; }
      }
    },
    tap(S, A, id) {
      if (id === "play") { A.playing = !A.playing; S.sound("click"); }
      else if (id === "prev") { A.track = (A.track - 1 + A.tracks.length) % A.tracks.length; A.pos = 0; S.sound("tick"); }
      else if (id === "next") { A.track = (A.track + 1) % A.tracks.length; A.pos = 0; S.sound("tick"); }
    },
    crown(S, A, dir) { A.vol = clamp(A.vol + dir * 0.1, 0, 1); A.volShow = 1.4; S.sound("tick"); },
  },
  {
    id: "messages", name: "Messages", color: "#30d158", icon: "messages",
    enter(S, A) {
      A.threads = [
        { n: "Sarah", l: "S", c: "#ff375f", t: "2m", msgs: [{ me: 0, t: "Are we still on for dinner tonight?" }, { me: 1, t: "Yes! 7pm works for me." }] },
        { n: "Mom", l: "M", c: "#bf5af2", t: "1h", msgs: [{ me: 0, t: "Call me when you can ❤" }, { me: 1, t: "Will do tonight!" }] },
        { n: "Alex", l: "A", c: "#0a84ff", t: "3h", msgs: [{ me: 0, t: "Did you see the game?" }, { me: 1, t: "Incredible finish!" }] },
        { n: "Design Group", l: "D", c: "#ff9f0a", t: "5h", msgs: [{ me: 0, t: "New mockups are in Figma" }, { me: 1, t: "Looking now, great work." }] },
      ];
      A.open = -1;
    },
    draw(S, ctx, A) {
      S.chrome(ctx, A.open >= 0 ? A.threads[A.open].n : "Messages", "#30d158");
      if (A.open < 0) {
        A.threads.forEach((th, i) => {
          const y = 62 + i * 74;
          circle(ctx, 44, y + 26, 18, th.c);
          text(ctx, th.l, 44, y + 32, 15, "#fff", { a: "center", w: 600 });
          text(ctx, th.n, 74, y + 18, 14.5, "#fff", { w: 600 });
          text(ctx, th.msgs[th.msgs.length - 1].t.slice(0, 34), 74, y + 38, 11.5, "#9a9ca1");
          text(ctx, th.t, 456, y + 18, 11, "#8e8e93", { a: "right" });
          S.addHit("t" + i, 16, y + 2, W - 32, 62);
        });
      } else {
        icon(ctx, "chevL", 28, 32, 11, "#30d158");
        S.addHit("back", 8, 12, 52, 44);
        const th = A.threads[A.open];
        const bubbles = [...th.msgs, ...(A.extra || [])];
        let y = 62;
        for (const b of bubbles) {
          const wdt = Math.min(ctx.measureText(b.t).width + 26, 250);
          const hgt = 34;
          if (b.me) {
            fillRR(ctx, W - 20 - wdt, y, wdt, hgt, 15, "#0a84ff");
            text(ctx, b.t, W - 33, y + 21, 13.5, "#fff", { a: "right" });
            if (b.delivered !== undefined) text(ctx, b.delivered > 0 ? "Sending…" : "Delivered", W - 33, y + hgt + 13, 9.5, "#8e8e93", { a: "right" });
          } else {
            fillRR(ctx, 20, y, wdt, hgt, 15, "#2c2c2e");
            text(ctx, b.t, 33, y + 21, 13.5, "#fff");
          }
          y += hgt + (b.delivered !== undefined ? 24 : 12);
        }
        const chips = ["Sure!", "On my way", "Can't talk"];
        let cx = 16;
        for (let i = 0; i < 3; i++) {
          const wdt = ctx.measureText(chips[i]).width + 30;
          fillRR(ctx, cx, 346, wdt, 32, 16, i === 0 ? "#0a84ff" : "#2c2c2e");
          text(ctx, chips[i], cx + wdt / 2, 367, 13, "#fff", { a: "center", w: 500 });
          S.addHit("r" + i, cx, 346, wdt, 32);
          cx += wdt + 10;
        }
      }
    },
    tick(S, A, dt) {
      if (A.extra) A.extra.forEach((b) => { if (b.delivered > 0) b.delivered -= dt; });
    },
    tap(S, A, id) {
      if (id.startsWith("t")) { A.open = parseInt(id.slice(1)); A.extra = []; S.sound("click"); }
      else if (id === "back") { A.open = -1; S.sound("click"); }
      else if (id.startsWith("r")) {
        const chips = ["Sure!", "On my way", "Can't talk"];
        A.extra = A.extra || [];
        A.extra.push({ me: 1, t: chips[parseInt(id.slice(1))], delivered: 1.2 });
        S.sound("tick");
      }
    },
  },
  {
    id: "photos", name: "Photos", color: "#e8e8ea", icon: "photos",
    enter(S, A) { if (A.idx === undefined) A.idx = 0; },
    draw(S, ctx, A) {
      S.chrome(ctx, "Photos", "#ffd60a");
      ctx.save(); rr(ctx, 14, 48, W - 28, 296, 14); ctx.clip();
      const scenes = [
        (c) => { c.fillStyle = vGrad(c, 0, 48, 0, 296, [[0, "#ff9966"], [0.6, "#ff5e62"], [1, "#3a1c71"]]); c.fillRect(0, 48, W, 296); c.fillStyle = rGrad(c, 240, 120, 60, [[0, "#ffe9a8"], [1, "rgba(255,200,90,0)"]]); c.beginPath(); c.arc(240, 130, 60, 0, TAU); c.fill(); c.fillStyle = "#5b2a6e"; c.beginPath(); c.moveTo(0, 344); c.lineTo(90, 210); c.lineTo(190, 300); c.lineTo(260, 230); c.lineTo(360, 344); c.closePath(); c.fill(); },
        (c) => { c.fillStyle = vGrad(c, 0, 48, 0, 296, [[0, "#0f2027"], [0.6, "#203a43"], [1, "#2c5364"]]); c.fillRect(0, 48, W, 296); c.fillStyle = "#f4f4f6"; c.beginPath(); c.arc(360, 110, 34, 0, TAU); c.fill(); c.fillStyle = "#0b1520"; c.beginPath(); c.arc(378, 100, 28, 0, TAU); c.fill(); c.fillStyle = "rgba(255,255,255,0.9)"; for (let i = 0; i < 30; i++) c.fillRect(((i * 61) % 460) + 8, ((i * 37) % 200) + 60, 2, 2); c.fillStyle = "#16222c"; c.beginPath(); c.moveTo(0, 344); c.lineTo(120, 240); c.lineTo(250, 320); c.lineTo(480, 200); c.lineTo(480, 344); c.closePath(); c.fill(); },
        (c) => { c.fillStyle = vGrad(c, 0, 48, 0, 296, [[0, "#56ccf2"], [0.7, "#2f80ed"], [1, "#1a4e8a"]]); c.fillRect(0, 48, W, 296); c.fillStyle = "#eaf6ff"; c.beginPath(); c.arc(130, 100, 26, 0, TAU); c.fill(); c.fillStyle = "#2d7d46"; c.beginPath(); c.moveTo(0, 344); c.lineTo(110, 200); c.lineTo(230, 290); c.lineTo(330, 190); c.lineTo(480, 320); c.lineTo(480, 344); c.closePath(); c.fill(); c.fillStyle = "#1f5a32"; c.beginPath(); c.moveTo(0, 344); c.lineTo(60, 260); c.lineTo(150, 344); c.closePath(); c.fill(); },
      ];
      scenes[A.idx % 3](ctx);
      ctx.restore();
      circle(ctx, 40, 230, 19, "rgba(0,0,0,0.5)"); icon(ctx, "chevL", 40, 230, 11, "#fff");
      S.addHit("prev", 18, 208, 44, 44);
      circle(ctx, 440, 230, 19, "rgba(0,0,0,0.5)"); icon(ctx, "chevR", 440, 230, 11, "#fff");
      S.addHit("next", 418, 208, 44, 44);
      for (let i = 0; i < 3; i++) circle(ctx, 226 + i * 14, 372, 2.6, i === A.idx % 3 ? "#fff" : "rgba(255,255,255,0.4)");
      text(ctx, (A.idx % 3) + 1 + " of 3", 452, 376, 10, "#8e8e93", { a: "right" });
    },
    tap(S, A, id) { A.idx = (A.idx + (id === "next" ? 1 : -1) + 3) % 3; S.sound("tick"); },
    crown(S, A, dir) { A.idx = (A.idx + dir + 3) % 3; S.sound("tick"); },
  },
  {
    id: "breathe", name: "Breathe", color: "#64d2ff", icon: "breathe",
    enter(S, A) { A.running = false; A.t = 0; A.cycles = 0; A.done = false; },
    draw(S, ctx, A) {
      S.chrome(ctx, "Breathe", "#64d2ff");
      const phaseLen = 4, cycle = phaseLen * 4;
      const pt = A.t % cycle;
      let f, label;
      if (pt < phaseLen) { f = pt / phaseLen; label = "Inhale"; }
      else if (pt < phaseLen * 2) { f = 1; label = "Hold"; }
      else if (pt < phaseLen * 3) { f = 1 - (pt - phaseLen * 2) / phaseLen; label = "Exhale"; }
      else { f = 0; label = "Hold"; }
      if (!A.running) { f = 0.55; label = "Ready"; }
      for (let i = 0; i < 6; i++) {
        const rr2 = (30 + 62 * f) * (0.72 + i * 0.07);
        ring(ctx, 240, 205, rr2, 4, `rgba(100,210,255,${(0.14 + i * 0.13).toFixed(2)})`);
      }
      ring(ctx, 240, 205, 108, 3, "rgba(255,255,255,0.12)");
      if (A.running) ring(ctx, 240, 205, 108, 3, "#64d2ff", -Math.PI / 2, -Math.PI / 2 + (pt / cycle) * TAU);
      if (A.done) {
        text(ctx, "1 minute", 240, 190, 34, "#fff", { a: "center", w: 300 });
        text(ctx, "Nice work", 240, 216, 13, "#9a9ca1", { a: "center" });
        fillRR(ctx, 150, 300, 180, 40, 20, "#64d2ff"); text(ctx, "Done", 240, 326, 15, "#000", { a: "center", w: 600 });
        S.addHit("done", 150, 300, 180, 40);
      } else {
        text(ctx, label, 240, 212, 22, "#fff", { a: "center", w: 300 });
        if (A.running) {
          fillRR(ctx, 196, 300, 88, 36, 18, "#2c2c2e"); text(ctx, "End", 240, 323, 13, "#fff", { a: "center", w: 600 });
          S.addHit("end", 196, 300, 88, 36);
        } else {
          circle(ctx, 240, 330, 36, "#64d2ff");
          icon(ctx, "play", 243, 330, 15, "#000");
          S.addHit("begin", 200, 290, 80, 80);
        }
      }
    },
    tick(S, A, dt) {
      if (A.running) {
        const prev = Math.floor(A.t / 16);
        A.t += dt;
        const now = Math.floor(A.t / 16);
        if (now > prev) { A.cycles++; if (A.cycles >= 4) { A.running = false; A.done = true; S.sound("chime"); } }
      }
    },
    tap(S, A, id) {
      if (id === "begin") { A.running = true; A.t = 0; A.cycles = 0; S.sound("tick"); }
      else if (id === "end") { A.running = false; A.done = true; S.sound("tick"); }
      else if (id === "done") { A.done = false; A.t = 0; S.sound("tick"); }
    },
  },
  {
    id: "compass", name: "Compass", color: "#1c1c1e", icon: "compass",
    enter(S, A) { A.heading = 287; A.cal = 0; },
    draw(S, ctx, A) {
      S.chrome(ctx, "Compass", "#ff9f0a");
      const cx = 240, cy = 190;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((-A.heading * Math.PI) / 180);
      ring(ctx, 0, 0, 112, 1.6, "rgba(255,255,255,0.25)");
      ticks(ctx, 0, 0, 108, 60, 3, 1, "rgba(255,255,255,0.4)", 5, 7, 2);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU - Math.PI / 2;
        const letters = ["N", "E", "S", "W"];
        text(ctx, letters[i], Math.cos(a) * 90, Math.sin(a) * 90 + 7, 18, i === 0 ? "#ff453a" : "#fff", { a: "center", w: 600 });
      }
      ctx.rotate((A.heading * Math.PI) / 180);
      // fixed needle
      ctx.beginPath(); ctx.moveTo(0, -88); ctx.lineTo(8, -66); ctx.lineTo(-8, -66); ctx.closePath();
      ctx.fillStyle = "#ff453a"; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 88); ctx.lineTo(8, 66); ctx.lineTo(-8, 66); ctx.closePath();
      ctx.fillStyle = "#e8e8ea"; ctx.fill();
      circle(ctx, 0, 0, 4, "#ffd60a");
      ctx.restore();
      const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      const dir = dirs[Math.round(((A.heading % 360) + 360) % 360 / 45) % 8];
      text(ctx, Math.round(A.heading) + "°", cx, cy + 60, 30, "#fff", { a: "center", w: 300 });
      text(ctx, dir, cx, cy + 80, 13, "#9a9ca1", { a: "center", w: 600 });
      fillRR(ctx, 150, 316, 180, 36, 18, A.cal > 0 ? "#2c2c2e" : "#1c1c1e");
      rr(ctx, 150, 316, 180, 36, 18); ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.stroke();
      text(ctx, A.cal > 0 ? "Calibrating…" : "Recalibrate", 240, 340, 13, "#fff", { a: "center", w: 600 });
      S.addHit("cal", 150, 316, 180, 36);
    },
    tick(S, A, dt) {
      A.heading = (A.heading + (A.cal > 0 ? 40 : 0.35) * dt) % 360;
      if (A.cal > 0) { A.cal -= dt; if (A.cal <= 0) S.sound("chime"); }
    },
    tap(S, A, id) { if (id === "cal" && A.cal <= 0) { A.cal = 2.4; S.sound("tick"); } },
  },
  {
    id: "workout", name: "Workout", color: "#b0f24b", icon: "workout",
    enter(S, A) { A.t = 0; A.running = true; A.ended = false; },
    draw(S, ctx, A) {
      S.chrome(ctx, "Outdoor Run", "#b0f24b");
      if (A.ended) {
        text(ctx, "Workout Complete", 240, 130, 22, "#b0f24b", { a: "center", w: 700 });
        const m = A.t / 60;
        text(ctx, `${Math.floor(A.t / 60)}:${pad(Math.floor(A.t % 60))}`, 240, 190, 42, "#fff", { a: "center", w: 300 });
        text(ctx, "TIME", 240, 212, 10, "#8e8e93", { a: "center", w: 700 });
        fillRR(ctx, 24, 240, 206, 66, 14, "#1c1c1e");
        text(ctx, Math.round(m * 9.8) + "", 40, 268, 20, "#fa114f", { w: 600 }); text(ctx, "ACTIVE CAL", 40, 288, 9, "#8e8e93", { w: 700 });
        fillRR(ctx, 250, 240, 206, 66, 14, "#1c1c1e");
        text(ctx, (m * 0.155).toFixed(2) + " km", 266, 268, 20, "#b0f24b", { w: 600 }); text(ctx, "DISTANCE", 266, 288, 9, "#8e8e93", { w: 700 });
        fillRR(ctx, 150, 330, 180, 40, 20, "#b0f24b"); text(ctx, "Done", 240, 356, 15, "#000", { a: "center", w: 600 });
        S.addHit("done", 150, 330, 180, 40);
        return;
      }
      const m = A.t / 60;
      const hb = Math.round(126 + 10 * Math.sin(A.t * 0.9) + 4 * Math.sin(A.t * 2.3));
      text(ctx, `${Math.floor(A.t / 60)}:${pad(Math.floor(A.t % 60))}`, 240, 118, 46, "#fff", { a: "center", w: 300 });
      text(ctx, A.running ? "OUTDOOR RUN" : "PAUSED", 240, 138, 10, A.running ? "#b0f24b" : "#ffd60a", { a: "center", w: 700 });
      const cells = [
        [Math.round(m * 9.8), "ACTIVE CAL", "#fa114f", 24],
        [(m * 0.155).toFixed(2) + " km", "DISTANCE", "#b0f24b", 250],
        [(5.9 + m * 0.02).toFixed(2) + "'/km", "PACE", "#ffd60a", 24],
        [hb + " bpm", "HEART RATE", "#ff375f", 250],
      ];
      cells.forEach(([v, l, c, x], i) => {
        const y = 168 + Math.floor(i / 2) * 86;
        fillRR(ctx, x, y, 206, 72, 14, "#1c1c1e");
        text(ctx, String(v), x + 16, y + 32, 22, c, { w: 600 });
        text(ctx, l, x + 16, y + 54, 9.5, "#8e8e93", { w: 700 });
      });
      fillRR(ctx, 40, 342, 140, 36, 18, "#ff453a"); text(ctx, "End", 110, 365, 14, "#fff", { a: "center", w: 600 });
      S.addHit("end", 40, 342, 140, 36);
      fillRR(ctx, 300, 342, 140, 36, 18, "#2c2c2e"); text(ctx, A.running ? "Pause" : "Resume", 370, 365, 14, "#fff", { a: "center", w: 600 });
      S.addHit("pause", 300, 342, 140, 36);
    },
    tick(S, A, dt) { if (A.running && !A.ended) A.t += dt; },
    tap(S, A, id) {
      if (id === "pause") { A.running = !A.running; S.sound("tick"); }
      else if (id === "end") { A.ended = true; A.running = false; S.sound("chime"); }
      else if (id === "done") { A.ended = false; A.t = 0; A.running = true; S.sound("tick"); }
    },
  },
  {
    id: "settings", name: "Settings", color: "#8e8e93", icon: "settings",
    enter(S, A) {},
    draw(S, ctx, A) {
      S.chrome(ctx, "Settings", "#8e8e93");
      fillRR(ctx, 16, 58, W - 32, 44, 12, "#1c1c1e");
      icon(ctx, "battery", 44, 80, 13, S.battery > 50 ? "#30d158" : S.battery > 20 ? "#ff9f0a" : "#ff453a");
      text(ctx, "Battery", 70, 86, 14, "#fff", { w: 600 });
      text(ctx, Math.round(S.battery) + "%", 448, 86, 14, S.battery > 50 ? "#30d158" : S.battery > 20 ? "#ff9f0a" : "#ff453a", { a: "right", w: 600 });
      const rows = [
        ["aod", "Always On Display", "activity"],
        ["wake", "Wake on Wrist Raise", "sun"],
        ["theater", "Theater Mode", "close"],
        ["sounds", "Sounds & Haptics", "bell"],
        ["airplane", "Airplane Mode", "airplane"],
        ["water", "Water Lock", "drop"],
      ];
      rows.forEach(([key, label, ic], i) => {
        const y = 118 + i * 44;
        circle(ctx, 44, y + 20, 13, "#2c2c2e");
        icon(ctx, ic, 44, y + 20, 10, "#e8e8ea");
        text(ctx, label, 70, y + 25, 13.5, "#fff", { w: 500 });
        const on = !!S.settings[key];
        fillRR(ctx, 400, y + 7, 46, 26, 13, on ? "#30d158" : "#3a3a3c");
        circle(ctx, on ? 433 : 413, y + 20, 10, "#fff");
        S.addHit(key, 384, y, 76, 40);
      });
      text(ctx, "watchOS 10.5 (21R576)", 240, 386, 10, "#5a5a5e", { a: "center" });
    },
    tap(S, A, id) {
      if (id in S.settings) {
        S.settings[id] = !S.settings[id];
        safeStore.set("aw3d-settings", S.settings);
        if (id === "water" && S.settings.water) { S.open("waterlock"); }
        S.sound("click");
      }
    },
  },
];

// ============================================================================
// MAIN UI CLASS
// ============================================================================
export class WatchUI {
  constructor(canvas, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hooks = hooks; // { sound(name) }
    this.W = W; this.H = H;
    this.state = "face";
    this.faceIndex = 0;
    this.now = new Date();
    this.nowMs = 0;
    this.parts = { h: 0, m: 0, s: 0, ms: 0 };
    this.t = 0;
    this.idle = 0;
    this.battery = 86;
    this.lowWarned = false;
    this.settings = safeStore.get("aw3d-settings", { aod: true, wake: true, theater: false, sounds: true, airplane: false, water: false, dnd: false });
    this.faceData = { chrono: { running: false, ms: 0 } };
    this.app = {};
    this.recent = ["calc", "music", "timer"];
    this.notifications = [
      { app: "Messages", title: "Sarah", body: "Are we still on for dinner tonight?", color: "#30d158", ic: "messages", time: "2m" },
      { app: "Activity", title: "Activity", body: "You're close! 12 more minutes to close your Exercise ring.", color: "#fa114f", ic: "activity", time: "25m" },
      { app: "Calendar", title: "Calendar", body: "Design review in 15 minutes — Room 4B.", color: "#ff375f", ic: "calendar", time: "1h" },
      { app: "Weather", title: "Weather", body: "Rain starting in 20 minutes in Cupertino.", color: "#0a84ff", ic: "weather", time: "2h" },
    ];
    this.banner = null;
    this.ripples = [];
    this.hit = [];
    this.trans = null;
    this.unlock = 0;
    this.pingT = 0;
    this.flash = { mode: 0 };
    this.wallet = { paid: 0 };
    this.snap = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (this.snap) { this.snap.width = W; this.snap.height = H; this.snapCtx = this.snap.getContext("2d"); }
    else { this.snapCtx = null; }
  }

  // ---------- helpers exposed to faces/apps ----------
  dayShort() { return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][this.now.getDay()]; }
  time12() { const h = this.parts.h % 12 || 12; return h + ":" + pad(this.parts.m); }
  weatherTemp() { return Math.round(15 + 8 * Math.sin((Math.PI * (this.parts.h - 9)) / 14)); }
  chrome(ctx, title, color) {
    text(ctx, title.toUpperCase(), 16, 34, 11.5, color || "#ff9f0a", { w: 700 });
    text(ctx, this.time12(), W - 16, 34, 12.5, "#fff", { a: "right", w: 500 });
  }
  addHit(id, x, y, w, h) { this.hit.push({ id, x, y, w, h }); }
  sound(name) { if (this.hooks.sound) this.hooks.sound(name); }

  // ---------- state management ----------
  open(s, o = {}) {
    if (this.state === s) return;
    if (this.snapCtx) {
      this.snapCtx.clearRect(0, 0, W, H);
      this.snapCtx.drawImage(this.canvas, 0, 0);
    }
    this.trans = { t: 0, dur: o.dur ?? 0.26, ox: o.ox ?? W / 2, oy: o.oy ?? H / 2, s0: o.s0 ?? 0.7 };
    this.state = s;
    this.wake();
  }
  faceSwitch(dir) {
    this.faceIndex = (this.faceIndex + dir + FACES.length) % FACES.length;
    this.open("face", { s0: 0.6, dur: 0.22 });
    this.sound("tick");
  }
  openApp(id, ox, oy) {
    const app = APPS.find((a) => a.id === id);
    if (!app) return;
    if (!this.app[id]) this.app[id] = {};
    app.enter(this, this.app[id]);
    this.recent = [id, ...this.recent.filter((r) => r !== id)].slice(0, 3);
    this.open("app:" + id, { ox: ox ?? W / 2, oy: oy ?? H / 2, s0: 0.12, dur: 0.3 });
    this.sound("click");
  }
  pushNotification(n) {
    this.notifications.unshift({ ...n, time: "now" });
    this.banner = { ...n, t: 0 };
    this.sound("chime");
  }
  wake() { this.idle = 0; }
  setBattery(v) {
    this.battery = clamp(v, 0, 100);
    if (this.battery <= 10 && !this.lowWarned && this.battery > 0) {
      this.lowWarned = true;
      this.pushNotification({ app: "Battery", title: "Low Battery", body: "10% remaining. Connect power.", color: "#ff453a", ic: "battery" });
    }
    if (this.battery <= 0 && this.state !== "powerreserve") {
      this.open("powerreserve");
      this.sound("error");
    }
  }
  recharge() {
    this.battery = 100;
    this.lowWarned = false;
    if (this.state === "powerreserve") this.open("face");
    this.sound("chime");
  }

  // ---------- input ----------
  tap(x, y) {
    this.wake();
    this.ripples.push({ x, y, t: 0 });
    if (this.trans && this.trans.t < this.trans.dur) return;
    // banner first
    if (this.banner) {
      const b = this.hit.find((h) => h.id === "banner");
      if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        this.banner = null;
        this.open("notifications");
        return;
      }
    }
    const hit = this.hitAt(x, y);
    switch (this.state) {
      case "face":
        if (this.faceIndex === FACES.findIndex((f) => f.id === "chrono") && !hit) {
          const C = this.faceData.chrono;
          C.running = !C.running;
          if (!C.running) C.ms = 0;
          this.sound("tick");
        }
        break;
      case "grid":
        if (hit && hit.id.startsWith("app:")) this.openApp(hit.id.slice(4), hit.x + hit.w / 2, hit.y + hit.h / 2);
        break;
      case "dock":
        if (hit && hit.id.startsWith("card")) this.openApp(this.recent[parseInt(hit.id.slice(4))]);
        break;
      case "notifications": {
        if (hit) {
          if (hit.id === "clear") { this.notifications = []; this.sound("click"); }
          else if (hit.id === "close") this.open("face");
          else if (hit.id.startsWith("n")) { this.notifications.splice(parseInt(hit.id.slice(1)), 1); this.sound("click"); }
        }
        break;
      }
      case "control": {
        if (hit) {
          if (hit.id === "done") this.open("face");
          else if (hit.id === "airplane") { this.settings.airplane = !this.settings.airplane; safeStore.set("aw3d-settings", this.settings); this.sound("click"); }
          else if (hit.id === "wifi") { this.sound("error"); }
          else if (hit.id === "dnd") { this.settings.dnd = !this.settings.dnd; safeStore.set("aw3d-settings", this.settings); this.sound("click"); }
          else if (hit.id === "flashlight") { this.flash.mode = 0; this.open("flashlight"); }
          else if (hit.id === "theater") { this.settings.theater = !this.settings.theater; safeStore.set("aw3d-settings", this.settings); this.sound("click"); }
          else if (hit.id === "water") { this.open("waterlock"); this.settings.water = true; safeStore.set("aw3d-settings", this.settings); }
          else if (hit.id === "ping") { this.pingT = 1.6; this.sound("ping"); }
          else if (hit.id === "sleep") { this.settings.dnd = !this.settings.dnd; safeStore.set("aw3d-settings", this.settings); this.sound("click"); }
        }
        break;
      }
      case "wallet":
        if (hit && hit.id === "pay") { this.wallet.paid = 1.6; this.sound("pay"); }
        else if (hit && hit.id === "close") this.open("face");
        else if (!hit) this.open("face");
        break;
      case "flashlight":
        this.flash.mode++;
        if (this.flash.mode >= 3) { this.open("face"); return; }
        this.sound("click");
        break;
      default: {
        if (this.state.startsWith("app:")) {
          const app = APPS.find((a) => "app:" + a.id === this.state);
          if (app && hit) app.tap(this, this.app[app.id], hit.id);
        }
      }
    }
  }
  hitAt(x, y) {
    for (let i = this.hit.length - 1; i >= 0; i--) {
      const h = this.hit[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }
  swipe(x0, y0, x1, y1) {
    this.wake();
    const dx = x1 - x0, dy = y1 - y0;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 26 && this.state === "face") this.faceSwitch(dx > 0 ? -1 : 1);
    } else if (Math.abs(dy) > 26) {
      const edge = y0 < H * 0.2 ? "top" : y0 > H * 0.8 ? "bottom" : null;
      const openable = ["face", "grid", "dock"].includes(this.state) || this.state.startsWith("app:");
      if (openable) {
        if (edge === "top") this.open("notifications", { s0: 0.85, dur: 0.24 });
        else if (edge === "bottom") this.open("control", { s0: 0.85, dur: 0.24 });
      }
    }
  }
  crownScroll(dir) {
    this.wake();
    switch (this.state) {
      case "face": this.faceSwitch(dir); break;
      case "waterlock": {
        this.unlock++;
        this.sound("tick");
        if (this.unlock >= 6) {
          this.settings.water = false;
          safeStore.set("aw3d-settings", this.settings);
          this.unlock = 0;
          this.open("face");
          this.sound("unlock");
        }
        break;
      }
      default: {
        if (this.state.startsWith("app:")) {
          const app = APPS.find((a) => "app:" + a.id === this.state);
          if (app && app.crown) app.crown(this, this.app[app.id], dir);
        }
      }
    }
  }
  crownPress() {
    if (this.state === "waterlock" || this.state === "powerreserve") { this.sound("error"); return; }
    if (this.state === "face") this.open("grid", { s0: 0.6 });
    else this.open("face", { s0: 0.6 });
    this.sound("click");
  }
  sidePress() {
    if (this.state === "waterlock" || this.state === "powerreserve") { this.sound("error"); return; }
    if (this.state === "dock") this.open("face");
    else this.open("dock", { s0: 0.6 });
    this.sound("click");
  }
  sideDouble() {
    if (this.state === "waterlock" || this.state === "powerreserve") return;
    this.open("wallet", { s0: 0.5, dur: 0.3 });
    this.sound("click");
  }

  // ---------- per-frame ----------
  tick(dt, nowMs) {
    dt = clamp(dt, 0, 1);
    this.t += dt;
    this.idle += dt;
    this.nowMs = nowMs;
    this.now = new Date(nowMs);
    const P = this.parts;
    P.h = this.now.getHours(); P.m = this.now.getMinutes(); P.s = this.now.getSeconds(); P.ms = this.now.getMilliseconds();
    if (this.trans) { this.trans.t += dt; if (this.trans.t >= this.trans.dur) this.trans = null; }
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 6) this.banner = null; }
    if (this.pingT > 0) this.pingT -= dt;
    if (this.wallet.paid > 0) this.wallet.paid -= dt;
    this.ripples = this.ripples.filter((r) => { r.t += dt; return r.t < 0.45; });
    // chronograph
    const C = this.faceData.chrono;
    if (C.running) C.ms += dt * 1000;
    // active app ticking
    if (this.state.startsWith("app:")) {
      const app = APPS.find((a) => "app:" + a.id === this.state);
      if (app && app.tick) app.tick(this, this.app[app.id], dt);
    }
    this.draw();
  }

  // ---------- drawing ----------
  brightness() {
    if (this.state === "flashlight") return 1;
    if (this.settings.theater) return 0.06;
    if (!this.settings.wake && this.idle > 35) return 0;
    if (this.state === "face" && this.settings.aod && this.idle > 20) return 0.24;
    return 1;
  }
  getLight() {
    if (this.state === "flashlight") {
      if (this.flash.mode === 1) return { level: 1.6, color: "#ff3b30" };
      if (this.flash.mode === 2) return { level: Math.sin(this.t * 14) > 0 ? 2.2 : 0.3, color: "#ffffff" };
      return { level: 2.6, color: "#ffffff" };
    }
    if (this.settings.theater) return { level: 0.03, color: "#ffffff" };
    if (this.state === "face" && this.settings.aod && this.idle > 20) return { level: 0.12, color: "#ffffff" };
    return { level: 0.55, color: "#ffffff" };
  }
  getSensorOn() { return this.state === "app:heart" && this.app.heart && this.app.heart.measuring > 0; }

  draw() {
    const ctx = this.ctx;
    this.hit.length = 0;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const B = this.brightness();
    if (B === 0) return;
    const aod = this.state === "face" && this.settings.aod && this.idle > 20;
    const trans = this.trans;
    const drawContent = () => {
      if (this.state === "face") {
        if (aod) {
          text(ctx, this.time12(), 240, 190, 44, "#fff", { a: "center", w: 300 });
          text(ctx, this.dayShort() + " " + this.now.getDate(), 240, 220, 13, "#9a9ca1", { a: "center", w: 600 });
        } else {
          FACES[this.faceIndex].draw(this, ctx);
        }
      } else if (this.state === "grid") this.drawGrid(ctx);
      else if (this.state === "dock") this.drawDock(ctx);
      else if (this.state === "notifications") this.drawNotifications(ctx);
      else if (this.state === "control") this.drawControl(ctx);
      else if (this.state === "wallet") this.drawWallet(ctx);
      else if (this.state === "waterlock") this.drawWaterLock(ctx);
      else if (this.state === "flashlight") this.drawFlashlight(ctx);
      else if (this.state === "powerreserve") this.drawPowerReserve(ctx);
      else if (this.state.startsWith("app:")) {
        const app = APPS.find((a) => "app:" + a.id === this.state);
        if (app) app.draw(this, ctx, this.app[app.id]);
      }
    };
    if (trans) {
      this.snapCtx && ctx.drawImage(this.snap, 0, 0);
      const e = easeOut(clamp(trans.t / trans.dur, 0, 1));
      const s = trans.s0 + (1 - trans.s0) * e;
      ctx.save();
      ctx.translate(trans.ox, trans.oy); ctx.scale(s, s); ctx.translate(-trans.ox, -trans.oy);
      ctx.globalAlpha = lerp(0.35, 1, e);
      drawContent();
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      drawContent();
    }
    // status indicators
    if (["face", "grid", "dock"].includes(this.state) || this.state.startsWith("app:")) {
      let n = 0;
      const ind = [];
      if (this.settings.dnd) ind.push(["moon", "#5e5ce6"]);
      if (this.settings.water) ind.push(["drop", "#64d2ff"]);
      if (this.settings.airplane) ind.push(["airplane", "#ff9f0a"]);
      if (this.settings.theater) ind.push(["close", "#ff9f0a"]);
      n = ind.length;
      if (n) {
        ind.forEach(([ic, c], i) => {
          const x = W / 2 + (i - (n - 1) / 2) * 20;
          icon(ctx, ic, x, 14, 7, c);
        });
      }
    }
    // banner
    if (this.banner && ["face", "grid", "dock"].includes(this.state) || (this.banner && this.state.startsWith("app:"))) {
      this.drawBanner(ctx);
    }
    // ripples
    for (const r of this.ripples) {
      const f = r.t / 0.45;
      ring(ctx, r.x, r.y, 6 + f * 60, 2.5, `rgba(255,255,255,${(0.5 * (1 - f)).toFixed(2)})`);
    }
    // brightness overlay
    if (B < 0.999) {
      ctx.fillStyle = `rgba(0,0,0,${(1 - B).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // rounded display corners (real displays aren't square)
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    rr(ctx, 0, 0, W, H, 54);
    ctx.fill();
    ctx.restore();
  }

  drawBanner(ctx) {
    const b = this.banner;
    const e = easeOut(clamp(b.t / 0.25, 0, 1));
    const y = 8 - (1 - e) * 64;
    fillRR(ctx, 12, y, W - 24, 56, 17, "rgba(44,44,48,0.97)");
    circle(ctx, 42, y + 28, 17, b.color);
    icon(ctx, b.ic || "bell", 42, y + 28, 10, "#fff");
    text(ctx, b.title, 68, y + 23, 13.5, "#fff", { w: 600 });
    text(ctx, b.body.length > 46 ? b.body.slice(0, 45) + "…" : b.body, 68, y + 42, 11.5, "#c7c7cc");
    this.addHit("banner", 12, y, W - 24, 56);
  }

  drawGrid(ctx) {
    const order = ["activity", "calc", "timer", "heart", "weather", "music", "messages", "photos", "breathe", "compass", "workout", "settings"];
    order.forEach((id, i) => {
      const app = APPS.find((a) => a.id === id);
      const c = i % 3, r = Math.floor(i / 3);
      const x = 100 + c * 140;
      const y = 92 + r * 66 + ((c + r) % 2 ? 33 : 0);
      circle(ctx, x, y, 21, app.color);
      rr(ctx, x - 21, y - 21, 42, 42, 21); ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.stroke();
      icon(ctx, app.icon, x, y, 13, app.icon === "activity" ? "#fff" : app.color === "#e8e8ea" ? "#1c1c1e" : "#fff");
      this.addHit("app:" + id, x - 21, y - 21, 42, 42);
    });
  }

  drawDock(ctx) {
    text(ctx, "RECENT", 240, 40, 11, "#8e8e93", { a: "center", w: 700 });
    const labels = { calc: "Calculator", music: "Music", timer: "Timer", activity: "Activity", heart: "Heart Rate", weather: "Weather", messages: "Messages", photos: "Photos", breathe: "Breathe", compass: "Compass", workout: "Workout", settings: "Settings" };
    this.recent.forEach((id, i) => {
      const app = APPS.find((a) => a.id === id);
      const y = 66 + i * 104;
      fillRR(ctx, 16, y, W - 32, 88, 18, "#1c1c1e");
      circle(ctx, 62, y + 44, 24, app.color);
      icon(ctx, app.icon, 62, y + 44, 15, app.color === "#e8e8ea" ? "#1c1c1e" : "#fff");
      text(ctx, labels[id], 100, y + 38, 16, "#fff", { w: 600 });
      text(ctx, "Recently used", 100, y + 60, 11.5, "#8e8e93");
      this.addHit("card" + i, 16, y, W - 32, 88);
    });
  }

  drawNotifications(ctx) {
    text(ctx, "NOTIFICATIONS", 240, 40, 11, "#8e8e93", { a: "center", w: 700 });
    text(ctx, "×", 22, 44, 20, "#8e8e93", { a: "center", w: 500 });
    this.addHit("close", 8, 24, 44, 36);
    text(ctx, "Clear All", 448, 44, 13, "#0a84ff", { a: "right", w: 600 });
    this.addHit("clear", 380, 26, 88, 30);
    if (!this.notifications.length) {
      icon(ctx, "bell", 240, 170, 34, "#3a3a3c");
      text(ctx, "No Notifications", 240, 230, 16, "#fff", { a: "center", w: 600 });
      text(ctx, "You're all caught up", 240, 252, 12, "#8e8e93", { a: "center" });
      return;
    }
    this.notifications.forEach((n, i) => {
      const y = 62 + i * 76;
      fillRR(ctx, 16, y, W - 32, 68, 16, "#1c1c1e");
      circle(ctx, 46, y + 34, 16, n.color);
      icon(ctx, n.ic, 46, y + 34, 9, "#fff");
      text(ctx, n.title, 74, y + 22, 13.5, "#fff", { w: 600 });
      text(ctx, n.body.length > 42 ? n.body.slice(0, 41) + "…" : n.body, 74, y + 40, 11.5, "#9a9ca1");
      text(ctx, n.time, 452, y + 22, 11, "#8e8e93", { a: "right" });
      this.addHit("n" + i, 16, y, W - 32, 68);
      if (i >= 4) return;
    });
  }

  drawControl(ctx) {
    text(ctx, "Done", 24, 40, 14, "#0a84ff", { w: 600 });
    this.addHit("done", 8, 20, 80, 34);
    const status = [
      { id: "airplane", ic: "airplane", x: 110 },
      { id: "wifi", ic: "wifi", x: 240 },
      { id: "dnd", ic: "moon", x: 370 },
    ];
    const statusOn = { airplane: this.settings.airplane, wifi: true, dnd: this.settings.dnd };
    for (const s of status) {
      circle(ctx, s.x, 100, 25, "#1c1c1e");
      icon(ctx, s.ic, s.x, 100, 12, statusOn[s.id] ? "#0a84ff" : "#5a5a5e");
      this.addHit(s.id, s.x - 25, 75, 50, 50);
    }
    // battery ring
    const b = this.battery;
    ring(ctx, 240, 218, 62, 7, "#2c2c2e");
    ring(ctx, 240, 218, 62, 7, b > 50 ? "#30d158" : b > 20 ? "#ff9f0a" : "#ff453a", -Math.PI / 2, -Math.PI / 2 + (b / 100) * TAU);
    text(ctx, Math.round(b) + "%", 240, 228, 28, "#fff", { a: "center", w: 600 });
    this.addHit("batt", 178, 156, 124, 124);
    const toggles = [
      { id: "flashlight", ic: "flashlight", x: 110, y: 316 },
      { id: "theater", ic: "close", x: 240, y: 316 },
      { id: "water", ic: "drop", x: 370, y: 316 },
      { id: "ping", ic: "phone", x: 175, y: 368 },
      { id: "sleep", ic: "moon", x: 305, y: 368 },
    ];
    const on = { flashlight: false, theater: this.settings.theater, water: this.settings.water, ping: false, sleep: this.settings.dnd };
    for (const t2 of toggles) {
      if (on[t2.id]) circle(ctx, t2.x, t2.y, 23, "#ff9f0a");
      else circle(ctx, t2.x, t2.y, 23, "#1c1c1e");
      icon(ctx, t2.ic, t2.x, t2.y, 11, on[t2.id] ? "#fff" : "#8e8e93");
      this.addHit(t2.id, t2.x - 23, t2.y - 23, 46, 46);
    }
    if (this.pingT > 0) {
      text(ctx, "Pinging iPhone…", 240, 300, 13, "#64d2ff", { a: "center", w: 600 });
      ring(ctx, 240, 218, 62 + (1.6 - this.pingT) * 30, 2, `rgba(100,210,255,${(this.pingT / 1.6).toFixed(2)})`);
    }
  }

  drawWallet(ctx) {
    text(ctx, "×", 446, 42, 18, "#8e8e93", { a: "center", w: 500 });
    this.addHit("close", 426, 22, 40, 36);
    const paid = this.wallet.paid > 0;
    ctx.save(); rr(ctx, 90, 96, 300, 190, 24); ctx.clip();
    ctx.fillStyle = vGrad(ctx, 90, 96, 0, 190, [[0, "#1d2b53"], [0.5, "#232c5e"], [1, "#4a2c63"]]);
    ctx.fillRect(90, 96, 300, 190);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath(); ctx.arc(330, 130, 130, 0, TAU); ctx.fill();
    ctx.restore();
    rr(ctx, 90, 96, 300, 190, 24); ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1.4; ctx.stroke();
    fillRR(ctx, 118, 130, 48, 34, 7, "#d9b45c");
    fillRR(ctx, 134, 138, 16, 10, 2, "#8a6d2f");
    text(ctx, "VISA", 392, 224, 20, "rgba(255,255,255,0.85)", { a: "right", w: 700 });
    text(ctx, "••••  ••••  ••••  1234", 118, 260, 16, "rgba(255,255,255,0.9)", { w: 500 });
    if (paid) {
      circle(ctx, 240, 160, 30, "#30d158");
      icon(ctx, "check", 240, 160, 16, "#fff");
      text(ctx, "Payment Sent", 240, 216, 17, "#fff", { a: "center", w: 600 });
      text(ctx, "$4.99 · Coffee Shop", 240, 238, 12, "#9a9ca1", { a: "center" });
    } else {
      text(ctx, "Ready", 240, 162, 20, "#fff", { a: "center", w: 600 });
      text(ctx, "Hold near reader to pay", 240, 186, 12, "#9a9ca1", { a: "center" });
      text(ctx, "$4.99", 240, 244, 15, "rgba(255,255,255,0.7)", { a: "center", w: 500 });
    }
    this.addHit("pay", 90, 96, 300, 190);
  }

  drawWaterLock(ctx) {
    const wob = Math.sin(this.t * 2) * 0.12 + (this.unlock * 0.1);
    ctx.save(); ctx.translate(240, 160); ctx.rotate(wob);
    icon(ctx, "drop", 0, 0, 56, "#64d2ff");
    ctx.restore();
    text(ctx, "Water Lock", 240, 250, 17, "#fff", { a: "center", w: 600 });
    text(ctx, "Turn the Digital Crown to unlock", 240, 276, 12, "#9a9ca1", { a: "center" });
    for (let i = 0; i < 6; i++) {
      const x = 240 + (i - 2.5) * 24;
      circle(ctx, x, 320, 5, i < this.unlock ? "#64d2ff" : "#2c2c2e");
    }
  }

  drawFlashlight(ctx) {
    const m = this.flash.mode;
    let col = "#ffffff";
    if (m === 0) col = "#ffffff";
    else if (m === 1) col = "#ff3b30";
    else col = Math.sin(this.t * 14) > 0 ? "#ffffff" : "#2a2a2a";
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, W, H);
    icon(ctx, "flashlight", 240, 210, 34, m === 1 ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.4)");
    for (let i = 0; i < 3; i++) circle(ctx, 226 + i * 14, 352, 4, i === m ? "#ff9f0a" : "rgba(0,0,0,0.3)");
    text(ctx, m === 0 ? "Tap for red light" : m === 1 ? "Tap for strobe" : "Tap to turn off", 240, 380, 10, "rgba(0,0,0,0.45)", { a: "center", w: 600 });
  }

  drawPowerReserve(ctx) {
    icon(ctx, "battery", 240, 160, 44, "#ff453a");
    text(ctx, "Power Reserve", 240, 240, 16, "#fff", { a: "center", w: 600 });
    text(ctx, "Battery is empty. Recharge from the control panel.", 240, 266, 11.5, "#9a9ca1", { a: "center" });
    text(ctx, this.time12(), 452, 30, 12, "#8e8e93", { a: "right", w: 500 });
  }

  // ---------- info ----------
  labelFor(s) {
    const map = {
      face: FACES[this.faceIndex].name, grid: "App Grid", dock: "Recent Apps",
      notifications: "Notification Center", control: "Control Center", wallet: "Wallet",
      waterlock: "Water Lock", flashlight: "Flashlight", powerreserve: "Power Reserve",
    };
    if (map[s]) return map[s];
    if (s.startsWith("app:")) { const a = APPS.find((x) => "app:" + x.id === s); return a ? a.name : s; }
    return s;
  }
  hud() {
    return {
      face: FACES[this.faceIndex].name,
      state: this.state,
      stateLabel: this.labelFor(this.state),
      battery: Math.round(this.battery),
      sound: !!this.settings.sounds,
    };
  }
}

export { FACES, APPS };
