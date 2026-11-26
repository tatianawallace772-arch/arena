import JSZip from 'jszip';
import { generateProjectPython, generateSpriteJavaScript } from '../blockly/codePreview';
import { STAGE_DIMENSIONS, type ProjectModel } from '../types/studio';

async function urlToBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function inlineProjectAssets(project: ProjectModel): Promise<ProjectModel> {
  const cloned: ProjectModel = JSON.parse(JSON.stringify(project));
  for (const sp of cloned.sprites) {
    for (const c of sp.costumes) {
      c.dataUrl = await urlToBase64(c.dataUrl);
    }
  }
  for (const bg of cloned.backdrops) {
    bg.dataUrl = await urlToBase64(bg.dataUrl);
  }
  return cloned;
}

export async function buildStandaloneHtmlApp(project: ProjectModel): Promise<string> {
  const inlined = await inlineProjectAssets(project);
  const dim = STAGE_DIMENSIONS[inlined.stageMode];
  const safeJson = JSON.stringify(inlined).replace(/<\/script>/gi, '<\\/script>');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${inlined.title.replace(/</g, '&lt;')} — Built with BlockCraft &amp; Google Blockly</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, #1e1b4b, #090d16 75%);
      color: #f8fafc;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 20px;
    }
    .app-shell {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 20px;
      padding: 16px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.55);
      max-width: 100%;
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .title { font-weight: 700; font-size: 16px; }
    .controls { display: flex; gap: 8px; }
    .btn {
      border: none;
      border-radius: 10px;
      padding: 7px 14px;
      font-weight: 700;
      cursor: pointer;
      font-size: 13px;
    }
    .btn-run { background: #10b981; color: #052e16; }
    .btn-stop { background: #ef4444; color: #fff; }
    .stage {
      position: relative;
      width: ${dim.width}px;
      height: ${dim.height}px;
      max-width: calc(100vw - 64px);
      overflow: hidden;
      border-radius: 14px;
      background: #1e1b4b;
      user-select: none;
    }
    .stage-bg {
      position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none;
    }
    canvas.layer {
      position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;
    }
    .sprite {
      position: absolute;
      transform-origin: center center;
      cursor: pointer;
      will-change: transform;
    }
    .bubble {
      position: absolute;
      background: #fff;
      color: #0f172a;
      padding: 6px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      border: 2px solid #cbd5e1;
      white-space: nowrap;
      transform: translate(-50%, -100%);
      pointer-events: none;
      z-index: 40;
    }
    .var-badge {
      position: absolute;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 8px;
      z-index: 35;
    }
    .var-badge span {
      background: #ff8c1a;
      color: #fff;
      padding: 1px 6px;
      border-radius: 5px;
      margin-left: 6px;
    }
    .ui-widget { position: absolute; transform: translate(-50%, -50%); z-index: 30; }
    .footer { margin-top: 10px; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="app-shell">
    <div class="toolbar">
      <div class="title">🚀 ${inlined.title.replace(/</g, '&lt;')}</div>
      <div class="controls">
        <button class="btn btn-run" id="btnFlag">🚩 Run App</button>
        <button class="btn btn-stop" id="btnStop">■ Stop</button>
      </div>
    </div>
    <div class="stage" id="stage">
      <img class="stage-bg" id="bgImg" alt="backdrop" />
      <canvas class="layer" id="penCanvas" width="${dim.width}" height="${dim.height}"></canvas>
      <div id="spritesLayer"></div>
      <div id="uiLayer"></div>
      <canvas class="layer" id="fxCanvas" width="${dim.width}" height="${dim.height}"></canvas>
    </div>
    <div class="footer">Built with BlockCraft Scratch App Maker &amp; Google Blockly</div>
  </div>
  <script>
    const PROJECT = ${safeJson};
    const W = ${dim.width}, H = ${dim.height}, HW = W / 2, HH = H / 2;
    const stageEl = document.getElementById('stage');
    const bgImg = document.getElementById('bgImg');
    const penCtx = document.getElementById('penCanvas').getContext('2d');
    const fxCtx = document.getElementById('fxCanvas').getContext('2d');
    const spritesLayer = document.getElementById('spritesLayer');
    const uiLayer = document.getElementById('uiLayer');

    let epoch = 0;
    const keys = new Set();
    let mouseX = 0, mouseY = 0, mouseDown = false;
    const particles = [];

    window.addEventListener('keydown', e => { keys.add(e.key); triggerHats('event_whenkeypressed', b => b.fields?.KEY === 'any' || (b.fields?.KEY || '').toLowerCase() === e.key.toLowerCase()); });
    window.addEventListener('keyup', e => keys.delete(e.key));
    stageEl.addEventListener('mousemove', e => {
      const r = stageEl.getBoundingClientRect();
      mouseX = ((e.clientX - r.left) / r.width) * W - HW;
      mouseY = HH - ((e.clientY - r.top) / r.height) * H;
    });
    stageEl.addEventListener('mousedown', () => mouseDown = true);
    window.addEventListener('mouseup', () => mouseDown = false);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playBeep(freq = 580, dur = 0.16) {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.2, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    }

    function spawnBurst(x, y, count) {
      const sx = HW + x, sy = HH - y;
      const cols = ['#FFE066', '#FF6B6B', '#4DABF7', '#63E6BE', '#E599F7'];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 4;
        particles.push({ x: sx, y: sy, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 1, r: 3 + Math.random()*4, c: cols[i % cols.length], alpha: 1 });
      }
    }

    function getInp(n, k) { const s = n.inputs?.[k]; return s ? (s.block || s.shadow) : null; }

    function evalVal(sp, n) {
      if (!n) return 0;
      const f = n.fields || {};
      switch (n.type) {
        case 'math_number_scratch': return Number(f.NUM || 0);
        case 'text_scratch': return String(f.TEXT || '');
        case 'motion_xposition': return sp.x;
        case 'motion_yposition': return sp.y;
        case 'sensing_keypressed': return f.KEY_OPTION === 'any' ? keys.size > 0 : (keys.has(f.KEY_OPTION) || keys.has(String(f.KEY_OPTION).toLowerCase()));
        case 'sensing_touchingobject': {
          const t = f.TOUCHINGOBJECTMENU;
          if (t === '_mouse_') return Math.hypot(mouseX - sp.x, mouseY - sp.y) < 38;
          if (t === '_edge_') return Math.abs(sp.x) > HW - 24 || Math.abs(sp.y) > HH - 24;
          const o = PROJECT.sprites.find(s => s.name === t || s.id === t);
          return o ? Math.hypot(o.x - sp.x, o.y - sp.y) < 52 : false;
        }
        case 'data_variable': {
          const v = PROJECT.variables.find(x => x.name === f.VARIABLE);
          return v ? v.value : 0;
        }
        case 'appui_get_value': {
          const w = PROJECT.widgets.find(x => x.id === f.WIDGET);
          return w ? w.value : '';
        }
        case 'operator_add': return Number(evalVal(sp, getInp(n,'NUM1'))) + Number(evalVal(sp, getInp(n,'NUM2')));
        case 'operator_subtract': return Number(evalVal(sp, getInp(n,'NUM1'))) - Number(evalVal(sp, getInp(n,'NUM2')));
        case 'operator_multiply': return Number(evalVal(sp, getInp(n,'NUM1'))) * Number(evalVal(sp, getInp(n,'NUM2')));
        case 'operator_divide': return Number(evalVal(sp, getInp(n,'NUM1'))) / (Number(evalVal(sp, getInp(n,'NUM2'))) || 1);
        case 'operator_gt': return Number(evalVal(sp, getInp(n,'OPERAND1'))) > Number(evalVal(sp, getInp(n,'OPERAND2')));
        case 'operator_lt': return Number(evalVal(sp, getInp(n,'OPERAND1'))) < Number(evalVal(sp, getInp(n,'OPERAND2')));
        case 'operator_equals': return String(evalVal(sp, getInp(n,'OPERAND1'))) == String(evalVal(sp, getInp(n,'OPERAND2')));
        case 'operator_join': return String(evalVal(sp, getInp(n,'STRING1'))) + String(evalVal(sp, getInp(n,'STRING2')));
        case 'operator_random': {
          const a = Number(evalVal(sp, getInp(n,'FROM'))), b = Number(evalVal(sp, getInp(n,'TO')));
          return Math.floor(Math.random() * (b - a + 1)) + a;
        }
        default: return 0;
      }
    }

    const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
    const waitSec = s => new Promise(r => setTimeout(r, Math.max(0, s * 1000)));

    function moveTo(sp, nx, ny) {
      if (sp.pen.isDown) {
        penCtx.strokeStyle = sp.pen.color || '#7c3aed';
        penCtx.lineWidth = sp.pen.size || 3;
        penCtx.lineCap = 'round';
        penCtx.beginPath();
        penCtx.moveTo(HW + sp.x, HH - sp.y);
        penCtx.lineTo(HW + nx, HH - ny);
        penCtx.stroke();
      }
      sp.x = Math.max(-HW, Math.min(HW, nx));
      sp.y = Math.max(-HH, Math.min(HH, ny));
    }

    async function runStack(sp, cur, myEpoch) {
      while (cur && myEpoch === epoch) {
        const f = cur.fields || {};
        switch (cur.type) {
          case 'motion_movesteps': {
            const d = Number(evalVal(sp, getInp(cur, 'STEPS')));
            const rad = ((90 - sp.direction) * Math.PI) / 180;
            moveTo(sp, sp.x + Math.cos(rad) * d, sp.y + Math.sin(rad) * d);
            break;
          }
          case 'motion_turnright': sp.direction += Number(evalVal(sp, getInp(cur, 'DEGREES'))); break;
          case 'motion_turnleft': sp.direction -= Number(evalVal(sp, getInp(cur, 'DEGREES'))); break;
          case 'motion_gotoxy': moveTo(sp, Number(evalVal(sp, getInp(cur,'X'))), Number(evalVal(sp, getInp(cur,'Y')))); break;
          case 'motion_goto':
            if (f.TO === '_random_') moveTo(sp, (Math.random()*2-1)*(HW-35), (Math.random()*2-1)*(HH-35));
            break;
          case 'motion_pointindirection': sp.direction = Number(f.DIRECTION || 90); break;
          case 'motion_changexby': moveTo(sp, sp.x + Number(evalVal(sp, getInp(cur,'DX'))), sp.y); break;
          case 'motion_changeyby': moveTo(sp, sp.x, sp.y + Number(evalVal(sp, getInp(cur,'DY')))); break;
          case 'looks_sayforsecs': {
            sp.bubble = { text: String(evalVal(sp, getInp(cur,'MESSAGE'))) };
            renderStage();
            await waitSec(Number(evalVal(sp, getInp(cur,'SECS'))));
            sp.bubble = null;
            break;
          }
          case 'looks_say': sp.bubble = { text: String(evalVal(sp, getInp(cur,'MESSAGE'))) }; break;
          case 'looks_nextcostume': sp.currentCostumeIndex = (sp.currentCostumeIndex + 1) % sp.costumes.length; break;
          case 'looks_switchcostumeto': {
            const idx = sp.costumes.findIndex(c => c.name === f.COSTUME);
            if (idx >= 0) sp.currentCostumeIndex = idx;
            break;
          }
          case 'sound_play': case 'sound_playuntildone': playBeep(660, 0.16); break;
          case 'sound_speak': if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(String(evalVal(sp, getInp(cur,'TEXT'))))); break;
          case 'data_setvariableto': {
            const v = PROJECT.variables.find(x => x.name === f.VARIABLE);
            if (v) v.value = evalVal(sp, getInp(cur,'VALUE'));
            break;
          }
          case 'data_changevariableby': {
            const v = PROJECT.variables.find(x => x.name === f.VARIABLE);
            if (v) v.value = Number(v.value || 0) + Number(evalVal(sp, getInp(cur,'VALUE')));
            break;
          }
          case 'pen_clear': penCtx.clearRect(0, 0, W, H); break;
          case 'pen_pendown': sp.pen.isDown = true; break;
          case 'pen_penup': sp.pen.isDown = false; break;
          case 'pen_changepenhueby': sp.pen.hue = ((sp.pen.hue || 0) + Number(evalVal(sp, getInp(cur,'HUE')))) % 360; sp.pen.color = 'hsl(' + sp.pen.hue + ',85%,55%)'; break;
          case 'appui_set_value': {
            const w = PROJECT.widgets.find(x => x.id === f.WIDGET);
            if (w) { w.value = String(evalVal(sp, getInp(cur,'VALUE'))); renderUI(); }
            break;
          }
          case 'fx_particles': spawnBurst(sp.x, sp.y, Number(evalVal(sp, getInp(cur,'COUNT')) || 16)); break;
          case 'control_wait': await waitSec(Number(evalVal(sp, getInp(cur,'DURATION')))); break;
          case 'control_repeat': {
            const n = Number(evalVal(sp, getInp(cur,'TIMES')));
            for (let i = 0; i < n && myEpoch === epoch; i++) {
              await runStack(sp, getInp(cur,'SUBSTACK'), myEpoch);
              await nextFrame();
            }
            break;
          }
          case 'control_forever': {
            while (myEpoch === epoch) {
              await runStack(sp, getInp(cur,'SUBSTACK'), myEpoch);
              await nextFrame();
            }
            return;
          }
          case 'control_if':
            if (evalVal(sp, getInp(cur,'CONDITION'))) await runStack(sp, getInp(cur,'SUBSTACK'), myEpoch);
            break;
          case 'control_if_else':
            if (evalVal(sp, getInp(cur,'CONDITION'))) await runStack(sp, getInp(cur,'SUBSTACK'), myEpoch);
            else await runStack(sp, getInp(cur,'SUBSTACK2'), myEpoch);
            break;
        }
        cur = cur.next?.block;
      }
    }

    function triggerHats(type, pred) {
      const myEpoch = epoch;
      for (const sp of PROJECT.sprites) {
        const blocks = sp.workspaceState?.blocks?.blocks || [];
        for (const top of blocks) {
          if (top.type === type && (!pred || pred(top, sp)) && top.next?.block) {
            runStack(sp, top.next.block, myEpoch);
          }
        }
      }
    }

    function renderUI() {
      uiLayer.innerHTML = '';
      for (const w of PROJECT.widgets) {
        if (!w.visible) continue;
        const wrap = document.createElement('div');
        wrap.className = 'ui-widget';
        wrap.style.left = (HW + w.x) + 'px';
        wrap.style.top = (HH - w.y) + 'px';
        if (w.type === 'button') {
          const b = document.createElement('button');
          b.textContent = w.label;
          Object.assign(b.style, {
            width: w.width + 'px', height: w.height + 'px', background: w.color, color: w.textColor,
            border: 'none', borderRadius: w.borderRadius + 'px', fontWeight: '700', cursor: 'pointer', fontSize: w.fontSize + 'px'
          });
          b.onclick = () => { playBeep(740, 0.06); triggerHats('appui_when_clicked', top => top.fields?.WIDGET === w.id); };
          wrap.appendChild(b);
        } else if (w.type === 'input') {
          const inp = document.createElement('input');
          inp.placeholder = w.placeholder || '';
          inp.value = w.value || '';
          Object.assign(inp.style, { width: w.width + 'px', height: w.height + 'px', borderRadius: '10px', padding: '0 10px', border: '2px solid #6366f1' });
          inp.oninput = e => { w.value = e.target.value; };
          wrap.appendChild(inp);
        } else if (w.type === 'slider') {
          const box = document.createElement('div');
          box.style.background = 'rgba(15,23,42,0.82)'; box.style.padding = '4px 8px'; box.style.borderRadius = '8px'; box.style.fontSize = '11px';
          box.innerHTML = '<div>' + w.label + ': <b>' + w.value + '</b></div>';
          const s = document.createElement('input'); s.type = 'range'; s.min = w.min ?? 0; s.max = w.max ?? 100; s.value = w.value;
          s.oninput = e => { w.value = e.target.value; box.firstChild.innerHTML = w.label + ': <b>' + w.value + '</b>'; };
          box.appendChild(s); wrap.appendChild(box);
        } else {
          const d = document.createElement('div');
          d.textContent = w.type === 'progress' ? (w.label + ': ' + w.value + '%') : w.label;
          Object.assign(d.style, { background: w.color, color: w.textColor, padding: '6px 14px', borderRadius: w.borderRadius + 'px', fontWeight: '700', fontSize: w.fontSize + 'px' });
          wrap.appendChild(d);
        }
        uiLayer.appendChild(wrap);
      }
    }

    function renderStage() {
      bgImg.src = PROJECT.backdrops[PROJECT.currentBackdropIndex]?.dataUrl || '';
      spritesLayer.innerHTML = '';
      for (const sp of PROJECT.sprites) {
        if (!sp.visible) continue;
        const c = sp.costumes[sp.currentCostumeIndex] || sp.costumes[0];
        if (!c) continue;
        const img = document.createElement('img');
        img.className = 'sprite';
        img.src = c.dataUrl;
        const pxSize = (sp.size / 100) * (c.dataUrl.length > 8000 ? 340 : 120);
        img.style.width = pxSize + 'px';
        img.style.left = (HW + sp.x - pxSize / 2) + 'px';
        img.style.top = (HH - sp.y - pxSize / 2) + 'px';
        const flip = sp.rotationStyle === 'left-right' && sp.direction < 0 ? 'scaleX(-1)' : (sp.rotationStyle === 'all around' ? 'rotate(' + (sp.direction - 90) + 'deg)' : '');
        img.style.transform = flip;
        img.onclick = () => triggerHats('event_whenthisspriteclicked', (_, target) => target.id === sp.id);
        spritesLayer.appendChild(img);
        if (sp.bubble) {
          const b = document.createElement('div');
          b.className = 'bubble';
          b.textContent = sp.bubble.text;
          b.style.left = (HW + sp.x) + 'px';
          b.style.top = (HH - sp.y - pxSize * 0.48) + 'px';
          spritesLayer.appendChild(b);
        }
      }
      for (const v of PROJECT.variables) {
        if (!v.visible) continue;
        const vb = document.createElement('div');
        vb.className = 'var-badge';
        vb.style.left = (HW + v.x) + 'px';
        vb.style.top = (HH - v.y) + 'px';
        vb.innerHTML = v.name + '<span>' + v.value + '</span>';
        spritesLayer.appendChild(vb);
      }
    }

    function loop() {
      renderStage();
      fxCtx.clearRect(0, 0, W, H);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.alpha -= 0.024;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        fxCtx.globalAlpha = p.alpha; fxCtx.fillStyle = p.c;
        fxCtx.beginPath(); fxCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); fxCtx.fill();
      }
      fxCtx.globalAlpha = 1;
      requestAnimationFrame(loop);
    }

    document.getElementById('btnFlag').onclick = () => { epoch++; triggerHats('event_whenflagclicked'); };
    document.getElementById('btnStop').onclick = () => { epoch++; };
    renderUI();
    loop();
    triggerHats('event_whenflagclicked');
  </script>
