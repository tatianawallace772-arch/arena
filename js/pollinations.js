/**
 * pollinations.js — the generation engine.
 *
 * Two transports are used in order:
 *   1. fetch()  → gives us status codes (rate limit vs. gated model vs. 5xx)
 *                  plus a Blob we can download without a second request.
 *   2. <img>    → CORS-free fallback that still displays the picture when the
 *                  provider does not allow cross-origin reads.
 *
 * `mock` mode renders a deterministic SVG locally so the whole UI (queue,
 * history, downloads, share links) works with no network at all.
 */

import {
  PROVIDER,
  GENERATE_TIMEOUT_MS,
  composePrompt,
  limitRefs,
  resolveDims,
} from './config.js';

export class ProviderError extends Error {
  constructor(message, { code = 'PROVIDER_ERROR', status = 0, retryAfterMs = 0, modelRejected = false, fatal = false } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.modelRejected = modelRejected;
    this.fatal = fatal;
  }
}

/** Build the keyless GET URL for one image. */
export function buildImageUrl({
  finalPrompt,
  model,
  width,
  height,
  seed,
  enhance = true,
  nologo = true,
  safe = false,
  private: isPrivate = true,
  refs = [],
  token = '',
  base = PROVIDER.imageBase,
} = {}) {
  if (!finalPrompt) throw new ProviderError('Prompt is empty', { code: 'NO_PROMPT', fatal: true });
  const params = new URLSearchParams();
  params.set('width', String(width));
  params.set('height', String(height));
  if (Number.isInteger(seed)) params.set('seed', String(seed));
  if (model) params.set('model', model);
  if (nologo) params.set('nologo', 'true');
  if (enhance) params.set('enhance', 'true');
  if (safe) params.set('safe', 'true');
  if (isPrivate) params.set('private', 'true');
  params.set('referrer', PROVIDER.referrer);
  for (const ref of refs) params.append('image', ref);
  if (token) params.set('token', token);
  return `${base}${encodeURIComponent(finalPrompt)}?${params.toString()}`;
}

/** Translate an HTTP failure into something the UI can act on. */
export function classifyFailure({ status, body = '', headers = null }) {
  const text = String(body).slice(0, 800);
  const retryAfterHeader = typeof headers?.get === 'function' ? headers.get('retry-after') : null;
  const parsedRetry = Number(retryAfterHeader);
  const retryAfterMs = Number.isFinite(parsedRetry) ? Math.max(0, parsedRetry * 1000) : 0;
  const lower = text.toLowerCase();

  if (status === 429 || /rate.?limit|too many requests|slow down|back off/.test(lower)) {
    return new ProviderError('Rate limited by the free tier', {
      code: 'RATE_LIMITED',
      status,
      retryAfterMs: retryAfterMs || PROVIDER.anonMinIntervalMs,
    });
  }
  if (status === 402 || /credit|quota|insufficient|payment|upgrade/.test(lower)) {
    return new ProviderError('This model needs paid credits on the provider', {
      code: 'NEEDS_CREDITS',
      status,
      modelRejected: true,
    });
  }
  if (status === 401 || status === 403 || /api key|unauthorized|forbidden|token/.test(lower)) {
    return new ProviderError('Model is gated behind a key for anonymous use', {
      code: 'NEEDS_KEY',
      status,
      modelRejected: true,
    });
  }
  if (status === 400 && /model|invalid option|enum|parameter/.test(lower)) {
    return new ProviderError('Provider rejected the model or parameters', {
      code: 'BAD_REQUEST',
      status,
      modelRejected: true,
    });
  }
  if (status >= 500) {
    return new ProviderError('Provider is having a moment', { code: 'UPSTREAM', status });
  }
  return new ProviderError(text ? `Provider error (${status || 'network'})` : 'Provider error', {
    code: 'PROVIDER_ERROR',
    status,
  });
}

