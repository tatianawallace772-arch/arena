/**
 * main.js — UI wiring for Nano Banana Studio.
 *
 * Order: helpers → builders → result cards → run pipeline → events → boot.
 * The stage is deliberately NOT re-rendered from state (that would flicker
 * while images stream in); cards are created imperatively and keyed by job id.
 */

import {
  PROVIDER,
  MODEL_CATALOG,
  MODEL_IDS,
  FALLBACK_CHAIN,
  ASPECT_RATIOS,
  PACE_OPTIONS,
  MAX_BATCH,
  SEED_MAX,
  composePrompt,
  randomSeed,
  resolveDims,
  sanitizeState,
  seedFor,
  modelById,
  modelLabel,
  normalizeRefs,
  limitRefs,
  MAX_REFS,
  isSizeCapped,
} from './config.js';
import { STYLE_PRESETS, PROMPT_LIBRARY, randomPrompt, analysePrompt, stylePresetById } from './prompts.js';
import { createStore } from './state.js';
import {
  addHistoryItem,
  clearHistory,
  loadHistory,
  loadState,
  loadTheme,
  queryToState,
  removeHistoryItem,
  saveState,
  saveTheme,
  stateToQuery,
} from './storage.js';
import { Pacer, JobQueue } from './queue.js';
import { ProviderError, generateOne, mockSvg, requestParamsFor, fetchAvailableModels } from './pollinations.js';

/* ------------------------------------------------------------------ helpers */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style') node.setAttribute('style', v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  for (const kid of kids.flat(9)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid?.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

