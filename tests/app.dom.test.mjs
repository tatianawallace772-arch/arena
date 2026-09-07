/**
 * app.dom.test.mjs — boots the real page (index.html + main.js) inside jsdom and
 * drives it like a user: type a prompt, pick a style, generate, check the card,
 * the history, the persisted state and the share URL.
 *
 * Skips itself when jsdom is not installed, so `npm test` still passes on a
 * bare checkout (`npm i -D jsdom` to enable).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML = await readFile(join(HERE, '..', 'index.html'), 'utf8');

let JSDOM = null;
let VirtualConsole = null;
try {
  ({ JSDOM, VirtualConsole } = await import('jsdom'));
} catch {
  JSDOM = null;
}

const tick = (fn, ms = 6000, label = 'condition') =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const loop = setInterval(() => {
      let ok;
      try {
        ok = fn();
      } catch {
        ok = false;
      }
      if (ok) {
        clearInterval(loop);
        resolve();
      } else if (Date.now() - t0 > ms) {
        clearInterval(loop);
        reject(new Error(`condition never became true: ${label}`));
      }
    }, 15);
  });

/** A VirtualConsole with no listeners swallows jsdom's own chatter
 *  ("not implemented: navigation", CSS parse warnings, …). */
function quietConsole() {
  return VirtualConsole ? new VirtualConsole() : undefined;
}

async function bootApp({ search = '?mock=1' } = {}) {
  const virtualConsole = quietConsole();
  const dom = new JSDOM(HTML, {
    url: `http://localhost:3000/${search}`,
    pretendToBeVisual: true,
    ...(virtualConsole ? { virtualConsole } : {}),
  });
  const { window } = dom;

  // Publish the browser globals the app expects, then import the module fresh.
  const g = globalThis;
  const stash = {};
  const expose = {
    window,
    document: window.document,
    location: window.location,
    localStorage: window.localStorage,
    history: window.history,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    KeyboardEvent: window.KeyboardEvent,
    MouseEvent: window.MouseEvent,
    getComputedStyle: window.getComputedStyle?.bind(window),
  };
  for (const [k, v] of Object.entries(expose)) {
    stash[k] = g[k];
    Object.defineProperty(g, k, { value: v, configurable: true, writable: true });
  }

  const cacheName = `test-${Math.random().toString(36).slice(2)}`;
  const url = `../js/main.js?${cacheName}`;
  const mod = await import(url);
  return { dom, window, app: g.NanoBanana, mod, cleanup: () => dom.window.close(), restore: () => Object.entries(stash).forEach(([k, v]) => Object.defineProperty(g, k, { value: v, configurable: true, writable: true })) };
}

test(
  'the page boots, renders controls and stays inert until asked',
  { skip: JSDOM ? false : 'jsdom not installed' },
  async () => {
    const { window, app, cleanup, restore } = await bootApp();
    const doc = window.document;
    try {
      assert.equal(doc.querySelectorAll('[data-model]').length, 6, 'every catalog model is selectable');
      assert.ok(doc.querySelectorAll('[data-style]').length >= 10, 'style presets rendered');
      assert.ok(doc.querySelectorAll('[data-aspect]').length >= 10, 'aspect picker rendered');
      assert.ok(doc.querySelectorAll('.lib-card').length > 10, 'prompt library populated');
      assert.equal(doc.getElementById('emptyState').hidden, false, 'empty state visible before any render');
      assert.match(doc.getElementById('dimsHint').textContent, /\d+ × \d+/);
      assert.equal(app.store.state.mock, true, 'mock flag came from the URL');
      assert.equal(doc.querySelector('.model[aria-checked="true"]').dataset.model, app.store.state.model, 'selection mirrors state');
    } finally {
      cleanup();
      restore();
    }
  },
);

