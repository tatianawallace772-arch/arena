import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ProviderError, buildImageUrl, classifyFailure, generateOne, mockSvg, requestParamsFor } from '../js/pollinations.js';
import { PROVIDER } from '../js/config.js';
import { STYLE_PRESETS } from '../js/prompts.js';

const base = {
  finalPrompt: 'a banana wearing sunglasses',
  model: 'nanobanana',
  width: 1024,
  height: 768,
  seed: 42,
  enhance: true,
  nologo: true,
  safe: false,
  private: true,
  refs: [],
  token: '',
};

test('buildImageUrl encodes the prompt into the path and keeps it reversible', () => {
  const raw = buildImageUrl(base);
  const url = new URL(raw);
  const pathPrompt = decodeURIComponent(url.pathname.split('/prompt/')[1]);
  assert.equal(pathPrompt, base.finalPrompt, 'the prompt must survive percent-encoding');
  assert.ok(!raw.includes('\n'), 'no raw whitespace in the URL');
});

test('buildImageUrl sends the documented query parameters', () => {
  const raw = buildImageUrl(base);
  assert.ok(raw.startsWith('https://image.pollinations.ai/prompt/a%20banana%20wearing%20sunglasses?'), raw);
  const url = new URL(raw);
  assert.equal(url.searchParams.get('width'), '1024');
  assert.equal(url.searchParams.get('height'), '768');
  assert.equal(url.searchParams.get('seed'), '42');
  assert.equal(url.searchParams.get('model'), 'nanobanana');
  assert.equal(url.searchParams.get('nologo'), 'true');
  assert.equal(url.searchParams.get('enhance'), 'true');
  assert.equal(url.searchParams.get('private'), 'true');
  assert.equal(url.searchParams.get('referrer'), PROVIDER.referrer);
  assert.equal(url.searchParams.has('safe'), false, 'off switches are omitted entirely');
  assert.equal(url.searchParams.has('token'), false, 'never send an empty token');
});

test('buildImageUrl repeats reference URLs and forwards an optional token', () => {
  const raw = buildImageUrl({ ...base, refs: ['https://a.example/1.png', 'https://b.example/2.jpg'], token: 'sk_demo' });
  const url = new URL(raw);
  assert.deepEqual(url.searchParams.getAll('image'), ['https://a.example/1.png', 'https://b.example/2.jpg']);
  assert.equal(url.searchParams.get('token'), 'sk_demo');
});

test('buildImageUrl refuses an empty prompt instead of burning a request', () => {
  assert.throws(() => buildImageUrl({ ...base, finalPrompt: '' }), (err) => err.code === 'NO_PROMPT' && err.fatal);
});

test('classifyFailure maps provider responses onto actionable codes', () => {
  const headers = new Map([['retry-after', '3']]);
  headers.get = function get(k) {
    return this instanceof Map ? Map.prototype.get.call(this, k.toLowerCase()) : undefined;
  };

  const rate = classifyFailure({ status: 429, body: '{"error":"too many requests"}', headers });
  assert.equal(rate.code, 'RATE_LIMITED');
  assert.equal(rate.retryAfterMs, 3000, 'retry-after is honoured');
  assert.equal(rate.modelRejected, false);

  assert.equal(classifyFailure({ status: 403, body: 'an api key is required' }).code, 'NEEDS_KEY');
  assert.equal(classifyFailure({ status: 403, body: 'an api key is required' }).modelRejected, true);
  assert.equal(classifyFailure({ status: 402, body: 'insufficient credits' }).code, 'NEEDS_CREDITS');
  assert.equal(classifyFailure({ status: 400, body: 'Invalid option: expected one of "flux"' }).code, 'BAD_REQUEST');
  assert.equal(classifyFailure({ status: 503, body: 'upstream busy' }).code, 'UPSTREAM');
  assert.equal(classifyFailure({ status: 404, body: 'not found' }).code, 'PROVIDER_ERROR');
  // A body that mentions the rate limit but arrives as 200 is still a rate limit.
  assert.equal(classifyFailure({ status: 200, body: 'rate limit exceeded, slow down' }).code, 'RATE_LIMITED');
  assert.ok(rate instanceof ProviderError);
});

