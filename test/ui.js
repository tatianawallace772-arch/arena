'use strict';
/* Boots the real client bundle inside jsdom against the running server,
   fails on any uncaught script error, and asserts the UI came alive. */

const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:3000';

(async () => {
  const html = await (await fetch(`${BASE}/`)).text();

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    // xterm/monaco need canvas APIs jsdom lacks; ignore those specifically.
    if (/not implemented|canvas|WebGL|MatchMedia/i.test(e.message)) return;
    errors.push(e.message);
  });
  virtualConsole.on('error', (m) => errors.push(String(m)));

  const dom = new JSDOM(html, {
    url: `${BASE}/`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
    resources: undefined,
  });

  const { window } = dom;

  // Minimal shims for APIs jsdom does not provide but the app touches.
  window.fetch = (url, opts) => fetch(new URL(url, BASE).toString(), opts);
  window.WebSocket = class MockWebSocket {
    static OPEN = 1;
    constructor() {
      this.readyState = 1;
      setTimeout(() => this.onopen && this.onopen(), 5);
    }
    send() {}
    close() {}
  };
  window.ResizeObserver = class { observe() {} disconnect() {} };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.requestAnimationFrame = (cb) => setTimeout(cb, 8);
  window.confirm = () => true;
  window.alert = () => {};

  // xterm needs a real browser (canvas, layout APIs), so stub its surface.
  // The PTY itself is covered by test/smoke.js; here we only validate app logic.
  window.Terminal = class MockTerminal {
    constructor() { this.cols = 100; this.rows = 30; this.element = window.document.createElement('div'); }
    open(el) { if (el) el.appendChild(this.element); }
    loadAddon() {}
    onData() { return { dispose() {} }; }
    write() {}
    writeln() {}
    clear() {}
    reset() {}
    focus() {}
    dispose() {}
  };
  window.FitAddon = { FitAddon: class { fit() {} } };
  window.WebLinksAddon = { WebLinksAddon: class {} };

  // Markdown is the only vendored lib the app really depends on for logic.
  window.eval(fs.readFileSync(path.join(__dirname, '..', 'node_modules/marked/lib/marked.umd.js'), 'utf8'));

  // Now the app itself.
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  try {
    window.eval(appSrc);
  } catch (err) {
    errors.push(`app.js threw: ${err.message}`);
  }

  // Let async boot() finish.
  await new Promise((r) => setTimeout(r, 1800));

  const doc = window.document;
  const results = [];
  const check = (name, cond, extra = '') => {
    results.push({ name, ok: !!cond, extra });
  };

  check('no uncaught client errors', errors.length === 0, errors.join(' | '));
  check('file tree populated', doc.querySelectorAll('#fileTree .tree-row').length > 5,
    `rows=${doc.querySelectorAll('#fileTree .tree-row').length}`);
  check('tree shows server/index.js', [...doc.querySelectorAll('#fileTree .tree-row')]
    .some((r) => r.textContent.includes('index.js')));
  check('connection badge went online', doc.querySelector('#connStatus').className.includes('online'),
    doc.querySelector('#connStatus').className);
  check('git branch rendered in title bar',
    /arena|main|no repo/.test(doc.querySelector('#gitBranch').textContent),
    doc.querySelector('#gitBranch').textContent);
  check('welcome panel visible on first load', !!doc.querySelector('.welcome'));
  check('4 prompt suggestions rendered', doc.querySelectorAll('.suggestion').length === 4);
  check('model selector populated', doc.querySelectorAll('#modelSelect option').length === 3);
  check('terminal host exists', !!doc.querySelector('#terminalHost'));
  check('editor pane has monaco mount', !!doc.querySelector('#monacoContainer'));
  check('composer textarea present', !!doc.querySelector('#promptInput'));
  check('rail has explorer/search/git', doc.querySelectorAll('.rail-btn[data-panel]').length === 3);

  // Exercise a UI interaction: clicking a suggestion should create a user bubble.
  const suggestion = doc.querySelector('.suggestion');
  suggestion.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 120));
  check('clicking a suggestion adds a user message',
    doc.querySelectorAll('.msg.user').length === 1,
    `user msgs=${doc.querySelectorAll('.msg.user').length}`);

  // Markdown rendering path (used for agent replies).
  const md = window.__arena
    ? window.__arena.renderMarkdown('**bold** and `code`\n\n- a\n- b')
    : null;
  check('markdown renders bold/code/lists',
    !!md && md.includes('<strong>') && md.includes('<code>') && md.includes('<li>'),
    String(md).slice(0, 120));

  // XSS guard in the markdown pipeline.
  const evil = window.__arena
    ? window.__arena.renderMarkdown('<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>')
    : '';
  check('markdown strips scripts and handlers',
    !/onerror|<script/i.test(evil), evil);

  // The diagnostics card should render the staged result.
  const diagPromise = window.__arena.runDiagnostics();
  await new Promise((r) => setTimeout(r, 1500));
  await diagPromise;
  const diag = doc.querySelector('.diag-card');
  check('diagnostics card rendered', !!diag);
  check('diagnostics lists connection stages',
    doc.querySelectorAll('.diag-card .diag-row').length >= 4,
    `rows=${doc.querySelectorAll('.diag-card .diag-row').length}`);
  check('diagnostics names the failing stage',
    /TLS handshake|DNS resolution|TCP connection/.test(diag?.textContent || ''),
    (diag?.textContent || '').slice(0, 120));
  check('diagnostics offers a fix',
    /How to fix|Models available/.test(diag?.textContent || ''),
    (diag?.textContent || '').slice(0, 120));

  let failed = 0;
  console.log('\nUI boot test\n');
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n      ${r.extra}`}`);
    if (!r.ok) failed++;
  }
  console.log(`\n  ${results.length - failed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