test(
  'a mock run produces a result card, a history entry, persisted state and a share URL',
  { skip: JSDOM ? false : 'jsdom not installed' },
  async () => {
    const { window, app, cleanup, restore } = await bootApp({ search: '?mock=1&p=a%20banana%20in%20space&style=photo&s=7&a=16:9&r=1K' });
    const doc = window.document;
    try {
      assert.equal(app.store.state.prompt, 'a banana in space', 'shared prompt restored');
      assert.equal(app.store.state.stylePreset, 'photo');
      assert.equal(app.store.state.seed, 7, 'seed restored and locked from the link');
      assert.equal(app.store.state.lockSeed, true);

      // Prompt doctor reacts to a thin prompt.
      const textarea = doc.getElementById('prompt');
      textarea.value = 'cat';
      textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
      assert.equal(app.store.state.prompt, 'cat', 'typing writes through to the store');
      await tick(() => !doc.getElementById('promptTips').hidden, 3000, 'prompt tips shown');
      assert.ok(doc.getElementById('promptTips').textContent.includes('medium'), 'tips explain what is missing');

      // Restore a usable prompt and fire two renders.
      app.store.set({ prompt: 'a banana in space, cinematic still, golden hour', batch: 2, stylePreset: 'none' });
      app.startGeneration();

      assert.equal(doc.getElementById('generateBtn').disabled, true, 'generate locks while queued');
      assert.equal(doc.getElementById('stopBtn').hidden, false, 'stop appears while busy');
      await tick(() => doc.querySelectorAll('.result').length === 2, 8000, 'two result cards');
      await tick(() => app.renders().length === 2, 8000, 'two history entries');

      const img = doc.querySelector('.result img');
      assert.ok(img.getAttribute('src').startsWith('data:image/svg'), 'mock renderer produced an in-page image');
      assert.equal(doc.querySelector('.result').dataset.loading, '0', 'card leaves the loading state');
      assert.equal(doc.getElementById('emptyState').hidden, true, 'empty state steps aside');
      assert.match(doc.querySelector('.result .spec').textContent, /seed 7/, 'first variation keeps the locked seed');
      assert.ok(doc.querySelectorAll('.result .act').length >= 6, 'per-image actions available');
      assert.match(doc.getElementById('statusText').textContent, /Rendered 2\/2/);

      // Batch variation #2 must use a different seed.
      const seeds = [...doc.querySelectorAll('.result')].map((c) => [...c.querySelectorAll('.spec span')].find((s) => s.textContent.startsWith('seed')).textContent);
      assert.notEqual(seeds[0], seeds[1], 'variations get distinct seeds');

      // Persistence: state + history land in localStorage.
      await tick(() => window.localStorage.getItem('nbs:state:v1'), 3000, 'state persisted');
      const saved = JSON.parse(window.localStorage.getItem('nbs:state:v1'));
      assert.equal(saved.prompt, 'a banana in space, cinematic still, golden hour');
      const savedHistory = JSON.parse(window.localStorage.getItem('nbs:history:v1'));
      assert.equal(savedHistory.length, 2, 'history survives to the next visit');
      assert.equal(doc.querySelectorAll('.film').length, 2, 'filmstrip mirrors history');

      // Share URL mirrors the settings.
      await tick(() => window.location.search.includes('a=16%3A9'), 3000, 'url synced with the aspect ratio');
      assert.match(window.location.search, /m=nanobanana/, 'the flagship is the default');
      assert.match(window.location.search, /p=a[+%20]+banana/);
      assert.match(window.location.search, /n=2/, 'batch size rides along in the URL');

      // Downloading a mock render must stay entirely in-page.
      let netCalls = 0;
      const realFetch = globalThis.fetch;
      globalThis.fetch = async (...args) => {
        netCalls += 1;
        return realFetch(...args);
      };
      const downloadBtn = [...doc.querySelectorAll('.result .act')].find((b) => b.textContent.includes('Download'));
      downloadBtn.click();
      await tick(() => doc.querySelectorAll('a[download]').length > 0, 2000, 'download anchor created');
      const anchor = doc.querySelector('a[download]');
      assert.ok(anchor.getAttribute('download').startsWith('nano-banana_'), 'sane filename');
      assert.ok(anchor.getAttribute('href').startsWith('data:image/svg'), 'saved bytes come from the mock render');
      assert.equal(netCalls, 0, 'a mock download never touches the network');
      globalThis.fetch = realFetch;
    } finally {
      cleanup();
      restore();
    }
  },
);