async function loadWithFetch(url, signal) {
  const res = await fetch(url, { signal, mode: 'cors', credentials: 'omit', redirect: 'follow' });
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      /* body may be unavailable */
    }
    throw classifyFailure({ status: res.status, body, headers: res.headers });
  }
  const blob = await res.blob();
  if (!blob || !/^image\//.test(blob.type || '')) {
    // Some deployments answer 200 with a JSON error body.
    let text = '';
    try {
      text = await blob.text();
    } catch {
      /* ignore */
    }
    if (/json|error|text/i.test(blob.type || '') || /^\s*[{[]/.test(text)) {
      throw classifyFailure({ status: 200, body: text });
    }
    throw new ProviderError('Provider did not return an image', { code: 'BAD_PAYLOAD', status: res.status });
  }
  // A missing or throwing createObjectURL (older engines, nonstandard blobs,
  // test harnesses) must not be mistaken for a CORS failure — fall back to
  // displaying the provider URL directly.
  let src = null;
  try {
    if (typeof URL?.createObjectURL === 'function') src = URL.createObjectURL(blob);
  } catch {
    src = null;
  }
  if (!src) return { src: url, revoke: () => {}, blob, bytes: blob?.size || 0, transport: 'fetch' };
  return {
    src,
    revoke: () => {
      try {
        URL.revokeObjectURL(src);
      } catch {
        /* already revoked */
      }
    },
    blob,
    bytes: blob?.size || 0,
    transport: 'fetch',
  };
}

function loadWithImageElement(url, signal) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
      img.onload = null;
      img.onerror = null;
    };
    const onAbort = () => {
      img.src = '';
      cleanup();
      reject(new ProviderError('Cancelled', { code: 'ABORTED', fatal: true }));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    // No crossOrigin on purpose: it keeps the request working when the CDN
    // omits CORS headers. Downloads then fall back to a plain link.
    img.decoding = 'async';
    img.onload = () => {
      cleanup();
      resolve({ src: url, revoke: () => {}, blob: null, bytes: 0, transport: 'img' });
    };
    img.onerror = () => {
      cleanup();
      reject(classifyFailure({ status: 0, body: '' }));
    };
    img.src = url;
  });
}

/* ------------------------------------------------------------- mock engine */

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapText(text, perLine) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > perLine) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line ? `${line} ` : '') + w;
    }
    if (lines.length >= 4) break;
  }
  if (line && lines.length < 4) lines.push(line);
  return lines;
}

/**
 * Deterministic offline render: same prompt + seed always produces the same
 * artwork, so history/share links/seed locking stay meaningful without a key.
 */