const fmtBytes = (n) => (n ? `${(n / 1024).toFixed(n > 1024 * 1024 ? 0 : 1)} KB` : '');
const fmtMs = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`);
const clockOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const slug = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ICONS = {
  download:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 18h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  dice:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/></svg>',
  expand:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M10 4H4v6M14 20h6v-6M4 14v6h6M20 10V4h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  retry:
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 4.5V9h-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

/* ------------------------------------------------------------------ toasts */

const toastsEl = $('#toasts');

function toast(message, { tone = 'info', action = null, ms = 4200 } = {}) {
  const node = el('div', { class: 'toast', dataset: { tone } }, el('span', { class: 'toast__i' }), el('span', {}, message));
  const dismiss = () => {
    node.style.transition = 'opacity .2s, transform .2s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 220);
  };
  if (action) {
    node.append(
      el('button', {
        type: 'button',
        text: action.label,
        onclick: () => {
          action.run();
          dismiss();
        },
      }),
    );
  }
  toastsEl.append(node);
  const timer = setTimeout(dismiss, ms);
  node.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });
  // Keep the stack short.
  while (toastsEl.children.length > 4) toastsEl.firstElementChild.remove();
}

/* ------------------------------------------------------------------- store */

const persisted = loadState();
const urlState = location.search.length > 1 ? queryToState(location.search, persisted || {}) : null;
const initial = sanitizeState({ ...(persisted || {}), ...(urlState || {}) });

let persistTimer = null;
let urlTimer = null;

const store = createStore(initial, {
  onChange: (state) => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => saveState(state), 250);
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => syncUrl(state), 500);
  },
});

/** `history` is our render list; the browser API is reached via globalThis. */
let renders = loadHistory();

function syncUrl(state) {
  try {
    const hist = globalThis.history || globalThis.window?.history;
    if (!hist?.replaceState) return; // file:// and non-browser hosts have none
    const path = (globalThis.location || window.location).pathname;
    const search = (globalThis.location || window.location).search;
    const next = `${path}${stateToQuery(state)}`;
    if (`${path}${search}` !== next) hist.replaceState(null, '', next);
  } catch {
    /* a browser that dislikes replaceState is not worth crashing over */
  }
}

/* ------------------------------------------------------------ pacing + queue */

function intervalFor(paceId) {
  if (paceId === 'off') return 0;
  return PACE_OPTIONS.find((p) => p.id === paceId)?.intervalMs ?? PACE_OPTIONS[0].intervalMs;
}

const pacer = new Pacer(store.state.mock ? 0 : intervalFor(store.state.pace));
let currentRun = { total: 0, done: 0, failed: 0, summary: '', lastError: null };
const unavailableModels = new Set();
let liveModels = null;

/* -------------------------------------------------------------- stage chrome */

const statusEl = $('#statusText');
const statusLabelEl = $('#statusLabel');
const tierDotEl = $('#tierDot');
const tierTextEl = $('#tierText');
const noteEl = $('#actionsNote');
const generateBtn = $('#generateBtn');
const stopBtn = $('#stopBtn');
const modelsChipEl = $('#modelsChip');
const modelsTextEl = $('#modelsText');
const modelStatusEl = $('#modelStatus');

function setStatus(kind, text) {
  statusEl.dataset.state = kind;
  statusLabelEl.textContent = text;
}
function setBusy(busy) {
  generateBtn.disabled = busy;
  $('.btn__label', generateBtn).textContent = busy ? 'In queue…' : 'Generate';
  stopBtn.hidden = !busy;
}
function setNote(text = '', tone = 'info') {
  noteEl.dataset.tone = tone;
  noteEl.textContent = text;
}

/* ------------------------------------------------------------- error copy */

const ERROR_COPY = {
  RATE_LIMITED: ['Rate limited — cooling down, then retrying', 'The keyless tier allows roughly one request every 15 seconds, so the queue waits it out. Leave the page open.'],
  NEEDS_KEY: ['That model is key-gated right now', 'The provider asks registered users for a token on this model. Picking a keyless model (Flux / Turbo) is usually all it takes.'],
  NEEDS_CREDITS: ['Model needs provider credits', 'This model is metered upstream. Choose a free model or paste your own token under Advanced.'],
  BAD_REQUEST: ['Provider rejected the request', 'Usually an unsupported model name, or a size above what the model renders. Try another model or drop a resolution tier.'],
  TIMEOUT: ['Timed out waiting for a render', 'The provider took too long (busy upstream). Retry, drop a resolution tier, or use Turbo.'],
  UPSTREAM: ['Provider is erroring upstream', 'Their servers answered 5xx — not your prompt. A retry a few seconds later usually lands.'],
  BAD_PAYLOAD: ['Provider returned no image', 'The response was not an image: often a content-filter trip or an upstream hiccup.'],
  OFFLINE: ['Could not reach the provider', 'The request never completed. Check connectivity, or turn on the offline mock renderer to exercise the whole flow.'],
  NO_PROMPT: ['Nothing to render', 'Write a prompt first.'],
  ABORTED: ['Cancelled', 'You stopped the run.'],
  UNKNOWN: ['Generation failed', 'Unexpected response from the provider.'],
};

function errorInfo(err) {
  const code = err?.code && ERROR_COPY[err.code] ? err.code : 'UNKNOWN';
  const [short, long] = ERROR_COPY[code];
  return { code, short, long, raw: String(err?.message || '').slice(0, 200), status: err?.status || 0 };
}

function friendlyError(err) {
  if (err instanceof ProviderError) return err;
  if (/abort/i.test(String(err?.name || ''))) return new ProviderError('Cancelled', { code: 'ABORTED' });
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String(err?.message || ''))) {
    return new ProviderError(err?.message || 'fetch failed', { code: 'OFFLINE' });
  }
  return new ProviderError(String(err?.message || err || 'Unknown error'), { code: 'UNKNOWN' });
}

/* --------------------------------------------------------------- UI builders */

const styleChipsEl = $('#styleChips');
for (const preset of STYLE_PRESETS) {
  styleChipsEl.append(
    el('button', {
      class: 'chip',
      type: 'button',
      role: 'radio',
      'aria-checked': 'false',
      dataset: { style: preset.id },
      title: preset.hint,
      text: preset.label,
      onclick: () => store.set({ stylePreset: preset.id }),
    }),
  );
}

const ratioGridEl = $('#ratioGrid');
for (const ratio of ASPECT_RATIOS) {
  const isCustom = ratio.id === 'custom';
  const box = el('i');
  const k = 20 / Math.max(ratio.w, ratio.h);
  box.style.width = `${Math.max(8, Math.round((isCustom ? 1024 : ratio.w) * k))}px`;
  box.style.height = `${Math.max(8, Math.round((isCustom ? 768 : ratio.h) * k))}px`;
  ratioGridEl.append(
    el(
      'button',
      {
        class: 'ratio',
        type: 'button',
        role: 'radio',
        'aria-checked': 'false',
        dataset: { aspect: ratio.id },
        title: isCustom ? 'Custom width × height' : `${ratio.label} · ${ratio.id}`,
      },
      box,
      el('b', { text: isCustom ? 'free' : ratio.id }),
    ),
  );
}
ratioGridEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-aspect]');
  if (!btn) return;
  const aspect = btn.dataset.aspect;
  if (aspect === 'custom') {
    // Seed the custom fields from the size currently in use so switching modes
    // does not silently change the canvas.
    const dims = resolveDims({ aspect: store.state.aspect, resolution: store.state.resolution, model: store.state.model, customWidth: store.state.width, customHeight: store.state.height });
    store.set({ aspect: 'custom', width: dims.width, height: dims.height });
  } else {
    store.set({ aspect });
  }
});

const resSegEl = $('#resSeg');
resSegEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-res]');
  if (btn) store.set({ resolution: btn.dataset.res });
});

const modelListEl = $('#modelList');
for (const model of MODEL_CATALOG) {
  modelListEl.append(
    el(
      'button',
      {
        class: 'model',
        type: 'button',
        role: 'radio',
        'aria-checked': 'false',
        dataset: { model: model.id },
        title: model.blurb,
      },
      el('span', { class: 'model__radio' }),
      el('span', { class: 'model__name' }, el('b', { text: model.label }), el('small', { text: `${model.subtitle} · ≤${model.maxSide}px` })),
      el('span', { class: 'model__flag', text: model.premium ? 'tier?' : 'free' }),
    ),
  );
}
modelListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-model]');
  if (!btn) return;
  store.set({ model: btn.dataset.model, refs: normalizeRefs(store.state.refs) });
  renderRefs();
});

const paceEl = $('#pace');
for (const p of PACE_OPTIONS) paceEl.append(el('option', { value: p.id, text: p.label }));
paceEl.addEventListener('change', () => {
  store.set({ pace: paceEl.value });
  pacer.setInterval(intervalFor(paceEl.value));
  syncControls(store.state);
  $('#paceNote').textContent = PACE_OPTIONS.find((p) => p.id === paceEl.value)?.note || '';
});

const libraryGridEl = $('#libraryGrid');
const LIBRARY_STYLE = {
  photo: 'photo',
  cinematic: 'cinematic',
  design: 'logo',
  '3d': 'render3d',
  product: 'studio',
  painterly: 'watercolor',
  concept: 'render3d',
  macro: 'macro',
  illustration: 'anime',
  architectural: 'photo',
  fashion: 'photo',
};
for (const item of PROMPT_LIBRARY) {
  libraryGridEl.append(
    el(
      'button',
      { class: 'lib-card', type: 'button', dataset: { prompt: item.text, style: item.tag, title: item.title }, title: 'Load this prompt' },
      el('em', { text: item.tag }),
      el('b', { text: item.title }),
      el('p', { text: item.text.split(',').join(', ') }),
    ),
  );
}
$('#libCount').textContent = String(PROMPT_LIBRARY.length);
libraryGridEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.lib-card');
  if (!btn) return;
  store.set({ prompt: btn.dataset.prompt.split(',').join(', '), stylePreset: LIBRARY_STYLE[btn.dataset.style] || 'none' });
  promptEl.focus();
  toast(`Loaded “${btn.dataset.title}” — tweak it, then Generate.`, { tone: 'ok', ms: 2600 });
});
$('#libraryToggle').addEventListener('click', (e) => {
  const collapsed = $('#library').dataset.collapsed === '1';
  $('#library').dataset.collapsed = collapsed ? '0' : '1';
  e.currentTarget.textContent = collapsed ? 'Collapse' : 'Expand';
});

/* reference images */
const refsListEl = $('#refsList');
function renderRefs() {
  refsListEl.replaceChildren();
  const refs = store.state.refs || [];
  const limit = modelById(store.state.model)?.references || 0;
  if (!limit) {
    refsListEl.append(
      el('p', { class: 'note', text: 'This model takes no reference images — yours are kept for when you switch. Choose Nano Banana, Nano Banana Pro or Kontext Edit to steer an edit with a source picture.' }),
    );
    return;
  }
  if (refs.length > limit) {
    refsListEl.append(el('p', { class: 'note', text: `${modelById(store.state.model).label} reads the first ${limit} of your ${refs.length} references; the rest are kept in the composer.` }));
  }
  const rows = Math.max(refs.length, 1);
  for (let i = 0; i < rows; i += 1) {
    const input = el('input', {
      type: 'url',
      value: refs[i] || '',
      placeholder: i === 0 ? `https://…/photo.jpg (up to ${limit})` : 'https://…',
      'aria-label': `Reference image URL ${i + 1}`,
    });
    input.addEventListener('change', () => {
      const next = [...(store.state.refs || [])];
      next[i] = input.value.trim();
      store.set({ refs: normalizeRefs(next) });
      renderRefs();
    });
    const row = el('div', { class: 'ref-row' }, input);
    if (refs[i]) {
      row.append(
        el('button', {
          class: 'act',
          type: 'button',
          text: '✕',
          title: 'Remove this reference',
          onclick: () => {
            const next = (store.state.refs || []).filter((_, idx) => idx !== i);
            store.set({ refs: normalizeRefs(next) });
            renderRefs();
          },
        }),
      );
    }
    refsListEl.append(row);
  }
}
$('#addRefBtn').addEventListener('click', () => {
  // Rows follow the global cap; the model's own cap is explained above the list.
  const next = [...(store.state.refs || []), ''].slice(0, MAX_REFS);
  store.set({ refs: normalizeRefs(next) });
  renderRefs();
});

