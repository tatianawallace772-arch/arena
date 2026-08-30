import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';
import '../styles/app.css';
import { App, SHORTCUTS } from './tui/app.js';
import { Recorder } from './share/recorder.js';
import { themeByName } from './ansi/theme.js';

const LS = {
  font: 'ccsim.fontSize',
  theme: 'ccsim.theme',
  sessions: 'ccsim.sessions',
};

const params = new URLSearchParams(location.search);
const want = (name) => params.get(name);
const num = (name, dflt) => {
  const n = Number.parseInt(want(name) ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};
const fixedSize = want('fit') === '0';

// ---------------------------------------------------------------- browser chrome
const termEl = document.getElementById('terminal');
const sizeEl = document.getElementById('size');
const titleEl = document.getElementById('title');
const modeBadge = document.getElementById('mode-badge');
const modelBadge = document.getElementById('model-badge');
const overlay = document.getElementById('overlay');
const sheetBody = document.getElementById('sheet-body');
const sheetTitle = document.getElementById('sheet-title');

const initialTheme = want('theme') || localStorage.getItem(LS.theme) || 'dark';
const savedFont = Number.parseInt(localStorage.getItem(LS.font) ?? '', 10);
let fontSize = clamp(savedFont || num('font', 13.6), 9, 24);

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

const themePayload = (name) => {
  const t = themeByName(name).xtermTheme();
  if (!t) return { background: '#1f1e1d', foreground: '#f0eee6' };
  return t;
};

const term = new Terminal({
  fontFamily: "'JetBrains Mono', 'SFMono-Regular', Menlo, Consolas, 'DejaVu Sans Mono', monospace",
  fontSize,
  fontWeight: '450',
  fontWeightBold: '700',
  lineHeight: 1.14,
  letterSpacing: 0,
  cursorBlink: true,
  allowProposedApi: true,
  scrollback: 8000,
  convertEol: false,
  disableStdin: false,
  theme: themePayload(initialTheme),
  cols: num('cols', 96),
  rows: num('rows', 30),
});
const fit = new FitAddon();
term.loadAddon(fit);
term.loadAddon(new WebLinksAddon());
const u11 = new Unicode11Addon();
term.loadAddon(u11);
term.unicode.activeVersion = '11';

term.open(termEl);
if (!fixedSize) doFit();

function doFit() {
  try {
    fit.fit();
  } catch {
    /* xterm can throw during a transient zero-size layout */
  }
}

const recorder = new Recorder({ cols: term.cols, rows: term.rows });

const app = new App({
  write: (data) => term.write(data),
  size: () => ({ rows: term.rows, cols: term.cols }),
  recorder,
  themeName: initialTheme,
  speed: Number.parseFloat(want('speed') ?? '1') || 1,
  sessions: {
    list: listSessions,
    save: saveSession,
  },
});

app.onTheme = (payload, name) => {
  term.options.theme = payload ?? themePayload(name);
  document.body.dataset.theme = name;
  localStorage.setItem(LS.theme, name);
};
document.body.dataset.theme = initialTheme;

app.onExport = ({ name, text, mime }) => {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

app.onModeChange = (mode) => {
  modeBadge.textContent = { manual: '⏵⏵ manual approve', acceptEdits: '⏵⏵ accept edits on', plan: '⏸ plan mode', auto: '⚡ auto mode' }[mode];
};
app.onModelChange = (name) => {
  modelBadge.textContent = name;
};
app.onSessionEnd = () => saveSession();

// ---------------------------------------------------------------- io wiring
term.onData((data) => app.handleData(data));
term.onResize(({ cols, rows }) => {
  recorder.cols = cols;
  recorder.rows = rows;
  sizeEl.textContent = `${cols}×${rows}`;
  app.resize();
});

term.attachCustomKeyEventHandler((e) => {
  if (e.type !== 'keydown') return true;
  const mod = e.ctrlKey || e.metaKey;
  // Ctrl/Cmd+C copies a live selection instead of interrupting
  if (mod && e.key === 'c' && term.hasSelection()) {
    navigator.clipboard?.writeText(term.getSelection()).catch(() => {});
    return false;
  }
  if (mod && e.key === 'v' && !e.shiftKey) return true;
  if (e.key === 'Enter' && (e.shiftKey || e.altKey)) {
    e.preventDefault();
    app.handleData('\n');
    return false;
  }
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    app.handleData('\n');
    return false;
  }
  if (mod && e.key === 'l') {
    e.preventDefault();
    return true;
  }
  if (e.key === 'Escape') return true;
  if (mod && ['d', 'o', 't', 'r', 'w', 'a', 'e', 'u', 'k', 'j'].includes(e.key)) {
    // let readline/emacs bindings through to the app instead of the browser
    e.preventDefault();
    return true;
  }
  return true;
});

termEl.addEventListener(
  'wheel',
  (e) => {
    if (app.phase === 'shell') return;
    e.preventDefault();
    const dir = Math.sign(e.deltaY) || 1;
    app.scrollBy(dir * Math.max(1, Math.round(Math.abs(e.deltaY) / 18)));
  },
  { passive: false },
);

term.onSelectionChange(() => {
  /* selection is native; nothing to do, kept for clarity */
});

const focus = () => term.focus();
termEl.addEventListener('mousedown', (e) => {
  if (!window.getSelection()?.toString()) focus();
  e.stopPropagation();
});
document.addEventListener('mousedown', (e) => {
  if (e.target.closest('.tools, .chips, .overlay')) return;
});
window.addEventListener('focus', focus);
if (want('fit') !== '0') {
  new ResizeObserver(() => {
    doFit();
    app.resize();
  }).observe(document.getElementById('window'));
}
window.addEventListener('resize', () => {
  doFit();
  app.resize();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) {
    overlay.hidden = true;
    e.preventDefault();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
    // terminal-style "clear": forward as ctrl+l so the app owns it
    e.preventDefault();
    app.handleData('\x0c');
  }
});