export function mockSvg({ finalPrompt, width, height, seed = 0, model = 'mock' }) {
  const key = `${finalPrompt}|${seed}|${model}`;
  const rnd = mulberry32(hash32(key));
  const hue = Math.floor(rnd() * 360);
  const hue2 = (hue + 40 + Math.floor(rnd() * 180)) % 360;
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const cx = Math.round(rnd() * width);
    const cy = Math.round(rnd() * height);
    const r = Math.round((0.12 + rnd() * 0.3) * Math.min(width, height));
    const h = (hue + Math.round(rnd() * 120)) % 360;
    const o = (0.25 + rnd() * 0.45).toFixed(2);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${h} 85% 60%)" opacity="${o}" filter="url(#b${i})"/>`;
  });
  const filters = blobs
    .map((_, i) => `<filter id="b${i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(
      (0.02 + rnd() * 0.06) * Math.min(width, height),
    )}"/></filter>`)
    .join('');
  const lines = wrapText(finalPrompt, Math.max(18, Math.floor(width / 26)));
  const fs = Math.max(15, Math.round(Math.min(width, height) / 26));
  const body = lines
    .map((l, i) => `<text x="${Math.round(width * 0.07)}" y="${Math.round(height * 0.62) + i * Math.round(fs * 1.35)}" font-size="${fs}" font-weight="700">${escapeXml(l)}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue} 70% 14%)"/><stop offset="1" stop-color="hsl(${hue2} 65% 22%)"/>
</linearGradient>
${filters}
<pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M0 24L24 0" stroke="rgba(255,255,255,.05)" stroke-width="1"/></pattern>
</defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<rect width="100%" height="100%" fill="url(#p)"/>
${blobs.join('')}
<g fill="#fff" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif">${body}</g>
<g transform="translate(${Math.round(width * 0.07)},${Math.round(height * 0.07)})">
<rect x="-1" y="-1" rx="8" width="${Math.max(150, Math.round(width * 0.3))}" height="${fs * 2.4}" fill="rgba(0,0,0,.45)"/>
<text font-size="${Math.round(fs * 0.75)}" y="${fs * 0.95}" x="${Math.round(fs * 0.5)}" fill="#ffd84d">MOCK · ${escapeXml(model)} · seed ${seed}</text>
</g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
}

/* ------------------------------------------------------------ public entry */

/**
 * Generate one image.
 * @returns {Promise<{src:string,revoke:Function,bytes:number,transport:string,url:string,attempt:number}>}
 */
export async function generateOne(params, { signal, attempts = 3, onAttempt, mock = false, transport = 'auto' } = {}) {
  const { finalPrompt, width, height, seed, model } = params;
  const url = buildImageUrl(params);

  if (mock) {
    await sleep(260 + Math.random() * 500, signal);
    const src = mockSvg({ finalPrompt, width, height, seed, model: model || 'nanobanana' });
    return { src, revoke: () => {}, bytes: 0, transport: 'mock', url, attempt: 1 };
  }

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    onAttempt?.({ attempt, total: attempts, url });
    try {
      if (transport !== 'img') {
        return { ...(await withTimeout(loadWithFetch(url, signal), GENERATE_TIMEOUT_MS, signal)), url, attempt };
      }
      return { ...(await withTimeout(loadWithImageElement(url, signal), GENERATE_TIMEOUT_MS, signal)), url, attempt };
    } catch (err) {
      lastError = err;
      if (err?.code === 'ABORTED' || err?.fatal) throw err;
      // Unreadable response (CORS/offline) on the fetch path → retry as <img>.
      if (transport === 'auto' && !(err instanceof ProviderError) && isTypeError(err)) {
        try {
          return { ...(await withTimeout(loadWithImageElement(url, signal), GENERATE_TIMEOUT_MS, signal)), url, attempt };
        } catch (imgErr) {
          lastError = imgErr;
        }
      }
      // 4xx that will not improve by retrying, except rate limits.
      if (err instanceof ProviderError && (err.code === 'BAD_REQUEST' || err.code === 'NEEDS_KEY' || err.code === 'NEEDS_CREDITS')) {
        throw err;
      }
      if (attempt < attempts) {
        const waitMs = err?.retryAfterMs || Math.min(20_000, 1500 * 2 ** (attempt - 1));
        await sleep(waitMs, signal);
      }
    }
  }
  throw lastError || new ProviderError('Generation failed', { code: 'UNKNOWN' });
}

function isTypeError(err) {
  return err instanceof TypeError || /failed to fetch|load failed|networkerror/i.test(String(err?.message || ''));
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new ProviderError('Cancelled', { code: 'ABORTED', fatal: true }));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function withTimeout(promise, ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new ProviderError('Timed out waiting for the provider', { code: 'TIMEOUT' }));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
    signal?.addEventListener('abort', () => clearTimeout(t), { once: true });
  });
}

/**
 * Read the live model list. The keyless tier may report fewer models than the
 * API actually accepts, so callers should union this with the curated catalog.
 */
export async function fetchAvailableModels(signal) {
  const res = await fetch(PROVIDER.modelsEndpoint, { signal, mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw classifyFailure({ status: res.status, body: await res.text().catch(() => '') });
  const data = await res.json();
  const list = Array.isArray(data)
    ? data.map((d) => (typeof d === 'string' ? d : d?.name))
    : Object.keys(data?.models || data || {});
  return list.filter(Boolean).map(String);
}

/** Small helper so callers can compose + size in one step. */
export function requestParamsFor(state, presets, { seed, model } = {}) {
  const finalPrompt = composePrompt(state, presets);
  const chosenModel = model || state.model;
  const dims = resolveDims({
    aspect: state.aspect,
    resolution: state.resolution,
    model: chosenModel,
    customWidth: state.width,
    customHeight: state.height,
  });
  return {
    finalPrompt,
    model: chosenModel,
    width: dims.width,
    height: dims.height,
    seed,
    enhance: state.enhance,
    nologo: state.nologo,
    safe: state.safe,
    private: state.private,
    // Only send references the selected model can take; the rest stay in the
    // composer so switching models back does not silently lose them.
    refs: limitRefs(state.refs, chosenModel),
    token: state.token || '',
  };
}