/* -------------------------------------------------------------- result cards */

const resultsEl = $('#results');
const emptyEl = $('#emptyState');
const MAX_VISIBLE = 12; // older cards stay in the history strip, just not on stage
const cards = new Map(); // jobId → card handles
const blobs = new Map(); // jobId → Blob (keeps a download possible after revocation)

/**
 * Object URLs are owned by the card that displays them: revoking them on the
 * next run would blank the previous results, so they are freed when a card is
 * removed (or when the stage overflows).
 */
function trackUrl(url, card) {
  if (card) {
    card.urls = card.urls || [];
    card.urls.push(url);
  }
  return url;
}

function revokeCard(card) {
  for (const u of card?.urls || []) {
    try {
      if (u.startsWith('blob:') && typeof URL?.revokeObjectURL === 'function') URL.revokeObjectURL(u);
    } catch {
      /* already revoked */
    }
  }
  card?.urls?.length && card.urls.splice(0);
}

function pruneStage() {
  while (cards.size > MAX_VISIBLE) {
    const oldestId = [...cards.keys()].find((id) => cards.get(id).node.dataset.loading !== '1');
    if (!oldestId) break;
    removeCard(oldestId);
  }
  while (blobs.size > MAX_VISIBLE) blobs.delete(blobs.keys().next().value);
}

function makeCard(job) {
  const img = el('img', { alt: '', decoding: 'async', hidden: true });
  img.style.aspectRatio = `${job.width} / ${job.height}`;
  const badges = el('div', { class: 'result__badge' }, el('span', { class: 'badge', text: `seed ${job.seed}` }));
  const frame = el('div', { class: 'result__frame' }, img, badges);
  const meta = el('div', { class: 'result__meta' });
  const node = el('article', { class: 'result', dataset: { job: job.id, loading: '1' } }, frame, meta);
  renderCardMeta(meta, job, { pending: true });
  return { node, img, frame, badges, meta, job };
}

function renderCardMeta(meta, job, { pending = false, ms = 0, note = '', error = null, bytes = 0, transport = '' } = {}) {
  meta.replaceChildren();

  if (error) {
    meta.append(
      el(
        'div',
        { class: 'result__error' },
        el('h3', { text: errorInfo(error).short }),
        el('p', { text: errorInfo(error).long }),
        el('code', { text: `${errorInfo(error).code}${error.status ? ` · HTTP ${error.status}` : ''}${errorInfo(error).raw ? ` · ${errorInfo(error).raw}` : ''}` }),
        el(
          'div',
          { class: 'acts' },
          el('button', { class: 'act', type: 'button', dataset: { variant: 'primary' }, html: `${ICONS.retry} Retry`, onclick: () => runJobs([job]) }),
          job.model !== 'flux'
            ? el('button', {
                class: 'act',
                type: 'button',
                html: `${ICONS.retry} Force Flux`,
                title: 'Skip the fallback chain and use the always-free model',
                onclick: () => runJobs([{ ...job, model: 'flux', servedModel: 'flux' }]),
              })
            : null,
          el('button', { class: 'act', type: 'button', text: 'Copy prompt', onclick: () => copyText(job.finalPrompt, 'Prompt copied') }),
          el('button', { class: 'act', type: 'button', dataset: { variant: 'danger' }, text: 'Remove', onclick: () => removeCard(job.id) }),
        ),
      ),
    );
    return;
  }

  const served = job.servedModel && job.servedModel !== job.model;
  const specs = [served ? `${modelLabel(job.model)} → ${modelLabel(job.servedModel)}` : modelLabel(job.model), `${job.width}×${job.height}`, `seed ${job.seed}`];
  if (ms) specs.push(fmtMs(ms));
  if (bytes) specs.push(fmtBytes(bytes));
  if (transport === 'mock') specs.push('local mock');
  if (transport === 'img') specs.push('display-only (no CORS)');

  meta.append(
    el('p', { class: 'result__prompt', title: job.finalPrompt }, el('b', { text: '“' }), document.createTextNode(job.finalPrompt), document.createTextNode('”')),
    el(
      'div',
      { class: 'result__row' },
      el('div', { class: 'spec' }, ...specs.map((s) => el('span', { text: s }))),
      el(
        'div',
        { class: 'acts' },
        el('button', { class: 'act', type: 'button', disabled: pending, dataset: { variant: 'primary' }, html: `${ICONS.download} Download`, onclick: () => downloadJob(job) }),
        el('button', { class: 'act', type: 'button', disabled: pending, html: `${ICONS.dice} Variations ×3`, onclick: () => variationsFor(job) }),
        el('button', {
          class: 'act',
          type: 'button',
          html: `${ICONS.lock} Use settings`,
          disabled: pending,
          title: 'Copy these settings into the composer',
          onclick: () => {
            store.set({
              prompt: job.userPrompt || stripStyle(job.finalPrompt),
              seed: job.seed,
              lockSeed: true,
              model: job.servedModel || job.model,
              resolution: job.resolution,
              aspect: job.aspect,
              enhance: job.enhance,
              stylePreset: job.stylePreset,
              avoid: job.avoid,
            });
            renderRefs();
            toast('Seed and settings copied into the composer.', { tone: 'ok', ms: 2600 });
          },
        }),
        el('button', { class: 'act', type: 'button', disabled: pending, html: `${ICONS.link} Link`, title: 'Copy the direct provider URL', onclick: () => copyText(job.url || job.src, 'Image URL copied') }),
        el('button', { class: 'act', type: 'button', disabled: pending, html: ICONS.expand, title: 'Open full size in a new tab', onclick: () => openFullSize(job) }),
        el('button', { class: 'act', type: 'button', dataset: { variant: 'danger' }, text: 'Remove', onclick: () => removeCard(job.id) }),
      ),
    ),
  );
  if (note) meta.append(el('p', { class: 'mock-state', text: note }));
  if (pending) meta.append(el('p', { class: 'mock-state', text: note || 'Queued — waiting for a free slot…' }));
}