// ---------------------------------------------------------------- toolbar
const CHIPS = [
  { k: 'prompt', label: 'Why are the tests failing? Fix it.', send: 'why are the tests failing? fix it' },
  { k: 'prompt', label: 'Security review of src/store.js', send: 'do a security review of the query building' },
  { k: 'prompt', label: 'Explain this codebase', send: 'explain this codebase' },
  { k: 'prompt', label: 'Add rate limiting to POST /api/mixtapes', send: 'add rate limiting to the POST endpoint' },
  { k: 'prompt', label: 'Refactor routes.js', send: 'refactor routes.js without adding a framework' },
  { k: 'prompt', label: 'Update the README', send: 'update the README with the error shapes' },
  { k: 'prompt', label: 'Write tests for render.js', send: 'write tests for render.js' },
  { k: 'command', label: '/init — generate CLAUDE.md', send: '/init' },
  { k: 'command', label: '/cost — what would this have cost?', send: '/cost' },
  { k: 'command', label: '/doctor — health check', send: '/doctor' },
];

const chipsEl = document.getElementById('chips');
for (const chip of CHIPS) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.innerHTML = `<span class="k">${chip.k === 'command' ? 'slash command' : 'natural language'}</span>${chip.label}`;
  btn.addEventListener('click', async () => {
    await app.runExternal(chip.send);
    focus();
  });
  li.appendChild(btn);
  chipsEl.appendChild(li);
}

document.querySelector('.tools').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 260);
  switch (act) {
    case 'demo':
      await app.runExternal('/demo', { force: true });
      focus();
      break;
    case 'replay':
      replay();
      break;
    case 'copy':
      app.copyTranscript(true);
      focus();
      break;
    case 'export-cast':
      app.exportSession('cast');
      break;
    case 'export-md':
      app.exportSession('md');
      break;
    case 'theme': {
      const order = ['dark', 'light', 'ansi'];
      const next = order[(order.indexOf(app.state.themeName) + 1) % order.length];
      await app.runExternal(`/theme ${next}`, { force: true });
      break;
    }
    case 'font-up':
      setFont(fontSize + 1);
      break;
    case 'font-down':
      setFont(fontSize - 1);
      break;
    case 'keys':
      openSheet('Keyboard shortcuts', SHORTCUTS);
      break;
    case 'fullscreen':
      document.body.classList.toggle('zoomed');
      setTimeout(() => {
        doFit();
        app.resize();
        focus();
      }, 60);
      break;
  }
});

