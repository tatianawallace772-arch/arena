#!/usr/bin/env node
/**
 * Core Codex — server.js
 * ---------------------------------------------------------------------------
 * Zero-dependency Node.js backend (Node 18+). No npm install required.
 *
 *   • Static hosting for the SPA in ./public
 *   • GET  /api/health          — service + upstream status
 *   • GET  /api/models          — z.ai model catalog (GLM-5.x / 4.7 / 4.5)
 *   • GET  /api/plans           — Core Codex plan catalog (server-authoritative)
 *   • POST /api/keys/validate   — validate a z.ai API key (format + live ping)
 *   • POST /api/agent           — SSE streaming generation
 *                                   ├─ with a valid key + reachable network:
 *                                   │    live proxy to api.z.ai chat completions
 *                                   └─ otherwise: Core Codex Local Engine
 *   • POST /api/checkout        — secure order processing (Luhn, server-side
 *                                 pricing, PAN never stored — brand+last4 only)
 *   • GET  /api/orders/:id      — receipt lookup
 *
 * Run:  node server.js   (PORT env var optional, default 3000)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const { streamLocal } = require('./engine');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const ZAI_BASE = process.env.ZAI_BASE || 'https://api.z.ai';
const UPSTREAM_TIMEOUT_MS = 7000;
const MAX_BODY_BYTES = 256 * 1024;

/* ------------------------------- model catalog ----------------------------- */

const MODELS = [
  {
    id: 'glm-5.3',
    name: 'GLM-5.3',
    badge: 'newest',
    tagline: 'The latest frontier coding model',
    description:
      'Newest GLM release, tuned for long-horizon agentic coding: multi-file refactors, ' +
      'tool orchestration and repo-scale reasoning. Included with Core Codex plans.',
    context: '256K',
    maxOutput: '128K',
    availability: ['plan'],
    strengths: ['Deep agentic coding', 'Multi-file refactors', 'Tool calling'],
  },
  {
    id: 'glm-5.2',
    name: 'GLM-5.2',
    badge: 'flagship',
    tagline: 'Flagship intelligence',
    description:
      'State-of-the-art on coding and reasoning benchmarks. The default choice for ' +
      'hard problems and production work.',
    context: '256K',
    maxOutput: '128K',
    availability: ['plan', 'api'],
    pricing: { input: 1.4, output: 4.4, unit: 'per 1M tokens' },
    strengths: ['Complex reasoning', 'Architecture design', 'Bug hunting'],
  },
  {
    id: 'glm-5-turbo',
    name: 'GLM-5-Turbo',
    badge: 'fast',
    tagline: 'Low latency, high throughput',
    description:
      'Latency-optimized sibling of the flagship. Ideal for rapid iteration loops ' +
      'and interactive agent sessions.',
    context: '200K',
    maxOutput: '64K',
    availability: ['plan', 'api'],
    strengths: ['Fast iteration', 'Interactive sessions'],
  },
  {
    id: 'glm-4.7',
    name: 'GLM-4.7',
    badge: 'balanced',
    tagline: 'The coding workhorse',
    description:
      'Best price/performance for everyday coding tasks — edits, tests, docs, ' +
      'small features.',
    context: '200K',
    maxOutput: '64K',
    availability: ['plan', 'api'],
    pricing: { input: 0.6, output: 2.2, unit: 'per 1M tokens' },
    strengths: ['Everyday coding', 'Great cost profile'],
  },
  {
    id: 'glm-4.7-flash',
    name: 'GLM-4.7-Flash',
    badge: 'free',
    tagline: 'Free & fast',
    description: 'Free tier model for quick edits, completions and shell commands.',
    context: '128K',
    maxOutput: '32K',
    availability: ['plan', 'api', 'free'],
    strengths: ['Free', 'Quick edits'],
  },
  {
    id: 'glm-4.5-air',
    name: 'GLM-4.5-Air',
    badge: 'edge',
    tagline: 'Light & capable',
    description: 'Compact model that punches above its weight on structured tasks.',
    context: '128K',
    maxOutput: '32K',
    availability: ['plan', 'api'],
    strengths: ['Lightweight', 'Structured output'],
  },
  {
    id: 'glm-4.5-flash',
    name: 'GLM-4.5-Flash',
    badge: 'free',
    tagline: 'Free starter',
    description: 'The original free workhorse — solid for learning and small scripts.',
    context: '128K',
    maxOutput: '16K',
    availability: ['api', 'free'],
    strengths: ['Free', 'Beginner friendly'],
  },
];
const MODEL_IDS = new Set(MODELS.map((m) => m.id));