</body>
</html>`;
}

export async function exportGitHubRepoZip(project: ProjectModel): Promise<Blob> {
  const zip = new JSZip();
  const inlined = await inlineProjectAssets(project);
  const html = await buildStandaloneHtmlApp(inlined);
  const slug =
    project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'scratch-blockly-app';

  const jsCode = inlined.sprites.map((s) => generateSpriteJavaScript(s)).join('\n\n');
  const pyCode = generateProjectPython(inlined.sprites);

  zip.file('index.html', html);
  zip.file('project.blockcraft.json', JSON.stringify(inlined, null, 2));
  zip.file('scripts/generated.js', jsCode);
  zip.file('scripts/generated.py', pyCode);
  zip.file(
    'package.json',
    JSON.stringify(
      {
        name: slug,
        version: '1.0.0',
        private: true,
        description: `${project.title} — Built with BlockCraft Scratch App Maker & Google Blockly`,
        dependencies: {
          blockly: '^13.5.0',
          '@blockly/continuous-toolbox': '^13.5.0',
          '@blockly/field-angle': '^13.5.0',
          '@blockly/field-colour': '^13.5.0',
        },
      },
      null,
      2
    )
  );
  zip.file(
    '.github/workflows/deploy-pages.yml',
    `name: Deploy Scratch Blockly App to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Configure Pages
        uses: actions/configure-pages@v5
      - name: Upload static app artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`
  );
  zip.file(
    'README.md',
    `# ${project.title}

Built with **BlockCraft Studio** (Scratch App Maker + **Google Blockly v13.5 Zelos Engine**).

## Quick Run
Open \`index.html\` directly in any browser — all sprites, costumes, UI widgets, and sound effects are bundled inside!

## Install Blockly & Push to GitHub
\`\`\`bash
npm install
git init
git add .
git commit -m "Initial Scratch + Google Blockly app"
gh repo create ${slug} --public --source=. --push
\`\`\`

GitHub Actions (\`.github/workflows/deploy-pages.yml\`) will automatically publish \`index.html\` to GitHub Pages!
`
  );

  return await zip.generateAsync({ type: 'blob' });
}