function setFont(size) {
  fontSize = clamp(size, 9, 24);
  term.options.fontSize = fontSize;
  localStorage.setItem(LS.font, String(fontSize));
  doFit();
  app.resize();
}

function openSheet(title, rows) {
  sheetTitle.textContent = title;
  sheetBody.innerHTML = rows
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('');
  overlay.hidden = false;
}

overlay.addEventListener('click', (e) => {
  if (e.target === overlay || e.target.dataset.act === 'close-sheet') overlay.hidden = true;
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------------------------------------------------------------- replay
let replaying = false;
async function replay() {
  if (replaying) return;
  const frames = recorder.frames({ speed: Number.parseFloat(want('replay') ?? '4'), cap: 0.2 });
  if (!frames.length) {
    flashStatus('nothing recorded yet — run a demo first');
    return;
  }
  replaying = true;
  recorder.pause();
  app.dispose();
  term.reset();
  let t0 = performance.now();
  for (const frame of frames) {
    const wait = Math.max(0, t0 + frame.t * 1000 - performance.now());
    await new Promise((r) => setTimeout(r, wait));
    term.write(frame.data);
  }
  replaying = false;
  recorder.resume();
  flashStatus('replay finished');
  await new Promise((r) => setTimeout(r, 450));
  app.prevSnapshot = null;
  app.cache.clear();
  recorder.extraDelay += performance.now() / 1000 - t0 / 1000;
  app.invalidate();
  app.raf();
  focus();
}

function flashStatus(text) {
  sizeEl.textContent = text;
  setTimeout(() => {
    sizeEl.textContent = `${term.cols}×${term.rows}`;
  }, 2200);
}

// ---------------------------------------------------------------- sessions
function readSessions() {
  try {
    return JSON.parse(localStorage.getItem(LS.sessions) ?? '[]');
  } catch {
    return [];
  }
}

function listSessions() {
  return readSessions();
}

function saveSession() {
  const text = app.fullTranscriptPlain();
  if (!text.trim()) return;
  const all = readSessions();
  const title = (app.state.usage?.turns ? `${app.state.usage.turns} turns` : 'session') + ' · ' + new Date().toLocaleString();
  const id = app.state.session.id;
  const entry = { id, title, when: new Date().toLocaleDateString(), turns: app.state.usage.turns, text };
  const idx = all.findIndex((s) => s.id === id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  try {
    localStorage.setItem(LS.sessions, JSON.stringify(all.slice(0, 12)));
  } catch {
    /* quota — keep going, exports still work */
  }
}

window.addEventListener('beforeunload', saveSession);

// ---------------------------------------------------------------- boot
app.start();
sizeEl.textContent = `${term.cols}×${term.rows}`;
focus();

(async () => {
  const prompt = want('prompt');
  const scenario = want('scenario');
  const autoplay = want('autoplay') === '1' || prompt !== null || scenario !== null;
  if (!autoplay) return;
  await new Promise((r) => setTimeout(r, fixedSize ? 200 : 500));
  const seed = prompt || (scenario ? scenarioPrompt(scenario) : null);
  if (app.phase === 'shell') await app.launch(seed ?? '');
  else if (seed) await app.runExternal(seed);
})();

function scenarioPrompt(id) {
  return (
    {
      'fix-tests': 'why are the tests failing? fix it',
      security: 'do a security review of src/store.js',
      explain: 'explain this codebase',
      feature: 'add rate limiting to POST /api/mixtapes',
      refactor: 'refactor src/routes.js without adding a framework',
      docs: 'update the README with the real error shapes',
      tests: 'write tests for render.js',
      perf: 'the /m/:slug page is slow, investigate',
      init: '/init',
    }[id] ?? null
  );
}

window.__sim = { app, term, recorder, fit };