test('requestParamsFor resolves prompt + size from app state in one call', () => {
  const state = { prompt: 'a fox', stylePreset: 'anime', avoid: '', aspect: '16:9', resolution: '1K', model: 'flux', enhance: false, nologo: false, safe: true, private: false, refs: [], token: '', width: 1024, height: 1024 };
  const params = requestParamsFor(state, STYLE_PRESETS, { seed: 7 });
  const anime = STYLE_PRESETS.find((p) => p.id === 'anime');
  assert.ok(params.finalPrompt.includes(anime.append));
  assert.equal(params.width, 1280);
  assert.equal(params.height, 720);
  assert.equal(params.seed, 7);
  assert.equal(params.enhance, false);
  assert.equal(params.nologo, false);
  assert.equal(params.safe, true);
  assert.equal(params.private, false);
});

test('mockSvg is deterministic and self-describing', () => {
  const a = mockSvg({ finalPrompt: 'a test prompt', width: 800, height: 600, seed: 5, model: 'flux' });
  const b = mockSvg({ finalPrompt: 'a test prompt', width: 800, height: 600, seed: 5, model: 'flux' });
  const c = mockSvg({ finalPrompt: 'a test prompt', width: 800, height: 600, seed: 6, model: 'flux' });
  assert.equal(a, b, 'same prompt + seed → same bytes');
  assert.notEqual(a, c, 'changing the seed changes the render');
  assert.match(a, /^data:image\/svg\+xml;charset=utf-8,/);
  const decoded = decodeURIComponent(a.split(',')[1]);
  assert.match(decoded, /width="800"/);
  assert.match(decoded, /height="600"/);
  assert.match(decoded, /a test prompt/);
  assert.match(decoded, /seed 5/);
});

test('generateOne in mock mode never touches the network', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls += 1;
    throw new Error('network must not be used in mock mode');
  };
  try {
    const out = await generateOne(
      { ...base, finalPrompt: 'offline test' },
      { mock: true },
    );
    assert.equal(calls, 0);
    assert.equal(out.transport, 'mock');
    assert.match(out.src, /^data:image\/svg/);
    assert.equal(out.attempt, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('generateOne retries transient errors and gives up fast on rejections', async () => {
  const realFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) return { ok: false, status: 503, headers: new Headers(), text: async () => 'upstream busy', blob: async () => null };
    return { ok: true, status: 200, headers: new Headers(), blob: async () => new Blob(['pretend bytes'], { type: 'image/png' }) };
  };
  try {
    // The second attempt succeeds, so the promise resolves without a retry storm.
    const res = await generateOne({ ...base, finalPrompt: 'retry me' }, { attempts: 2 });
    assert.equal(attempts, 2, 'one retry happened');
    assert.equal(res.transport, 'fetch');
  } finally {
    globalThis.fetch = realFetch;
  }

  attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return { ok: false, status: 403, headers: new Headers(), text: async () => 'an api key is required', blob: async () => null };
  };
  try {
    await assert.rejects(generateOne({ ...base, finalPrompt: 'gated' }, { attempts: 3 }), (err) => err.code === 'NEEDS_KEY');
    assert.equal(attempts, 1, 'a key-gated model is not retried pointlessly');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('generateOne falls back to an <img> load when fetch is CORS-blocked', async () => {
  const realFetch = globalThis.fetch;
  const realImage = globalThis.Image;
  let fetchCalled = 0;
  class FakeImage {
    set src(_v) {
      setTimeout(() => this.onload && this.onload(), 0);
    }
    get src() {
      return 'blob:mock';
    }
  }
  globalThis.fetch = async () => {
    fetchCalled += 1;
    throw new TypeError('Failed to fetch');
  };
  globalThis.Image = FakeImage;
  try {
    const out = await generateOne({ ...base, finalPrompt: 'cors blocked' }, {});
    assert.equal(fetchCalled, 1);
    assert.equal(out.transport, 'img', 'display-only fallback used');
  } finally {
    globalThis.fetch = realFetch;
    globalThis.Image = realImage;
  }
});

test('a cancelled generation rejects with ABORTED', async () => {
  const controller = new AbortController();
  const p = generateOne({ ...base, finalPrompt: 'cancel me' }, { mock: true, signal: controller.signal });
  controller.abort();
  await assert.rejects(p, (err) => err.code === 'ABORTED');
});