/* --------------------------------- plans ----------------------------------- */
/* Mirrors the Z.ai GLM Coding Plan structure: Lite / Pro / Max. */

const PLANS = {
  free: {
    id: 'free',
    name: 'Explorer',
    priceCents: 0,
    annualCents: 0,
    quota5h: 20,
    weeklyQuota: 60,
    mcpCalls: 0,
    models: 'GLM-4.7-Flash, GLM-4.5-Air',
    features: [
      '20 prompts / 5 hours',
      'Local engine + free z.ai models',
      'Multi-file project generation',
      'Bring your own API key',
    ],
  },
  lite: {
    id: 'lite',
    name: 'Lite',
    priceCents: 1800,
    annualCents: 15120, // 30% off, billed yearly
    quota5h: 80,
    weeklyQuota: 400,
    mcpCalls: 100,
    models: 'All models incl. GLM-5.3 & GLM-5.2',
    features: [
      '~80 prompts / 5 hours',
      '~400 prompts / week',
      '100 MCP calls / month',
      'All GLM models incl. GLM-5.3',
      'Web search & reader MCP',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    popular: true,
    priceCents: 7200,
    annualCents: 60480,
    quota5h: 400,
    weeklyQuota: 2000,
    mcpCalls: 1000,
    models: 'All models, priority routing',
    features: [
      '~400 prompts / 5 hours (5× Lite)',
      '~2,000 prompts / week',
      '1,000 MCP calls / month',
      'Priority access to new flagships',
      'Faster generation at peak times',
      'Vision understanding',
    ],
  },
  max: {
    id: 'max',
    name: 'Max',
    priceCents: 16000,
    annualCents: 134400,
    quota5h: 1600,
    weeklyQuota: 8000,
    mcpCalls: 4000,
    models: 'All models + dedicated capacity',
    features: [
      '~1,600 prompts / 5 hours (20× Lite)',
      '~8,000 prompts / week',
      '4,000 MCP calls / month',
      'First access to new flagships',
      'Dedicated resources at peak times',
      'Long autonomous agent sessions',
    ],
  },
};

/* --------------------------------- helpers --------------------------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function send(res, status, body, headers = {}) {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(json);
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/* Simple fixed-window rate limiter (per IP, per bucket). */
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 5000) buckets.clear(); // crude memory guard
  return b.count <= max;
}

const clientIp = (req) => (req.socket.remoteAddress || 'unknown').replace('::ffff:', '');

/* ------------------------------ static hosting ------------------------------ */

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    return send(res, 403, { error: 'Forbidden' });
  }
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const data = await fsp.readFile(filePath);
    const cache = filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=86400' : 'no-cache';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    send(res, 404, { error: 'Not found', path: pathname });
  }
}

/* ------------------------------- z.ai upstream ------------------------------ */

let upstreamState = { checked: 0, reachable: false };

async function pingUpstream() {
  if (Date.now() - upstreamState.checked < 30_000) return upstreamState.reachable;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try {
    // An unauthenticated request to the models endpoint should answer fast
    // (401) when the API is reachable. Any HTTP response proves reachability.
    const res = await fetch(`${ZAI_BASE}/api/paas/v4/models`, {
      signal: ctl.signal,
      method: 'GET',
      headers: { Authorization: 'Bearer ping' },
    });
    upstreamState = { checked: Date.now(), reachable: res.status < 500 || res.status === 401 || res.status === 403 };
    // Any status (even 401/403) means network path exists.
    upstreamState.reachable = true;
  } catch {
    upstreamState = { checked: Date.now(), reachable: false };
  } finally {
    clearTimeout(t);
  }
  return upstreamState.reachable;
}

/**
 * Live-proxy a chat completion from z.ai, re-emitted as Core Codex SSE events.
 * Returns true if it produced output, false if we should fall back to local.
 */
