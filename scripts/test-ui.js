/**
 * Core Codex — scripts/test-ui.js
 * End-to-end UI harness: runs the real frontend (lib/agent/checkout/app)
 * against the real server on :3000 using a minimal DOM shim.
 *
 * Usage:  node scripts/test-ui.js   (server must be running on :3000)
 */
'use strict';

/* ============================== DOM shim ================================== */

class ClassList {
  constructor(el) { this.el = el; }
  _set(v) { this.el.className = v; }
  _tokens() { return this.el.className ? this.el.className.split(/\s+/).filter(Boolean) : []; }
  add(...names) { const t = new Set(this._tokens()); names.forEach((n) => t.add(n)); this._set([...t].join(' ')); }
  remove(...names) { const drop = new Set(names); this._set(this._tokens().filter((n) => !drop.has(n)).join(' ')); }
  contains(n) { return this._tokens().includes(n); }
  toggle(n, force) {
    const has = this.contains(n);
    const want = force === undefined ? !has : !!force;
    if (want && !has) this.add(n);
    if (!want && has) this.remove(n);
    return want;
  }
}

class StyleObj { constructor() { this._props = {}; } setProperty(k, v) { this._props[k] = v; } }

class TextNode {
  constructor(text) { this._text = String(text); this.nodeType = 3; this.parentNode = null; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
}

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.attrs = {};
    this.className = '';
    this.children = [];
    this.parentNode = null;
    this._text = null;        // when created via textContent
    this._html = '';
    this.listeners = {};
    this.style = new StyleObj();
    this.classList = new ClassList(this);
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.value = '';
    this.disabled = false;
    this.hidden = false;
  }
  get id() { return this.attrs.id || ''; }
  set id(v) { this.attrs.id = v; }
  get dataset() {
    const out = {};
    for (const [k, v] of Object.entries(this.attrs)) {
      if (k.startsWith('data-')) out[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    }
    return out;
  }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(v) { this.children = []; this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this.children = []; this._text = null; this._html = String(v); }
  setAttribute(k, v) { this.attrs[k] = String(v); this._html = ''; }
  getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this._text = null;
    this.children.push(node);
    return node;
  }
  removeChild(node) {
    const i = this.children.indexOf(node);
    if (i >= 0) this.children.splice(i, 1);
    node.parentNode = null;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((f) => f !== fn);
  }
  dispatchEvent(evt) {
    evt.target = evt.target || this;
    (this.listeners[evt.type] || []).slice().forEach((fn) => fn(evt));
    return true;
  }
  click() { this.dispatchEvent({ type: 'click', target: this, preventDefault() {}, stopPropagation() {} }); }
  focus() {}
  select() {}
  contains(node) {
    while (node) { if (node === this) return true; node = node.parentNode; }
    return false;
  }
  /* -------- tiny selector engine: #id .class tag [attr] :last-child ------- */
  matches(sel) {
    return String(sel).split(/(?=[.\[#:])|(?<=\])/).every((part) => {
      if (!part) return true;
      if (part.startsWith('#')) return this.attrs.id === part.slice(1);
      if (part.startsWith('.')) return this.classList.contains(part.slice(1));
      if (part.startsWith('[')) {
        const m = part.match(/^\[([a-z-]+)(?:="([^"]*)")?\]$/i);
        if (!m) return true;
        return m[2] === undefined ? this.attrs[m[1]] != null : this.attrs[m[1]] === m[2];
      }
      if (part === ':last-child') return !this.parentNode || this.parentNode.children[this.parentNode.children.length - 1] === this;
      if (part === ':first-child') return !this.parentNode || this.parentNode.children[0] === this;
      return this.tagName === part.toUpperCase();
    });
  }
  _descendants() {
    const out = [];
    const walk = (n) => (n.children || []).forEach((c) => { out.push(c); walk(c); });
    walk(this);
    return out;
  }
  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    const rest = parts.slice(0, -1);
    return this._descendants().filter((n) => {
      if (n.nodeType !== 1 || !n.matches(last)) return false;
      // verify ancestor chain for `rest`
      let node = n.parentNode;
      let idx = rest.length - 1;
      while (node && node.nodeType === 1 && idx >= 0) {
        if (node.matches(rest[idx])) idx--;
        node = node.parentNode;
      }
      return idx < 0;
    });
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function makeEvent(type, extra) {
  return { type, target: null, preventDefault() {}, stopPropagation() {}, ...(extra || {}) };
}

/* ------------------------- document / window / etc ------------------------ */

const documentElement = new Element('html');
const body = new Element('body');
documentElement.appendChild(body);

const document = {
  readyState: 'complete',
  documentElement,
  body,
  createElement: (t) => new Element(t),
  createElementNS: (ns, t) => new Element(t),
  createTextNode: (t) => new TextNode(t),
  getElementById: (id) => documentElement.querySelectorAll(`#${id}`)[0] || null,
  querySelector: (sel) => documentElement.querySelectorAll(sel)[0] || null,
  querySelectorAll: (sel) => documentElement.querySelectorAll(sel),
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); },
  listeners: {},
};

const windowListeners = {};
const windowObj = {
  addEventListener(type, fn) { (windowListeners[type] = windowListeners[type] || []).push(fn); },
  removeEventListener(type, fn) { windowListeners[type] = (windowListeners[type] || []).filter((f) => f !== fn); },
  dispatchEvent(evt) { (windowListeners[evt.type] || []).slice().forEach((fn) => fn(evt)); },
  scrollTo() {},
  innerWidth: 1400,
  innerHeight: 900,
};

class CustomEventShim {
  constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
}

const storage = {};
const localStorageShim = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
};