function removeCard(id) {
  const card = cards.get(id);
  if (!card) return;
  revokeCard(card);
  blobs.delete(id);
  card.node.remove();
  cards.delete(id);
  updateStageChrome();
}

function updateStageChrome() {
  resultsEl.dataset.count = String(cards.size);
  emptyEl.hidden = cards.size > 0;
}

function ensureCard(job) {
  let card = cards.get(job.id);
  if (!card) {
    card = makeCard(job);
    cards.set(job.id, card);
    resultsEl.append(card.node);
    updateStageChrome();
    pruneStage();
  }
  return card;
}

function markCardPending(job) {
  const card = cards.get(job.id);
  if (!card) return;
  card.node.dataset.loading = '1';
  card.img.hidden = true;
  renderCardMeta(card.meta, card.job, { pending: true, note: pendingNote() });
}

function pendingNote() {
  const { waitMs } = pacer.snapshot();
  return waitMs > 0 ? `Provider cooldown: ${(waitMs / 1000).toFixed(0)}s` : 'Request in flight…';
}

function finishCard(job, result, ms) {
  const card = cards.get(job.id) || ensureCard(job);
  card.job = { ...card.job, ...job };
  card.node.dataset.loading = '0';
  card.img.style.aspectRatio = `${job.width} / ${job.height}`;
  card.img.hidden = false;
  card.img.src = result.src;
  card.img.alt = job.finalPrompt.slice(0, 140);
  card.mocked = result.transport === 'mock';
  if (result.blob) {
    blobs.set(job.id, result.blob);
    // The displayed src is already an object URL owned by this card.
    if (result.src?.startsWith('blob:')) (card.urls ||= []).push(result.src);
  }
  card.badges.replaceChildren(
    el('span', {
      class: 'badge',
      text: job.servedModel && job.servedModel !== job.model ? modelLabel(job.servedModel) : modelLabel(job.model),
    }),
    result.transport === 'mock' ? el('span', { class: 'badge badge--warn', text: 'mock' }) : null,
    result.bytes ? el('span', { class: 'badge', text: fmtBytes(result.bytes) }) : null,
    el('span', { class: 'badge', text: `seed ${job.seed}` }),
  );
  renderCardMeta(card.meta, job, { ms, bytes: result.bytes, transport: result.transport });
  card.node.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
}

function failCard(job, error) {
  const err = friendlyError(error);
  const card = ensureCard(job);
  card.node.dataset.loading = '0';
  card.img.hidden = true;
  card.badges.replaceChildren(el('span', { class: 'badge badge--warn', text: 'failed' }));
  renderCardMeta(card.meta, { ...card.job, ...job }, { error: err });
  if (err.code === 'RATE_LIMITED') {
    pacer.backoff(err.retryAfterMs || intervalFor(store.state.pace));
    toast('Rate limited — the queue is spacing requests out.', { tone: 'warn', ms: 3600 });
  }
}

/* ------------------------------------------------------------- the run flow */

function buildJobs({ count, baseSeed, model, resolution, snapshot }) {
  const state = snapshot || store.state;
  const jobs = [];
  for (let i = 0; i < count; i += 1) {
    const seed = Number.isInteger(baseSeed) ? seedFor(baseSeed, i) : randomSeed();
    const chosenModel = model || state.model;
    const params = requestParamsFor({ ...state, resolution: resolution || state.resolution }, STYLE_PRESETS, { seed, model: chosenModel });
    jobs.push({
      id: `j${Date.now().toString(36)}${i}${Math.floor(Math.random() * 46656).toString(36)}`,
      label: `Rendering ${count > 1 ? `${i + 1}/${count}` : 'image'} · ${modelLabel(chosenModel)}`,
      finalPrompt: params.finalPrompt,
      userPrompt: state.prompt,
      model: chosenModel,
      seed,
      width: params.width,
      height: params.height,
      resolution: resolution || state.resolution,
      aspect: state.aspect,
      enhance: state.enhance,
      nologo: state.nologo,
      safe: state.safe,
      private: state.private,
      refs: state.refs || [],
      stylePreset: state.stylePreset,
      avoid: state.avoid,
      params,
    });
  }
  return jobs;
}

/**
 * Each job tries the selected model, then walks the fallback chain, so a
 * flagship model that is gated behind a key degrades into a working keyless
 * one instead of an error screen.
 */
function runJobs(jobs) {
  if (!jobs.length) return;
  const mock = Boolean(store.state.mock);
  pacer.setInterval(mock ? 0 : intervalFor(store.state.pace));
  setBusy(true);
  ensureCooldownTicker();
  currentRun = { total: jobs.length, done: 0, failed: 0, summary: '', lastError: null };

  for (const job of jobs) {
    ensureCard(job);
    markCardPending(job);
    Object.assign(job, {
      run: async (signal) => {
        const chain = candidateChain(job.model);
        let lastErr;
        for (const model of chain) {
          const params = { ...job.params, model, ...resolveDimsFor(job, model) };
          try {
            const result = await generateOne(params, {
              signal,
              mock,
              attempts: mock ? 1 : 2,
              onAttempt: ({ attempt }) => {
                if (attempt > 1) setStatus('busy', `Retrying attempt ${attempt} · ${modelLabel(model)}`);
              },
            });
            job.servedModel = model;
            job.url = result.url;
            return result;
          } catch (err) {
            lastErr = friendlyError(err);
            if (lastErr.code === 'ABORTED') throw lastErr;
            const transient = ['RATE_LIMITED', 'TIMEOUT', 'UPSTREAM', 'OFFLINE'].includes(lastErr.code);
            if (!transient) {
              unavailableModels.add(model);
              markModelAvailability();
              const next = chain[chain.indexOf(model) + 1];
              if (next) toast(`${modelLabel(model)} refused anonymous requests — switching to ${modelLabel(next)}.`, { tone: 'warn', ms: 4600 });
              continue;
            }
            if (lastErr.retryAfterMs) pacer.backoff(lastErr.retryAfterMs);
            break; // transient: let the pacer/queue retry rather than burning the chain
          }
        }
        throw lastErr || new ProviderError('All fallback models failed', { code: 'UPSTREAM' });
      },
      onDone: (result) => {
        currentRun.done += 1;
        currentRun.summary = `Rendered ${currentRun.done}/${currentRun.total}`;
        setStatus('ok', currentRun.summary);
        pushHistory({ ...job, url: result.url, transport: result.transport, bytes: result.bytes, mock, servedModel: job.servedModel });
      },
      onError: (err) => {
        currentRun.done += 1;
        currentRun.failed += 1;
        currentRun.lastError = errorInfo(friendlyError(err));
        currentRun.summary = currentRun.lastError.short;
      },
    });
    queue.enqueue(job);
  }
}