async function streamZai({ apiKey, model, messages }, write, isClosed, abortSignal) {
  const ctl = new AbortController();
  const onUpstreamAbort = () => ctl.abort();
  abortSignal.addEventListener('abort', onUpstreamAbort, { once: true });

  let res;
  try {
    res = await fetch(`${ZAI_BASE}/api/paas/v4/chat/completions`, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.6,
        max_tokens: 4096,
      }),
    });
  } catch {
    return false; // network unreachable -> caller falls back to local engine
  }

  if (!res.ok || !res.body) {
    // Invalid key or upstream error -> surface a helpful event, then fallback.
    let detail = `z.ai responded ${res.status}`;
    try {
      const errBody = await res.text();
      const parsed = JSON.parse(errBody);
      detail = parsed.error?.message || parsed.message || detail;
    } catch { /* keep default */ }
    await write({ type: 'notice', level: 'warn', message: `z.ai: ${detail} — falling back to the local engine.` });
    return false;
  }

  await write({ type: 'meta', engine: 'z.ai', model, generator: `z.ai ${model}` });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawContent = false;

  try {
    while (true) {
      if (isClosed()) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          await write({ type: 'done' });
          return true;
        }
        try {
          const evt = JSON.parse(payload);
          const delta = evt.choices?.[0]?.delta?.content || '';
          if (delta) {
            sawContent = true;
            await write({ type: 'delta', text: delta });
          }
          if (evt.usage) {
            await write({
              type: 'usage',
              promptTokens: evt.usage.prompt_tokens ?? 0,
              completionTokens: evt.usage.completion_tokens ?? 0,
            });
          }
        } catch { /* ignore malformed frames */ }
      }
    }
    await write({ type: 'done' });
    return sawContent;
  } catch {
    return sawContent;
  } finally {
    abortSignal.removeEventListener('abort', onUpstreamAbort);
    try { reader.cancel(); } catch { /* noop */ }
  }
}

/* --------------------------------- SSE sink -------------------------------- */

function makeSseWriter(res) {
  return async (event) => {
    if (res.writableEnded || res.destroyed) return;
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch { /* connection gone */ }
  };
}

/* --------------------------------- checkout -------------------------------- */

const luhn = (digits) => {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
};

function cardBrand(digits) {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^(6011|65|64[4-9])/.test(digits)) return 'Discover';
  return 'Card';
}