const realFetch = global.fetch;
const fetchShim = (path, opts) =>
  realFetch(String(path).startsWith('http') ? path : 'http://localhost:3000' + path, opts);

Object.assign(global, {
  document,
  window: windowObj,
  CustomEvent: CustomEventShim,
  localStorage: localStorageShim,
  fetch: fetchShim,
  location: { hash: '#/' },
});
Object.defineProperty(global, 'navigator', {
  value: { clipboard: { writeText: async () => {} } },
  configurable: true,
  writable: true,
});

/* --------------------------- static page scaffold -------------------------- */

function buildScaffold() {
  const mk = (tag, attrs, parent) => {
    const e = new Element(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else e.setAttribute(k, v);
    }
    if (parent) parent.appendChild(e);
    return e;
  };
  const header = mk('header', { id: 'site-header', class: 'site-header' }, body);
  const nav = mk('nav', { id: 'main-nav' }, header);
  mk('a', { 'data-route': '/', href: '#/' }, nav);
  mk('a', { 'data-route': '/agent', href: '#/agent' }, nav);
  mk('a', { 'data-route': '/pricing', href: '#/pricing' }, nav);
  const chip = mk('span', { id: 'engine-chip', class: 'engine-chip' }, header);
  mk('span', { class: 'chip-dot' }, chip);
  mk('span', { id: 'engine-chip-text' }, chip);
  mk('a', { id: 'plan-badge', class: 'plan-badge' }, header);
  mk('button', { id: 'open-settings' }, header);
  mk('main', { id: 'view', class: 'view' }, body);
  mk('footer', { class: 'site-footer' }, body);
  mk('div', { id: 'modal-root', class: 'modal-backdrop' }, body);
  mk('div', { id: 'toast-stack', class: 'toast-stack' }, body);
}

/* --------------------------------- runner --------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, cond) => {
  if (cond) console.log('  ✓ ' + name);
  else { console.error('  ✗ ' + name); failures++; }
};
const go = (hash) => { location.hash = hash; windowObj.dispatchEvent(makeEvent('hashchange')); };

async function waitFor(fn, timeoutMs = 30000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (fn()) return true; } catch { /* not yet */ }
    await sleep(150);
  }
  throw new Error('timeout waiting for ' + label);
}