function resolveDimsFor(job, model) {
  return resolveDims({
    aspect: job.aspect,
    resolution: job.resolution,
    model,
    customWidth: store.state.width,
    customHeight: store.state.height,
  });
}

function candidateChain(preferred) {
  const ordered = [preferred, ...FALLBACK_CHAIN.filter((m) => m !== preferred), ...MODEL_IDS.filter((m) => m !== preferred)];
  const seen = new Set();
  const chain = ordered.filter((m) => MODEL_IDS.includes(m) && !seen.has(m) && seen.add(m));
  const open = chain.filter((m) => !unavailableModels.has(m));
  const closed = chain.filter((m) => unavailableModels.has(m));
  // Known-bad models only get one extra chance at the very end.
  return [...open, ...closed.slice(0, 1)];
}

const queue = new JobQueue({
  pacer,
  onEvent: (evt) => {
    switch (evt.type) {
      case 'queued':
        setStatus('busy', `Queued · ${evt.size} render${evt.size > 1 ? 's' : ''}`);
        break;
      case 'start':
        setStatus('busy', evt.job.label || 'Rendering…');
        markCardPending(evt.job);
        break;
      case 'done':
        finishCard(evt.job, evt.result, evt.ms);
        setNote(evt.ms > 20000 ? 'Slow render — the free tier is saturated right now.' : '', 'warn');
        break;
      case 'error':
        failCard(evt.job, evt.error);
        setStatus('err', errorInfo(evt.error).short);
        setNote(errorInfo(evt.error).long, 'err');
        break;
      case 'cancelled':
      case 'cancelled-job':
        for (const [id, card] of [...cards]) {
          if (card.node.dataset.loading === '1' && card.img.hidden) {
            card.node.remove();
            cards.delete(id);
          }
        }
        updateStageChrome();
        setStatus('idle', 'Stopped');
        break;
      case 'idle':
        if (!queue.isBusy) {
          setBusy(false);
          if (currentRun.total) {
            const okCount = currentRun.done - currentRun.failed;
            if (currentRun.failed) {
              const why = currentRun.lastError?.short || 'Generation failed';
              setStatus('err', okCount ? `${okCount}/${currentRun.total} rendered · ${why.toLowerCase()}` : why);
            } else {
              setStatus('ok', currentRun.summary || 'Idle');
            }
          }
        }
        break;
      default:
        break;
    }
  },
});

function pushHistory(job) {
  renders = addHistoryItem({
    id: job.id,
    ts: Date.now(),
    prompt: job.finalPrompt,
    userPrompt: job.userPrompt ?? store.state.prompt,
    model: job.servedModel || job.model,
    requestedModel: job.model,
    seed: job.seed,
    width: job.width,
    height: job.height,
    aspect: job.aspect,
    resolution: job.resolution,
    stylePreset: job.stylePreset,
    avoid: job.avoid,
    enhance: job.enhance,
    refs: job.refs || [],
    url: job.url || '',
    mock: Boolean(job.mock),
    bytes: job.bytes || 0,
  });
  renderFilmstrip();
}

function stripStyle(text) {
  const idx = String(text).indexOf('. Avoid:');
  return (idx > 0 ? String(text).slice(0, idx) : String(text)).slice(0, 4000);
}

function variationsFor(job) {
  const snapshot = {
    ...store.state,
    prompt: stripStyle(job.finalPrompt),
    stylePreset: 'none',
    avoid: '',
    aspect: job.aspect,
    resolution: job.resolution,
    enhance: false,
  };
  runJobs(buildJobs({ count: 3, baseSeed: randomSeed(), model: job.servedModel || job.model, resolution: job.resolution, snapshot }));
}

/* ------------------------------------------------------------- downloads */

async function downloadJob(job) {
  const base = `nano-banana_${slug(job.finalPrompt).slice(0, 44) || 'untitled'}_seed-${job.seed}_${job.width}x${job.height}`;
  const card = cards.get(job.id);
  const blob = blobs.get(job.id);
  if (blob) return triggerDownload(safeObjectURL(blob, card), `${base}.png`);

  // A mock render is drawn in-page: save those bytes, and never go to the
  // network for it (its provider URL would start a real render).
  const localSrc = card?.mocked ? card.img?.getAttribute('src') || '' : '';
  if (localSrc.startsWith('data:')) return triggerDownload(localSrc, `${base}.svg`);

  const src = job.url || card?.img?.src || '';
  if (src.startsWith('data:')) return triggerDownload(src, `${base}.svg`);
  if (!src) {
    toast('Nothing cached for this render yet.', { tone: 'info', ms: 2200 });
    return;
  }
  try {
    const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    return triggerDownload(safeObjectURL(await res.blob(), card), `${base}.png`);
  } catch {
    const win = openTab(src);
    toast(
      win
        ? 'The provider blocks cross-origin reads, so it opened full size in a new tab — save from there.'
        : 'Could not read the bytes (CORS) and pop-ups are blocked. Use Link to copy the URL instead.',
      { tone: 'warn', ms: 6500 },
    );
  }
}

/** URL.createObjectURL is missing or fussy outside modern browsers. */
function safeObjectURL(blob, card) {
  try {
    if (typeof URL?.createObjectURL === 'function') return trackUrl(URL.createObjectURL(blob), card);
  } catch {
    /* fall back to whatever reference the blob already has */
  }
  return blob?.objectURL || '';
}

function openTab(url) {
  if (!url) return null;
  try {
    const scope = globalThis.window || globalThis;
    return scope.open?.call(scope, url, '_blank', 'noopener') || null;
  } catch {
    return null;
  }
}

function triggerDownload(url, name) {
  const a = el('a', { href: url, download: name, style: 'display:none' });
  document.body.append(a);
  a.click();
  setTimeout(() => a.remove(), 1200);
}

function openFullSize(job) {
  const card = cards.get(job.id);
  const url = (card?.mocked ? card.img?.getAttribute('src') : '') || job.url || card?.img?.src;
  if (!url) return;
  const win = openTab(url);
  if (!win) toast('Pop-ups are blocked — use Link to copy the URL instead.', { tone: 'warn', ms: 3400 });
}

async function copyText(text, okMsg = 'Copied') {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(String(text));
    else throw new Error('no clipboard api');
    toast(okMsg, { tone: 'ok', ms: 2200 });
  } catch {
    const ta = el('textarea', { style: 'position:fixed;top:0;left:0;opacity:0' });
    ta.value = String(text);
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand?.('copy');
    ta.remove();
    toast(ok ? okMsg : 'Clipboard blocked — value logged to the console', { tone: ok ? 'ok' : 'err', ms: 3200 });
    if (!ok) console.info(text);
  }
}