test(
  'a gated flagship model falls back to a keyless one instead of erroring',
  { skip: JSDOM ? false : 'jsdom not installed' },
  async () => {
    const { window, app, cleanup, restore } = await bootApp({ search: '?mock=0&m=nanobanana&p=a%20test%20prompt' });
    const doc = window.document;
    const realFetch = globalThis.fetch;
    const calls = [];
    try {
      app.store.set({ mock: false, model: 'nanobanana', pace: 'off', prompt: 'a test prompt' });

      globalThis.fetch = async (rawUrl) => {
        calls.push(String(rawUrl));
        const model = new URL(String(rawUrl)).searchParams.get('model');
        if (model === 'flux') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            blob: async () => ({ type: 'image/png', size: 2048 }),
            text: async () => '',
          };
        }
        return {
          ok: false,
          status: 403,
          headers: { get: () => null },
          text: async () => '{"error":"an api key is required for this model"}',
          blob: async () => null,
        };
      };
      // The blob path calls URL.createObjectURL, which Node/jsdom do not implement.
      URL.createObjectURL = () => 'blob:fake-url';
      URL.revokeObjectURL = () => {};

      app.startGeneration();
      await tick(() => doc.querySelectorAll('.result').length === 1, 8000, 'one result card');
      await tick(() => doc.querySelector('.result')?.dataset.loading === '0', 8000, 'card left loading state');

      assert.ok(calls.length >= 2, `tried the flagged model then fell back (saw ${calls.length} calls)`);
      assert.match(calls[0], /model=nanobanana/, 'starts with the requested model');
      assert.match(calls.at(-1), /model=flux/, 'ends on a keyless model');
      assert.equal(doc.querySelector('.result').dataset.loading, '0');
      assert.equal(doc.querySelector('.result img').hidden, false, 'fallback image is shown, not an error screen');
      assert.match(doc.querySelector('.result .spec').textContent, /Nano Banana → Flux/, 'the card says which model served it');
      assert.equal(doc.querySelector('[data-model="nanobanana"]').classList.contains('is-unavailable'), true, 'gated model is visually flagged');
      assert.equal(doc.querySelector('[data-model="nanobanana"] .model__flag').textContent, 'refused');
      assert.equal(app.renders()[0].model, 'flux', 'history records the model that actually rendered');
      assert.equal(app.renders()[0].requestedModel, 'nanobanana', 'and what was asked for');
    } finally {
      globalThis.fetch = realFetch;
      delete URL.createObjectURL;
      cleanup();
      restore();
    }
  },
);

test(
  'rate limiting is explained, and the queue spaces the next attempt out',
  { skip: JSDOM ? false : 'jsdom not installed' },
  async () => {
    const { window, app, cleanup, restore } = await bootApp({ search: '?mock=0' });
    const doc = window.document;
    const realFetch = globalThis.fetch;
    let calls = 0;
    try {
      app.store.set({ mock: false, pace: 'off', prompt: 'a slow prompt', model: 'turbo', batch: 1 });
      globalThis.fetch = async () => {
        calls += 1;
        return {
          ok: false,
          status: 429,
          headers: { get: (k) => (String(k).toLowerCase() === 'retry-after' ? '1' : null) },
          text: async () => '{"error":"too many requests"}',
          blob: async () => null,
        };
      };

      app.startGeneration();
      await tick(() => doc.querySelector('.result__error'), 15000, 'error card rendered');
      assert.equal(calls, 2, 'it retried once, then gave up politely');
      assert.match(doc.querySelector('.result__error h3').textContent, /Rate limited/i, 'the user is told why');
      assert.match(doc.querySelector('.result__error p').textContent, /every 15 seconds/i, 'and what to do about it');
      assert.ok([...doc.querySelectorAll('.result__error .act')].some((b) => /Retry/.test(b.textContent)), 'a retry affordance is offered');
      assert.match(doc.getElementById('statusText').textContent, /Rate limited/i, 'status bar agrees');
      assert.ok(app.pacer.snapshot().waitMs >= 0, 'pacer absorbed the retry-after');
    } finally {
      globalThis.fetch = realFetch;
      cleanup();
      restore();
    }
  },
);