async function main() {
  buildScaffold();

  require('../public/js/lib.js');
  const CC = windowObj.CC;
  global.CC = CC; // browser scripts rely on the global CC
  require('../public/js/agent.js');
  require('../public/js/checkout.js');
  require('../public/js/app.js');
  check('lib/agent/checkout/app load & init', !!CC && !!CC.Agent && !!CC.Pricing && !!CC.Checkout);

  console.log('\n— Landing —');
  await waitFor(() => document.querySelectorAll('.model-card').length >= 5, 8000, 'model cards');
  check('hero renders', !!document.querySelector('.hero h1'));
  await waitFor(() => document.querySelector('#hero-terminal').textContent.includes('build a todo app'), 10000, 'terminal typing');
  check('terminal animation started', document.querySelector('#hero-terminal').textContent.includes('build a todo app'));
  check('7 model cards', document.querySelectorAll('.model-card').length === 7);

  console.log('\n— Agent: full generation flow —');
  go('#/agent');
  check('composer mounted', !!document.querySelector('.composer textarea'));
  check('empty state suggestions', document.querySelectorAll('.suggest-card').length >= 4);

  const input = document.querySelector('#composer-input');
  input.value = 'build a todo app with filters';
  document.querySelector('#send-btn').click();

  await waitFor(() => CC.ls.get('cc_usage', { count: 0 }).count >= 1, 30000, 'usage bump');
  const sessions = CC.ls.get('cc_sessions', []);
  check('session saved + titled', sessions.length === 1 && /todo/i.test(sessions[0].title));
  check('2 messages stored', sessions[0].messages.length === 2);
  const asst = sessions[0].messages[1];
  check('assistant got content w/ code', /```/.test(asst.content) && asst.content.length > 500);
  check('stages recorded', asst.stages.length >= 5 && asst.stages.every((s) => s.status === 'done'));
  check('files recorded', asst.files.length === 3 && asst.files.every((f) => f.content.length > 100));
  check('files panel shows 3 files', document.querySelectorAll('.file-item').length === 3);
  check('file viewer renders code', (document.querySelector('#file-viewer pre') || {}).textContent !== undefined);
  const mdHtml = (document.querySelector('#chat-inner .md') || { innerHTML: '' }).innerHTML;
  check('markdown rendered w/ code block', mdHtml.includes('code-block'));

  console.log('\n— Agent: ask mode —');
  input.value = 'explain async await';
  document.querySelector('#mode-ask').click();
  document.querySelector('#send-btn').click();
  await waitFor(() => {
    const msgs = CC.ls.get('cc_sessions', [])[0].messages;
    return msgs.length === 4 && msgs[3].content.length > 300;
  }, 30000, 'ask reply');
  const askMsg = CC.ls.get('cc_sessions', [])[0].messages[3];
  check('ask answer streamed', askMsg.content.length > 300 && /async/i.test(askMsg.content));

  console.log('\n— Pricing —');
  go('#/pricing');
  await waitFor(() => document.querySelectorAll('.plan-card').length === 4, 8000, 'plan cards');
  check('4 plan cards', document.querySelectorAll('.plan-card').length === 4);
  check('popular flag on Pro', !!document.querySelector('.popular-flag'));
  document.querySelector('.switch').click(); // annual
  await sleep(100);
  check('annual toggle shows $12.60', document.body.textContent.includes('$12.60'));
  check('faq items', document.querySelectorAll('.faq-item').length === 6);

  console.log('\n— Checkout: validation + success —');
  go('#/checkout?plan=pro&cycle=monthly');
  await waitFor(() => !!document.querySelector('#cc-number'), 8000, 'checkout form');
  check('checkout panels render', !!document.querySelector('.order-total') && !!document.querySelector('#cc-number'));
  check('total is $72.00 monthly', document.querySelector('.order-total .amt').textContent.includes('$72.00'));

  const set = (sel, v) => { document.querySelector(sel).value = v; };
  // invalid submit first
  set('#cc-name', 'A');
  set('#cc-number', '1234');
  set('#cc-exp', '13/99');
  set('#cc-cvc', '1');
  document.querySelector('form').dispatchEvent(makeEvent('submit', {}));
  await sleep(150);
  check('client validation errors shown', document.querySelectorAll('.f-err').length >= 3);

  // valid submit against real server
  set('#cc-name', 'Ada Lovelace');
  set('#cc-number', '4242 4242 4242 4242');
  set('#cc-exp', '12/30');
  set('#cc-cvc', '123');
  set('#cc-email', 'dev@example.com');
  document.querySelector('form').dispatchEvent(makeEvent('submit', {}));
  await waitFor(() => document.body.textContent.includes('Payment successful'), 20000, 'receipt');
  check('receipt rendered', !!document.querySelector('.receipt-rows'));
  check('plan upgraded to Pro', CC.getPlan().id === 'pro' && !!CC.getPlan().orderId);
  check('header badge updated', document.getElementById('plan-badge').textContent === 'Pro');

  console.log('\n— Settings modal —');
  go('#/');
  document.getElementById('open-settings').click();
  await waitFor(() => !!document.querySelector('#set-key'), 5000, 'settings modal');
  check('settings modal opens', !!document.querySelector('#set-model'));
  document.querySelector('#set-key').value = 'abcdef0123456789abcdef0123456789.xy12ab34';
  document.querySelectorAll('.modal-actions .btn-primary')[0].click();
  check('key saved + masked chip', CC.getSettings().apiKey.includes('abcdef') && document.getElementById('engine-chip-text').textContent.includes('z.ai'));

  console.log('\n— Header plan chip reflects Pro —');
  check('plan badge has paid style', document.getElementById('plan-badge').classList.contains('paid'));

  console.log(failures ? `\n${failures} FAILURES` : '\nAll UI harness checks passed ✓');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error('HARNESS ERROR:', err); process.exit(1); });