/* ------------------------------------------------------------ cooldown meter */

const cooldownEl = $('#cooldown');
const cooldownFill = $('#cooldownFill');
const cooldownText = $('#cooldownText');
let cooldownTimer = null;

function paintCooldown() {
  const { waitMs, intervalMs } = pacer.snapshot();
  if (intervalMs <= 0) {
    cooldownEl.hidden = true;
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
    return;
  }
  cooldownEl.hidden = false;
  cooldownFill.style.width = `${Math.max(0, Math.min(100, 100 - (waitMs / intervalMs) * 100)).toFixed(1)}%`;
  cooldownText.textContent = waitMs > 50 ? `next in ${(waitMs / 1000).toFixed(1)}s` : 'ready';
}

function ensureCooldownTicker() {
  if (cooldownTimer) return;
  cooldownTimer = setInterval(() => {
    paintCooldown();
    // Keep the "waiting for a slot" copy live on pending cards.
    if (queue.isBusy) {
      for (const card of cards.values()) {
        if (card.node.dataset.loading === '1') renderCardMeta(card.meta, card.job, { pending: true, note: pendingNote() });
      }
    }
    const { waitMs } = pacer.snapshot();
    if (!queue.isBusy && waitMs <= 0 && pacer.intervalMs <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }, 200);
  // Never hold a Node event loop open (tests run the same module).
  cooldownTimer.unref?.();
}

function watchCooldown() {
  paintCooldown();
  ensureCooldownTicker();
}
pacer.subscribe(() => {
  paintCooldown();
  ensureCooldownTicker();
});

/* -------------------------------------------------------------- filmstrip */

const filmstripEl = $('#filmstrip');
function renderFilmstrip() {
  $('#historyCount').textContent = renders.length ? `${renders.length} render${renders.length > 1 ? 's' : ''} kept in this browser` : 'nothing yet';
  filmstripEl.replaceChildren(
    ...renders.map((item) => {
      const isMockish = !item.url || item.mock;
      const thumb = el('img', {
        class: 'film__thumb',
        alt: '',
        loading: 'lazy',
        src: isMockish ? mockSvg({ finalPrompt: item.prompt, width: 512, height: 512, seed: item.seed, model: item.model }) : item.url,
      });
      thumb.addEventListener('error', () => {
        thumb.style.opacity = '0.22';
        thumb.alt = 'thumbnail unavailable offline';
      });
      const node = el(
        'div',
        { class: 'film', dataset: { id: item.id }, title: item.prompt, tabindex: '0', role: 'button', 'aria-label': `Restore settings for ${item.prompt.slice(0, 60)}` },
        thumb,
        el(
          'div',
          { class: 'film__cap' },
          el('p', { text: item.userPrompt || stripStyle(item.prompt) }),
          el('span', { text: `${modelLabel(item.model)} · ${item.width}×${item.height} · ${clockOf(item.ts)}` }),
        ),
        el('button', {
          class: 'film__kill',
          type: 'button',
          text: '✕',
          title: 'Forget this render',
          onclick: (e) => {
            e.stopPropagation();
            renders = removeHistoryItem(item.id);
            renderFilmstrip();
          },
        }),
      );
      const restore = () => {
        store.set({
          prompt: item.userPrompt || stripStyle(item.prompt),
          model: item.model,
          seed: item.seed,
          lockSeed: true,
          aspect: item.aspect || '1:1',
          width: item.width || store.state.width,
          height: item.height || store.state.height,
          resolution: item.resolution || '1K',
          stylePreset: item.stylePreset || 'none',
          avoid: item.avoid || '',
          enhance: item.enhance !== false,
          refs: normalizeRefs(item.refs),
        });
        renderRefs();
        toast('Settings restored — Generate re-renders the exact same image.', { tone: 'ok', ms: 3000 });
      };
      node.addEventListener('click', restore);
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          restore();
        }
      });
      return node;
    }),
  );
}

$('#clearStageBtn')?.addEventListener('click', () => {
  if (!cards.size) return;
  const n = cards.size;
  for (const id of [...cards.keys()]) removeCard(id);
  toast(`Cleared ${n} card${n === 1 ? '' : 's'} from the stage — history still holds them.`, { tone: 'ok', ms: 2600 });
});

$('#historyClear').addEventListener('click', () => {
  if (!renders.length) return;
  if (!window.confirm(`Forget all ${renders.length} saved renders? Prompts and seeds are removed from this browser.`)) return;
  renders = clearHistory();
  renderFilmstrip();
  toast('History cleared.', { tone: 'ok', ms: 2000 });
});

$('#historyRedownload').addEventListener('click', async () => {
  const thumbs = $$('.film__thumb', filmstripEl);
  thumbs.forEach((img) => {
    const src = img.getAttribute('src');
    img.removeAttribute('src');
    img.setAttribute('src', src);
    img.style.opacity = '1';
  });
  toast('Thumbnails re-fetched — the provider caches by prompt + seed, so this is free.', { tone: 'ok', ms: 3400 });
});

/* -------------------------------------------------------------- composer UI */

const promptEl = $('#prompt');
const avoidEl = $('#avoid');
const seedEl = $('#seed');
const lockSeedEl = $('#lockSeed');
const countEl = $('#promptCount');
const meterEl = $('#promptMeter');
const tipsEl = $('#promptTips');
const dimsHintEl = $('#dimsHint');
const styleHintEl = $('#styleHint');
const batchValueEl = $('#batchValue');
const batchNoteEl = $('#batchNote');
const customDimsEl = $('#customDims');
const customWEl = $('#customW');
const customHEl = $('#customH');
const mockEl = $('#mockMode');
const tokenEl = $('#token');
const enhanceEl = $('#enhance');
const nologoEl = $('#nologo');
const safeEl = $('#safe');
const privateEl = $('#private');