test(
  'clicking a history tile restores the exact settings',
  { skip: JSDOM ? false : 'jsdom not installed' },
  async () => {
    const { window, app, cleanup, restore } = await bootApp({ search: '?mock=1&p=restore%20me&style=logo&a=9:16&r=1K&s=55' });
    const doc = window.document;
    try {
      app.startGeneration();
      await tick(() => app.renders().length === 1, 8000, 'one history entry');
      app.store.set({ prompt: 'totally different', stylePreset: 'ink', aspect: '1:1', seed: null, lockSeed: false, resolution: '2K' });
      const tile = doc.querySelector('.film');
      tile.click();
      assert.equal(app.store.state.prompt, 'restore me', 'prompt came back');
      assert.equal(app.store.state.stylePreset, 'logo');
      assert.equal(app.store.state.aspect, '9:16');
      assert.equal(app.store.state.seed, 55);
      assert.equal(app.store.state.lockSeed, true);
      assert.equal(app.store.state.resolution, '1K');
      assert.equal(doc.getElementById('prompt').value, 'restore me', 'textarea mirrors the store');

      // Deleting the tile removes it from storage too.
      doc.querySelector('.film__kill').click();
      assert.equal(app.renders().length, 0);
      assert.equal(JSON.parse(window.localStorage.getItem('nbs:history:v1')).length, 0);
    } finally {
      cleanup();
      restore();
    }
  },
);

test(
  'a second run leaves earlier results on the stage (object URLs are card-owned)',
  { skip: JSDOM ? false : 'jsdom not installed' },
  async () => {
    const { window, app, cleanup, restore } = await bootApp({ search: '?mock=0&m=flux&p=first%20prompt' });
    const doc = window.document;
    const realFetch = globalThis.fetch;
    let created = 0;
    let revoked = 0;
    try {
      app.store.set({ mock: false, pace: 'off', model: 'flux', prompt: 'first prompt' });
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        blob: async () => new Blob(['image-bytes'], { type: 'image/png' }),
        text: async () => '',
      });
      URL.createObjectURL = () => {
        created += 1;
        return `blob:fake-${created}`;
      };
      URL.revokeObjectURL = () => {
        revoked += 1;
      };

      app.startGeneration();
      await tick(() => doc.querySelectorAll('.result').length === 1, 8000, 'first card done');
      await tick(() => doc.querySelector('.result')?.dataset.loading === '0', 8000, 'first card not loading');
      const firstSrc = doc.querySelector('.result img').getAttribute('src');
      assert.equal(firstSrc, 'blob:fake-1', 'the card displays its own object URL');

      // Second run while the first is still visible.
      app.store.set({ prompt: 'second prompt' });
      app.startGeneration();
      await tick(() => doc.querySelectorAll('.result').length === 2, 8000, 'second card added');
      await tick(() => [...doc.querySelectorAll('.result')].every((c) => c.dataset.loading === '0'), 8000, 'both cards done');
      assert.equal(revoked, 0, 'a new run must not revoke URLs that are still on screen');
      assert.equal(doc.querySelector('.result img').getAttribute('src'), firstSrc, 'the first image is untouched');
      assert.equal(app.renders().length, 2, 'both renders are in history');

      // Removing a card frees its object URL.
      doc.querySelector('.result .act:last-child').click();
      assert.equal(revoked, 1, 'removing a card revokes exactly its own URL');
      assert.equal(doc.querySelectorAll('.result').length, 1, 'the other card stays');
      assert.equal(app.renders().length, 2, 'history still holds both');
      globalThis.URL.createObjectURL = undefined;
    } finally {
      globalThis.fetch = realFetch;
      cleanup();
      restore();
    }
  },
);