const maskEmail = (e) => {
  if (!e || typeof e !== 'string' || !e.includes('@')) return undefined;
  const [user, domain] = e.split('@');
  const shown = user.slice(0, 2);
  return `${shown}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
};

async function loadOrders() {
  try {
    return JSON.parse(await fsp.readFile(ORDERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

async function saveOrders(orders) {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const trimmed = orders.slice(-500);
    await fsp.writeFile(ORDERS_FILE + '.tmp', JSON.stringify(trimmed, null, 2));
    await fsp.rename(ORDERS_FILE + '.tmp', ORDERS_FILE);
  } catch (err) {
    console.error('[orders] persist failed:', err.message);
  }
}

async function handleCheckout(req, res) {
  let body;
  try {
    body = await readBody(req, 64 * 1024);
  } catch (err) {
    return send(res, err.status || 400, { ok: false, error: err.message });
  }

  const { plan: planId, cycle, card, email } = body || {};
  const plan = PLANS[String(planId || '').toLowerCase()];
  if (!plan || plan.priceCents === 0) {
    return send(res, 400, { ok: false, error: 'Unknown plan. Choose Lite, Pro or Max.' });
  }
  if (cycle !== 'monthly' && cycle !== 'annual') {
    return send(res, 400, { ok: false, error: 'Billing cycle must be "monthly" or "annual".' });
  }
  if (!card || typeof card !== 'object') {
    return send(res, 400, { ok: false, error: 'Card details are required.' });
  }

  // --- Server-authoritative pricing (never trust client-side amounts) ---
  const amountCents = cycle === 'annual' ? plan.annualCents : plan.priceCents;

  // --- Card validation ---
  const number = String(card.number || '').replace(/[\s-]/g, '');
  const errors = [];
  if (!/^\d{13,19}$/.test(number)) errors.push('Card number must be 13–19 digits.');
  else if (!luhn(number)) errors.push('Card number failed the Luhn check.');

  const exp = String(card.exp || '').trim();
  const expMatch = exp.match(/^(0?[1-9]|1[0-2])\s*\/\s*(\d{2})$/);
  if (!expMatch) {
    errors.push('Expiry must be in MM/YY format.');
  } else {
    const month = Number(expMatch[1]);
    const year = 2000 + Number(expMatch[2]);
    const endOfMonth = new Date(year, month, 1).getTime(); // first day of next month
    if (Date.now() >= endOfMonth) errors.push('That card has expired.');
  }

  const cvc = String(card.cvc || '').trim();
  const isAmex = cardBrand(number) === 'Amex';
  if (!new RegExp(isAmex ? '^\\d{4}$' : '^\\d{3,4}$').test(cvc)) {
    errors.push(`Security code must be ${isAmex ? 4 : 3} digits.`);
  }

  if (!card.name || String(card.name).trim().length < 2) {
    errors.push('Name on card is required.');
  }

  if (errors.length) {
    return send(res, 402, { ok: false, error: 'Payment could not be authorized.', errors });
  }

  // --- Simulated PSP authorization ---
  // Test behaviors: 4000 0000 0000 0002 -> declined. 5555 5555 5555 4444 etc -> approved.
  await new Promise((r) => setTimeout(r, 900));
  if (number === '4000000000000002') {
    return send(res, 402, {
      ok: false,
      error: 'Your card was declined by the issuer. Try another card (test: 4242 4242 4242 4242).',
    });
  }

  const now = new Date();
  const order = {
    id: 'cc_' + now.getTime().toString(36) + crypto.randomBytes(4).toString('hex'),
    status: 'paid',
    plan: plan.id,
    planName: plan.name,
    cycle,
    amountCents,
    currency: 'usd',
    // PAN is NEVER stored — brand + last4 only.
    card: { brand: cardBrand(number), last4: number.slice(-4) },
    email: maskEmail(email),
    name: String(card.name).trim().slice(0, 80),
    createdAt: now.toISOString(),
    renewsAt: new Date(
      cycle === 'annual' ? now.getTime() + 365 * 864e5 : now.getTime() + 30 * 864e5
    ).toISOString(),
  };

  const orders = await loadOrders();
  orders.push(order);
  await saveOrders(orders);

  return send(res, 201, { ok: true, order });
}

/* ---------------------------------- router --------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const started = Date.now();

  res.on('finish', () => {
    if (pathname.startsWith('/api')) {
      console.log(`${new Date().toISOString()} ${req.method} ${pathname} -> ${res.statusCode} (${Date.now() - started}ms)`);
    }
  });

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; " +
      "script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );

  try {
    /* ------------------------------ API routes ----------------------------- */

    if (pathname === '/api/health' && req.method === 'GET') {
      const reachable = await pingUpstream();
      return send(res, 200, {
        ok: true,
        service: 'Core Codex',
        version: '1.0.0',
        time: new Date().toISOString(),
        upstream: { name: 'z.ai', base: ZAI_BASE, reachable },
        engine: reachable ? 'z.ai + local fallback' : 'local (z.ai unreachable from this host)',
        uptimeSec: Math.round(process.uptime()),
      });
    }

    if (pathname === '/api/models' && req.method === 'GET') {
      return send(res, 200, { ok: true, models: MODELS, default: 'glm-5.2' });
    }

    if (pathname === '/api/plans' && req.method === 'GET') {
      return send(res, 200, {
        ok: true,
        plans: ['free', 'lite', 'pro', 'max'].map((k) => PLANS[k]),
        annualDiscountPct: 30,
      });
    }

    if (pathname === '/api/keys/validate' && req.method === 'POST') {
      if (!rateLimit('key:' + clientIp(req), 20, 60_000)) {
        return send(res, 429, { ok: false, error: 'Too many attempts — try again in a minute.' });
      }
      const body = await readBody(req, 16 * 1024);
      const key = String(body.apiKey || '').trim();

      const shapeOk =
        // Zhipu-style "{32 hex}.{secret}"
        /^[0-9a-f]{32}\.[A-Za-z0-9]{8,}$/.test(key) ||
        // Generic bearer token (sk-..., long alphanumerics)
        (key.length >= 32 && key.length <= 128 && /^[A-Za-z0-9._-]+$/.test(key));

      if (!shapeOk) {
        return send(res, 200, {
          ok: true,
          valid: false,
          reason:
            'Keys are usually 32+ characters, e.g. "a1b2…f0e1.x9y8z7" from z.ai → API Keys. ' +
            'Paste the full key and try again.',
        });
      }

      // Try a live check (fast fail when network is unreachable).
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 5000);
      let live = false;
      let detail = 'Saved. z.ai could not be reached from this host — the key will be used automatically once the network path is available.';
      try {
        const r = await fetch(`${ZAI_BASE}/api/paas/v4/chat/completions`, {
          method: 'POST',
          signal: ctl.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: 'glm-4.5-flash',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
            stream: false,
          }),
        });
        if (r.ok) {
          live = true;
          detail = 'Key verified live against z.ai — GLM models ready.';
        } else if (r.status === 401 || r.status === 403) {
          return send(res, 200, { ok: true, valid: false, reason: 'z.ai rejected this key (unauthorized). Double-check it at z.ai → API Keys.' });
        } else {
          detail = `Format looks right. z.ai answered ${r.status} on the test call.`;
        }
      } catch {
        /* keep offline default */
      } finally {
        clearTimeout(timer);
      }

      return send(res, 200, { ok: true, valid: true, live, detail });
    }

    if (pathname === '/api/agent' && req.method === 'POST') {
      if (!rateLimit('agent:' + clientIp(req), 40, 60_000)) {
        return send(res, 429, { ok: false, error: 'Rate limit — slow down a little.' });
      }
      const body = await readBody(req, MAX_BODY_BYTES);
      const prompt = String(body.prompt || '').trim();
      const model = MODEL_IDS.has(body.model) ? body.model : 'glm-5.2';
      const mode = body.mode === 'ask' ? 'ask' : 'agent';
      const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
      const apiKey = String(body.apiKey || '').trim();

      if (!prompt) return send(res, 400, { ok: false, error: 'A prompt is required.' });
      if (prompt.length > 8000) return send(res, 400, { ok: false, error: 'Prompt too long (8000 char max).' });

      // SSE setup
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      if (req.method === 'HEAD') { res.end(); return; }

      let closed = false;
      const upstreamAbort = new AbortController();
      req.on('close', () => { closed = true; upstreamAbort.abort(); });

      const heartbeat = setInterval(() => {
        if (!closed) res.write(': ping\n\n');
      }, 15000);

      const write = makeSseWriter(res);
      const isClosed = () => closed || res.destroyed;

      try {
        if (apiKey) {
          const messages = [
            {
              role: 'system',
              content:
                'You are Core Codex, an expert AI coding agent. Be concise, correct and practical. ' +
                'When writing code, prefer complete runnable files. When you create files, start each ' +
                "code block with a comment like `// file: app.js` so the workspace can pick them up.",
            },
            ...history
              .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
              .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 4000) })),
            { role: 'user', content: prompt },
          ];

          const produced = await streamZai({ apiKey, model, messages }, write, isClosed, upstreamAbort.signal);
          if (!produced && !isClosed()) {
            await streamLocal({ prompt, model, mode }, write, isClosed);
          }
        } else {
          await streamLocal({ prompt, model, mode }, write, isClosed);
        }
      } catch (err) {
        console.error('[agent] error:', err);
        await write({ type: 'error', message: 'Generation failed unexpectedly. Please retry.' });
      } finally {
        clearInterval(heartbeat);
        try { res.end(); } catch { /* already closed */ }
      }
      return;
    }

    if (pathname === '/api/checkout' && req.method === 'POST') {
      if (!rateLimit('pay:' + clientIp(req), 12, 60_000)) {
        return send(res, 429, { ok: false, error: 'Too many attempts — wait a moment and try again.' });
      }
      return handleCheckout(req, res);
    }

    const orderMatch = pathname.match(/^\/api\/orders\/([A-Za-z0-9_-]+)$/);
    if (orderMatch && req.method === 'GET') {
      const orders = await loadOrders();
      const order = orders.find((o) => o.id === orderMatch[1]);
      if (!order) return send(res, 404, { ok: false, error: 'Order not found.' });
      return send(res, 200, { ok: true, order });
    }

    if (pathname.startsWith('/api/')) {
      return send(res, 404, { ok: false, error: `No such endpoint: ${req.method} ${pathname}` });
    }

    /* ------------------------------- static -------------------------------- */

    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res, pathname);
    }
    return send(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[server] unhandled:', err);
    if (!res.headersSent) {
      send(res, err.status || 500, { ok: false, error: err.message || 'Internal server error' });
    } else {
      try { res.end(); } catch { /* noop */ }
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ██████╗ ██████╗ ██████╗ ██╗     ███████╗██████╗ ██╗  ██╗███████╗');
  console.log('  ██╔══██╗██╔══██╗██╔══██╗██║     ██╔════╝██╔══██╗██║ ██╔╝██╔════╝');
  console.log('  ██║  ██║██████╔╝██████╔╝██║     █████╗  ██████╔╝█████╔╝ █████╗  ');
  console.log('  ██║  ██║██╔══██╗██╔══██╗██║     ██╔══╝  ██╔══██╗██╔═██╗ ██╔══╝   ');
  console.log('  ██████╔╝██████╔╝██████╔╝███████╗███████╗██║  ██║██║  ██║███████╗');
  console.log('  ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝');
  console.log('');
  console.log(`  Core Codex running  →  http://localhost:${PORT}`);
  console.log(`  z.ai upstream       →  ${ZAI_BASE}`);
  console.log(`  Static dir          →  ${PUBLIC_DIR}`);
  console.log('');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