function syncControls(state) {
  if (promptEl.value !== state.prompt) promptEl.value = state.prompt;
  if (avoidEl.value !== state.avoid) avoidEl.value = state.avoid;
  const seedText = state.seed === null ? '' : String(state.seed);
  if (seedEl.value !== seedText) seedEl.value = seedText;
  lockSeedEl.checked = state.lockSeed;
  enhanceEl.checked = state.enhance;
  nologoEl.checked = state.nologo;
  safeEl.checked = state.safe;
  privateEl.checked = state.private;
  mockEl.checked = Boolean(state.mock);
  if (tokenEl.value !== state.token) tokenEl.value = state.token || '';
  if (paceEl.value !== state.pace) paceEl.value = state.pace;
  if (!globalThis.document?.activeElement || globalThis.document.activeElement !== customWEl) customWEl.value = String(state.width || 1024);
  if (!globalThis.document?.activeElement || globalThis.document.activeElement !== customHEl) customHEl.value = String(state.height || 1024);

  $$('[data-style]', styleChipsEl).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.style === state.stylePreset)));
  $$('[data-aspect]', ratioGridEl).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.aspect === state.aspect)));
  $$('[data-res]', resSegEl).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.res === state.resolution)));
  $$('[data-model]', modelListEl).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.model === state.model)));
  customDimsEl.hidden = state.aspect !== 'custom';
  const isCustom = state.aspect === 'custom';
  for (const btn of $$('[data-res]', resSegEl)) {
    btn.disabled = isCustom;
    btn.title = isCustom ? 'Custom sizes set the pixel dimensions directly' : `${btn.dataset.res} tier scales the chosen ratio`;
  }


  const dims = resolveDims({ aspect: state.aspect, resolution: state.resolution, model: state.model, customWidth: state.width, customHeight: state.height });
  const capped = isSizeCapped({ aspect: state.aspect, resolution: state.resolution, model: state.model, customWidth: state.width, customHeight: state.height });
  // Always show the size that will actually be sent (16px-grid rounded), not the raw input.
  dimsHintEl.textContent = `${dims.width} × ${dims.height}${isCustom ? ' · custom' : ''}${capped ? ' · clamped to model' : ''}`;
  styleHintEl.textContent = stylePresetById(state.stylePreset).hint;
  batchValueEl.textContent = String(state.batch);
  const paceSeconds = Math.round(intervalFor(state.pace) / 1000);
  batchNoteEl.textContent = state.mock
    ? 'mock mode: no cooldown'
    : state.batch > 1
      ? `${state.batch} renders × new seeds, ~${paceSeconds}s apart`
      : 'variations use new seeds';
  $('#paceNote').textContent = PACE_OPTIONS.find((p) => p.id === state.pace)?.note || '';
  renderPromptMeta(state);
  markModelAvailability();
}

function renderPromptMeta(state) {
  const sent = composePrompt(state, STYLE_PRESETS);
  countEl.textContent = `${state.prompt.length} chars${sent.length !== state.prompt.length ? ` → ${sent.length} sent` : ''}`;
  const info = analysePrompt(state.prompt);
  $$('i', meterEl).forEach((bar, i) => {
    bar.removeAttribute('data-on');
    if (i < info.score) bar.dataset.on = info.score <= 2 ? 'warn' : '1';
  });
  const tips = state.prompt.trim() ? info.tips.slice(0, 3) : [];
  tipsEl.hidden = !tips.length;
  tipsEl.replaceChildren(...tips.map((t) => el('li', { text: t })));
  meterEl.title = `Prompt specificity ${info.score}/5`;
}

function markModelAvailability() {
  const state = store.state;
  for (const btn of $$('[data-model]', modelListEl)) {
    const id = btn.dataset.model;
    const flag = $('.model__flag', btn);
    const meta = modelById(id);
    btn.classList.toggle('is-unavailable', unavailableModels.has(id));
    if (state.mock) {
      flag.removeAttribute('data-flag');
      flag.textContent = 'mock';
    } else if (unavailableModels.has(id)) {
      flag.dataset.flag = 'gated';
      flag.textContent = 'refused';
    } else if (!liveModels) {
      flag.dataset.flag = '';
      flag.textContent = meta.premium ? 'tier?' : 'free';
    } else {
      const ok = liveModels.includes(id);
      flag.dataset.flag = ok ? 'ready' : '';
      flag.textContent = ok ? 'ready' : 'unlisted';
    }
  }
  if (state.mock) {
    modelStatusEl.textContent = 'mock renderer on · nothing leaves the page';
  } else if (!liveModels) {
    modelStatusEl.textContent = 'probing the keyless endpoint…';
  } else {
    modelStatusEl.textContent = `provider lists ${liveModels.length} model${liveModels.length === 1 ? '' : 's'}`;
  }
  if (liveModels) {
    modelsChipEl.hidden = false;
    modelsTextEl.textContent = `listed: ${liveModels.slice(0, 8).join(', ')}${liveModels.length > 8 ? '…' : ''}`;
  }
}

/* -------------------------------------------------------------- input wiring */

promptEl.addEventListener('input', () => store.set({ prompt: promptEl.value }));
avoidEl.addEventListener('input', () => store.set({ avoid: avoidEl.value }));
seedEl.addEventListener('input', () => {
  const v = seedEl.value.trim();
  if (v === '') return store.set({ seed: null, lockSeed: false });
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return;
  store.set({ seed: Math.max(0, Math.min(SEED_MAX, n)), lockSeed: true });
});
lockSeedEl.addEventListener('change', () => {
  const on = lockSeedEl.checked;
  store.set({ lockSeed: on, seed: on ? (store.state.seed ?? randomSeed()) : store.state.seed });
});
enhanceEl.addEventListener('change', () => store.set({ enhance: enhanceEl.checked }));
nologoEl.addEventListener('change', () => store.set({ nologo: nologoEl.checked }));
safeEl.addEventListener('change', () => store.set({ safe: safeEl.checked }));
privateEl.addEventListener('change', () => store.set({ private: privateEl.checked }));
tokenEl.addEventListener('input', () => store.set({ token: tokenEl.value.trim() }));
customWEl.addEventListener('change', () => store.set({ width: Number(customWEl.value) || 1024, aspect: 'custom' }));
customHEl.addEventListener('change', () => store.set({ height: Number(customHEl.value) || 1024, aspect: 'custom' }));

mockEl.addEventListener('change', () => {
  store.set({ mock: mockEl.checked });
  pacer.setInterval(mockEl.checked ? 0 : intervalFor(store.state.pace));
  if (!mockEl.checked && !liveModels) probeProvider();
  toast(
    mockEl.checked
      ? 'Mock renderer on: pictures are drawn in-page from prompt + seed. Perfect for demos, offline work, and testing the queue.'
      : 'Mock renderer off: requests go to the keyless provider.',
    { tone: mockEl.checked ? 'ok' : 'warn', ms: 5200, action: mockEl.checked ? null : { label: 'Keep mock', run: () => { mockEl.checked = true; store.set({ mock: true }); } } },
  );
});

$('#batchStepper').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-batch]');
  if (!btn) return;
  store.set({ batch: Math.max(1, Math.min(MAX_BATCH, store.state.batch + Number(btn.dataset.batch))) });
});