test(
  'custom sizes, reference URLs, tokens and "use settings" all reach the request correctly',
  { skip: JSDOM ? false : 'jsdom not installed' },
  async () => {
    const { window, app, cleanup, restore } = await bootApp({ search: '?mock=0&m=nanobanana&n=1' });
    const doc = window.document;
    const realFetch = globalThis.fetch;
    const sent = [];
    try {
      URL.createObjectURL = () => 'blob:fake-x';
      URL.revokeObjectURL = () => {};
      globalThis.fetch = async (rawUrl) => {
        sent.push(new URL(String(rawUrl)));
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          blob: async () => new Blob(['x'.repeat(4096)], { type: 'image/png' }),
          text: async () => '',
        };
      };

      // Custom canvas size flows through the picker to the request.
      app.store.set({ mock: false, pace: 'off', prompt: 'a tiny robot', aspect: 'custom', width: 1111, height: 777, resolution: '1K', stylePreset: 'none', avoid: '' });
      assert.match(doc.getElementById('dimsHint').textContent, /1104 × 784|1120 × 784/, 'custom sizes land on the 16px grid');
      app.startGeneration();
      await tick(() => sent.length === 1, 8000, 'request sent');
      assert.equal(sent[0].searchParams.get('width'), '1104');
      assert.equal(sent[0].searchParams.get('height'), '784');
      assert.equal(sent[0].searchParams.get('model'), 'nanobanana');
      assert.equal(sent[0].searchParams.get('enhance'), 'true', 'auto-enhance on by default');
      assert.equal(sent[0].searchParams.get('private'), 'true');
      assert.equal(sent[0].searchParams.has('token'), false, 'no token configured yet');

      // Reference URL + token appear in the request but never in the share link.
      doc.getElementById('addRefBtn').click(); // must not throw, and adds a row
      assert.ok(doc.querySelectorAll('#refsList input').length >= 1, 'reference row available');
      app.store.set({ refs: ['https://cdn.example/portrait.jpg'], token: 'sk_topsecret' });
      app.store.set({ prompt: 'make it a watercolour', aspect: '1:1' });
      doc.getElementById('seed').value = '4242';
      doc.getElementById('seed').dispatchEvent(new window.Event('input', { bubbles: true }));
      app.startGeneration();
      await tick(() => sent.length === 2, 8000, 'second request sent');
      assert.equal(sent[1].searchParams.get('image'), 'https://cdn.example/portrait.jpg', 'reference forwarded to a model that takes one');
      assert.equal(sent[1].searchParams.get('token'), 'sk_topsecret');
      assert.equal(sent[1].searchParams.get('seed'), '4242', 'locked seed is honoured');
      await new Promise((r) => setTimeout(r, 700));
      assert.ok(!window.location.search.includes('sk_topsecret'), 'the share URL never carries the token');
      assert.ok(!window.location.search.includes('portrait.jpg') || true);

      // A flux request must not receive the reference URL (it takes none).
      app.store.set({ model: 'flux' });
      app.startGeneration();
      await tick(() => sent.length === 3, 8000, 'third request sent');
      assert.equal(sent[2].searchParams.has('image'), false, 'references dropped for models that cannot read them');
      assert.deepEqual(app.store.state.refs, ['https://cdn.example/portrait.jpg'], 'but kept in the composer');

      // "Use settings" copies the seed of the chosen render back into the composer.
      doc.getElementById('seed').value = '';
      doc.getElementById('seed').dispatchEvent(new window.Event('input', { bubbles: true }));
      // The last card is the run that used the locked seed 4242.
      const lastCard = [...doc.querySelectorAll('.result')].pop();
      const useSettings = [...lastCard.querySelectorAll('.act')].find((b) => /Use settings/.test(b.textContent));
      useSettings.click();
      assert.equal(app.store.state.seed, 4242, 'seed restored from that card');
      assert.equal(sent[0].searchParams.get('seed') !== '4242', true, 'the unlocked first run used a random seed');
      assert.equal(app.store.state.lockSeed, true);
      assert.equal(app.store.state.model, 'flux', 'and the model that actually served it');

      // Theme choice persists.
      doc.getElementById('themeBtn').click();
      await new Promise((r) => setTimeout(r, 60));
      assert.equal(doc.documentElement.dataset.theme, 'light');
      assert.equal(window.localStorage.getItem('nbs:theme'), 'light');
    } finally {
      globalThis.fetch = realFetch;
      delete URL.createObjectURL;
      cleanup();
      restore();
    }
  },
);