$('#diceBtn').addEventListener('click', () => {
  const s = randomSeed();
  store.set({ seed: s, lockSeed: lockSeedEl.checked || seedEl.value !== '' });
});
$('#surpriseBtn').addEventListener('click', () => {
  store.set({ prompt: randomPrompt() });
  promptEl.focus();
});
$('#clearPromptBtn').addEventListener('click', () => {
  store.set({ prompt: '', avoid: '', stylePreset: 'none' });
  promptEl.focus();
});
$('#tryExampleBtn').addEventListener('click', () => {
  const item = PROMPT_LIBRARY[Math.floor(Math.random() * PROMPT_LIBRARY.length)];
  store.set({ prompt: item.text.split(',').join(', '), stylePreset: LIBRARY_STYLE[item.tag] || 'cinematic' });
  promptEl.focus();
  setNote(`Loaded “${item.title}” from the library.`, 'info');
});
$('#tryMockBtn').addEventListener('click', () => {
  if (!store.state.prompt) {
    const item = PROMPT_LIBRARY[1];
    store.set({ prompt: item.text.split(',').join(', '), stylePreset: 'photo', mock: true });
  } else store.set({ mock: true });
  pacer.setInterval(0);
  syncControls(store.state);
  startGeneration();
});
$('#shareBtn').addEventListener('click', () => {
  copyText(`${location.origin}${location.pathname}${stateToQuery(store.state)}`, 'Setup link copied — it restores every control except a token');
});

/* -------------------------------------------------------------- submit/stop */

function startGeneration() {
  const state = store.state;
  if (!composePrompt(state, STYLE_PRESETS).trim()) {
    setNote('A prompt is required — one clear subject plus a mood is enough.', 'warn');
    toast('Write a prompt first.', { tone: 'warn', ms: 2600 });
    promptEl.focus();
    return;
  }
  const usedRefs = limitRefs(state.refs, state.model).length;
  if (state.refs?.length && usedRefs !== state.refs.length) {
    toast(
      usedRefs === 0
        ? `${modelLabel(state.model)} takes no reference images — yours were kept, not sent.`
        : `Only the first ${usedRefs} reference${usedRefs === 1 ? '' : 's'} will be sent to ${modelLabel(state.model)}.`,
      { tone: 'warn', ms: 4600 },
    );
  }
  const baseSeed = state.lockSeed && Number.isInteger(state.seed) ? state.seed : randomSeed();
  if (!state.lockSeed) store.set({ seed: null });
  setNote(state.batch > 1 && !state.mock ? `${state.batch} renders queued — the free tier spreads them over ~${(state.batch - 1) * Math.round(intervalFor(state.pace) / 1000)}s.` : '', 'info');
  runJobs(buildJobs({ count: state.batch, baseSeed, model: state.model, resolution: state.resolution }));
}

$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  startGeneration();
});

stopBtn.addEventListener('click', () => {
  queue.cancelAll();
  setBusy(false);
  setNote('Stopped. Anything already sent to the provider may still finish server-side.', 'warn');
});

/* --------------------------------------------------------------- keyboard */

document.addEventListener('keydown', (e) => {
  const target = document.activeElement;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '') || target?.isContentEditable;
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    startGeneration();
    return;
  }
  if (e.key === 'Escape') {
    if (!helpModal.hidden) closeHelp();
    else if (queue.isBusy) stopBtn.click();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 's' || e.key === 'S') $('#diceBtn').click();
  else if (e.key === 'd' || e.key === 'D') {
    const last = [...cards.values()].pop();
    if (last) downloadJob(last.job);
    else toast('Nothing to download yet.', { tone: 'info', ms: 2000 });
  } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) openHelp();
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const items = $$('.film', filmstripEl);
    if (!items.length) return;
    const next = (Number(filmstripEl.dataset.cursor ?? -1) + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    filmstripEl.dataset.cursor = String(next);
    items[next].focus?.();
    items[next].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
});

/* ------------------------------------------------------------------- theme */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}
applyTheme(loadTheme());
$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
});

/* -------------------------------------------------------------------- help */

const helpModal = $('#helpModal');
function openHelp() {
  helpModal.hidden = false;
  $('.modal__close', helpModal)?.focus?.();
}
function closeHelp() {
  helpModal.hidden = true;
}
$('#helpBtn').addEventListener('click', () => (helpModal.hidden ? openHelp() : closeHelp()));
helpModal.addEventListener('click', (e) => {
  if (e.target.dataset.close) closeHelp();
});

/* ------------------------------------------------- provider availability */

async function probeProvider() {
  if (store.state.mock) return;
  const controller = new AbortController();
  const killer = setTimeout(() => controller.abort(), 9000);
  try {
    const models = await fetchAvailableModels(controller.signal);
    liveModels = Array.isArray(models) ? models : null;
    tierDotEl.className = 'dot dot--ok';
    tierTextEl.textContent = `keyless tier live · ${liveModels?.length ?? 0} model${liveModels?.length === 1 ? '' : 's'} listed`;
  } catch (err) {
    const e = friendlyError(err);
    if (e.code === 'RATE_LIMITED') {
      // A 429 on the models endpoint still proves the service is up.
      tierDotEl.className = 'dot dot--ok';
      tierTextEl.textContent = 'keyless tier live · throttled right now';
    } else {
      tierDotEl.className = 'dot dot--warn';
      tierTextEl.textContent = 'cannot read the model list · rendering may still work';
    }
  } finally {
    clearTimeout(killer);
    markModelAvailability();
  }
}

/* -------------------------------------------------------------------- boot */

store.subscribe((state) => syncControls(state));

function boot() {
  renderRefs();
  renderFilmstrip();
  syncControls(store.state);
  updateStageChrome();
  watchCooldown();
  if (urlState) {
    setNote('Setup restored from a shared link — press Generate to render it.', 'ok');
  } else if (!persisted) {
    setNote('No key, no signup: the free tier answers straight from your browser.', 'info');
  }
  probeProvider();
  window.addEventListener('focus', () => {
    if (!liveModels && !store.state.mock) probeProvider();
  });
  window.addEventListener('online', () => {
    tierDotEl.className = 'dot dot--pulse';
    probeProvider();
  });
  window.addEventListener('offline', () => {
    tierDotEl.className = 'dot dot--err';
    tierTextEl.textContent = 'offline · switch to mock mode to keep working';
  });
  globalThis.addEventListener?.('beforeunload', () => {
    for (const card of cards.values()) revokeCard(card);
  });
}

boot();

/** Small console/test surface: lets automation drive a run without clicking. */
globalThis.NanoBanana = {
  store,
  pacer,
  queue,
  startGeneration,
  buildJobs,
  runJobs,
  renders: () => renders,
  provider: PROVIDER,
  version: '1.0.0',
};