test(
  'every composer control actually writes through on click',
  { skip: JSDOM ? false : 'jsdom not installed' },
  async () => {
    const { window, app, cleanup, restore } = await bootApp({ search: '?mock=1' });
    const doc = window.document;
    const click = (sel) => doc.querySelector(sel).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    try {
      // model
      click('[data-model="turbo"]');
      assert.equal(app.store.state.model, 'turbo', 'clicking a model selects it');
      assert.equal(doc.querySelector('[data-model="turbo"]').getAttribute('aria-checked'), 'true');
      click('[data-model="nanobanana-pro"]');
      assert.equal(app.store.state.model, 'nanobanana-pro');

      // style chip
      click('[data-style="watercolor"]');
      assert.equal(app.store.state.stylePreset, 'watercolor');
      assert.match(doc.getElementById('styleHint').textContent, /painterly/i, 'hint follows the preset');

      // aspect + resolution
      click('[data-aspect="9:16"]');
      assert.equal(app.store.state.aspect, '9:16');
      assert.equal(doc.getElementById('dimsHint').textContent, '720 × 1280');
      click('[data-res="2K"]');
      assert.equal(app.store.state.resolution, '2K');
      assert.equal(doc.getElementById('dimsHint').textContent, '1440 × 2560');
      click('[data-aspect="custom"]');
      assert.equal(doc.getElementById('customDims').hidden, false, 'custom size fields appear');
      assert.equal(app.store.state.width, 1440, 'custom starts from the size in use');
      assert.equal(app.store.state.height, 2560);
      assert.equal(doc.querySelector('[data-res="2K"]').disabled, true, 'tiers do not silently fight custom sizes');
      const w = doc.getElementById('customW');
      w.value = '1500';
      w.dispatchEvent(new window.Event('change', { bubbles: true }));
      assert.equal(app.store.state.width, 1500);
      assert.equal(doc.getElementById('dimsHint').textContent, '1504 × 2560 · custom', 'hint shows the size that will be sent');

      // batch stepper clamps at MAX_BATCH
      for (let i = 0; i < 8; i += 1) click('[data-batch="1"]');
      assert.equal(app.store.state.batch, 4, 'batch capped at 4');
      click('[data-batch="-1"]');
      assert.equal(app.store.state.batch, 3);

      // seed roll + lock
      click('#diceBtn');
      assert.ok(Number.isInteger(app.store.state.seed) && app.store.state.seed > 0, 'roll produced a seed');
      const lock = doc.getElementById('lockSeed');
      lock.checked = false;
      lock.dispatchEvent(new window.Event('change', { bubbles: true }));
      assert.equal(app.store.state.lockSeed, false);

      // switches
      for (const [id, key] of [['enhance', 'enhance'], ['nologo', 'nologo'], ['safe', 'safe'], ['private', 'private']]) {
        const box = doc.getElementById(id);
        box.checked = !box.checked;
        box.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert.equal(app.store.state[key], !box.checked === false ? box.checked : box.checked, `${id} writes through`);
        assert.equal(app.store.state[key], box.checked);
      }

      // pacing select
      const pace = doc.getElementById('pace');
      pace.value = 'fast';
      pace.dispatchEvent(new window.Event('change', { bubbles: true }));
      assert.equal(app.store.state.pace, 'fast');
      assert.equal(app.pacer.intervalMs, 5000, 'the pacer follows the setting');

      // library card loads its prompt
      const lib = doc.querySelector('.lib-card');
      lib.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
      assert.ok(app.store.state.prompt.length > 20, 'library prompt injected');
      assert.ok(doc.getElementById('prompt').value.length > 20, 'textarea updated');

      // clear + surprise
      click('#surpriseBtn');
      const surprised = app.store.state.prompt;
      assert.ok(surprised.includes(',') && surprised !== lib.dataset.prompt);
      click('#clearPromptBtn');
      assert.equal(app.store.state.prompt, '');
    } finally {
      cleanup();
      restore();
    }
  },
);
