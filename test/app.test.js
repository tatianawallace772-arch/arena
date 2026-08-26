'use strict';
/**
 * Integration tests: a fake OpenAI-compatible upstream stands in for OpenRouter
 * and OpenCode Zen, and the real server from server.js is driven over HTTP.
 *
 *   node --test test/
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');

const FAKE_OPENROUTER_KEY = 'sk-or-v1-TESTKEY1234567890abcdefghijklmnop';
const FAKE_OPENCODE_KEY = 'sk-TESTKEY9876543210zyxwvutsrqponmlkjihg';

/** Minimal OpenAI-compatible upstream that records what it received. */
async function startFakeUpstream({ expectKey, modeLabel }) {
  const seen = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const record = {
        modeLabel,
        url: req.url,
        method: req.method,
        auth: req.headers.authorization || null,
        referer: req.headers['http-referer'] || null,
        title: req.headers['x-title'] || null,
        body: raw ? JSON.parse(raw) : null
      };
      seen.push(record);

      // Bad key -> 401 with an OpenAI-ish error envelope.
      if (req.headers.authorization !== `Bearer ${expectKey}`) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid API key', code: 'invalid_api_key' } }));
        return;
      }

      if (req.url === '/models') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-c' }] }));
        return;
      }

      if (record.body && record.body.stream) {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const pieces = ['Hello', ' from ', modeLabel];
        for (const p of pieces) {
          res.write(
            `data: ${JSON.stringify({
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { content: p } }]
            })}\n\n`
          );
        }
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          object: 'chat.completion',
          model: record.body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: `non-stream reply from ${modeLabel}` } }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        })
      );
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    server,
    seen,
    baseUrl: `http://127.0.0.1:${server.address().port}`
  };
}

/** Boot the real app on an ephemeral port with the given env. */
async function startApp(extraEnv) {
  const prev = { ...process.env };
  Object.assign(process.env, extraEnv);
  // server.js reads process.env at request time, so requiring after assignment is fine.
  const { createApp } = require('../server.js');
  const app = createApp();
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  return {
    app,
    base,
    restore: () => {
      process.env = prev;
    }
  };
}

async function withStack(fn) {
  const openrouter = await startFakeUpstream({ expectKey: FAKE_OPENROUTER_KEY, modeLabel: 'openrouter' });
  const opencode = await startFakeUpstream({ expectKey: FAKE_OPENCODE_KEY, modeLabel: 'opencode-zen' });
  const app = await startApp({
    PORT: '0',
    OPENROUTER_API_KEY: FAKE_OPENROUTER_KEY,
    OPENROUTER_BASE_URL: openrouter.baseUrl,
    OPENROUTER_MODEL: 'test/stealth-model',
    OPENROUTER_SITE_URL: 'https://example.test',
    OPENROUTER_APP_TITLE: 'arena test',
    OPENCODE_API_KEY: FAKE_OPENCODE_KEY,
    OPENCODE_BASE_URL: opencode.baseUrl,
    OPENCODE_MODEL: 'test/pickle-model'
  });
  try {
    await fn({ app, openrouter, opencode });
  } finally {
    app.app.close();
    openrouter.server.close();
    opencode.server.close();
    app.restore();
  }
}

function messages(text = 'ping') {
  return [{ role: 'user', content: text }];
}

test('GET /api/config describes both modes and masks keys', async () => {
  await withStack(async ({ app }) => {
    const res = await fetch(`${app.base}/api/config`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.modes.length, 2);

    const [stealth, pickle] = data.modes;
    assert.equal(stealth.name, 'stealth/ox-alpha');
    assert.equal(stealth.keyVar, 'OPENROUTER_API_KEY');
    assert.equal(stealth.keyConfigured, true);
    assert.equal(pickle.name, 'big-pickle');
    assert.equal(pickle.keyVar, 'OPENCODE_API_KEY');
    assert.equal(pickle.keyConfigured, true);

    // The masked value must not be the key, and the raw keys must be absent.
    assert.notEqual(stealth.keyMasked, FAKE_OPENROUTER_KEY);
    assert.notEqual(pickle.keyMasked, FAKE_OPENCODE_KEY);
    const wire = JSON.stringify(data);
    assert.ok(!wire.includes(FAKE_OPENROUTER_KEY), 'config leaked the OpenRouter key');
    assert.ok(!wire.includes(FAKE_OPENCODE_KEY), 'config leaked the OpenCode key');
    // A mask of the test key keeps only a 10-char head + 4-char tail.
    assert.equal(stealth.keyMasked, `${FAKE_OPENROUTER_KEY.slice(0, 10)}...${FAKE_OPENROUTER_KEY.slice(-4)}`);
  });
});

test('stealth/ox-alpha streams through OpenRouter with the right key and headers', async () => {
  await withStack(async ({ app, openrouter }) => {
    const res = await fetch(`${app.base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'stealth', stream: true, messages: messages('hello stealth') })
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    assert.equal(res.headers.get('x-mode'), 'stealth');

    const text = await res.text();
    const deltas = [...text.matchAll(/data: (\{.*\})/g)]
      .map((m) => JSON.parse(m[1]).choices[0].delta.content)
      .join('');
    assert.equal(deltas, 'Hello from openrouter');
    assert.match(text, /data: \[DONE\]/);

    const call = openrouter.seen.at(-1);
    assert.equal(call.url, '/chat/completions');
    assert.equal(call.auth, `Bearer ${FAKE_OPENROUTER_KEY}`);
    assert.equal(call.body.model, 'test/stealth-model');
    assert.equal(call.body.stream, true);
    assert.deepEqual(call.body.messages, messages('hello stealth'));
    assert.equal(call.referer, 'https://example.test');
    assert.equal(call.title, 'arena test');
  });
});

test('big-pickle streams through OpenCode Zen with the right key', async () => {
  await withStack(async ({ app, opencode }) => {
    const res = await fetch(`${app.base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'pickle', stream: true, messages: messages('hello pickle') })
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-model'), 'test/pickle-model');

    const text = await res.text();
    const deltas = [...text.matchAll(/data: (\{.*\})/g)]
      .map((m) => JSON.parse(m[1]).choices[0].delta.content)
      .join('');
    assert.equal(deltas, 'Hello from opencode-zen');

    const call = opencode.seen.at(-1);
    assert.equal(call.auth, `Bearer ${FAKE_OPENCODE_KEY}`);
    assert.equal(call.body.model, 'test/pickle-model');
  });
});

test('non-stream mode returns the completion as JSON', async () => {
  await withStack(async ({ app }) => {
    const res = await fetch(`${app.base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'pickle', stream: false, messages: messages('no stream') })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.mode, 'pickle');
    assert.equal(data.model, 'test/pickle-model');
    assert.equal(data.completion.choices[0].message.content, 'non-stream reply from opencode-zen');
    assert.equal(data.completion.usage.total_tokens, 3);
  });
});

test('per-request model override is forwarded', async () => {
  await withStack(async ({ app, openrouter }) => {
    const res = await fetch(`${app.base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'stealth',
        stream: false,
        model: 'anthropic/claude-sonnet-4.5',
        messages: messages('override me')
      })
    });
    assert.equal(res.status, 200);
    assert.equal(openrouter.seen.at(-1).body.model, 'anthropic/claude-sonnet-4.5');
  });
});

test('upstream 401 is passed through with its message and no key material', async () => {
  await withStack(async ({ app }) => {
    // Point one mode at an upstream that expects a different key.
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-wrong';
    const res = await fetch(`${app.base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'stealth', stream: true, messages: messages('bad key') })
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error.message, /Invalid API key/);
    assert.ok(!JSON.stringify(data).includes('sk-or-v1-wrong'), 'error body leaked the key');
  });
});

test('missing key returns 503 naming the env var, and does not hit upstream', async () => {
  await withStack(async ({ app, opencode }) => {
    process.env.OPENCODE_API_KEY = '';
    const before = opencode.seen.length;
    const res = await fetch(`${app.base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'pickle', messages: messages('no key') })
    });
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.match(data.error.message, /OPENCODE_API_KEY/);
    assert.equal(opencode.seen.length, before, 'upstream was called without a key');

    const cfg = await (await fetch(`${app.base}/api/config`)).json();
    assert.equal(cfg.modes.find((m) => m.id === 'pickle').keyConfigured, false);
  });
});

test('input validation: bad mode, empty messages, junk body, oversized body', async () => {
  await withStack(async ({ app }) => {
    const post = (body, headers = { 'content-type': 'application/json' }) =>
      fetch(`${app.base}/api/chat`, { method: 'POST', headers, body });

    const badMode = await post(JSON.stringify({ mode: 'nope', messages: messages() }));
    assert.equal(badMode.status, 400);
    assert.deepEqual((await badMode.json()).error.validModes, ['stealth', 'pickle']);

    const empty = await post(JSON.stringify({ mode: 'stealth', messages: [] }));
    assert.equal(empty.status, 400);

    const badRole = await post(JSON.stringify({ mode: 'stealth', messages: [{ role: 'root', content: 'x' }] }));
    assert.equal(badRole.status, 400);

    const junk = await post('{not json');
    assert.equal(junk.status, 400);

    const huge = await post(JSON.stringify({ mode: 'stealth', messages: [{ role: 'user', content: 'x'.repeat(300 * 1024) }] }));
    assert.equal(huge.status, 413);
  });
});

test('GET /api/health reports per-provider upstream status', async () => {
  await withStack(async ({ app }) => {
    const ok = await (await fetch(`${app.base}/api/health`)).json();
    assert.equal(ok.providers.stealth.ok, true);
    assert.equal(ok.providers.stealth.models, 3);
    assert.equal(ok.providers.pickle.ok, true);
    assert.equal(ok.providers.pickle.models, 3);

    // Now break one upstream.
    process.env.OPENCODE_BASE_URL = 'http://127.0.0.1:1';
    const broken = await (await fetch(`${app.base}/api/health`)).json();
    assert.equal(broken.providers.stealth.ok, true);
    assert.equal(broken.providers.pickle.ok, false);
  });
});

test('static front-end is served and path traversal is refused', async () => {
  await withStack(async ({ app }) => {
    const index = await fetch(`${app.base}/`);
    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type'), /text\/html/);
    assert.match(await index.text(), /stealth\/ox-alpha/);

    const css = await fetch(`${app.base}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);

    const traversal = await fetch(`${app.base}/../server.js`);
    assert.ok(traversal.status === 403 || traversal.status === 404, `expected refusal, got ${traversal.status}`);
    const body = await traversal.text();
    assert.ok(!body.includes('chatCompletions'), 'server source was served');

    const apiMiss = await fetch(`${app.base}/api/nope`);
    assert.equal(apiMiss.status, 404);
  });
});

test('unit: normalizeMessages and maskKey behaviour', async () => {
  const { normalizeMessages } = require('../server.js');
  const { maskKey, parseDotenv } = require('../lib/env.js');

  assert.equal(normalizeMessages(null), null);
  assert.equal(normalizeMessages([]), null);
  assert.equal(normalizeMessages([{ role: 'user', content: '  ' }]), null);
  assert.equal(normalizeMessages([{ role: 'user' }]), null);
  assert.deepEqual(normalizeMessages([{ role: 'system', content: 'hi' }]), [{ role: 'system', content: 'hi' }]);

  assert.equal(maskKey(''), '');
  assert.equal(maskKey('short'), 'short...');
  const k = 'sk-or-v1-abcdefghijklmnopqrstuvwxyz';
  assert.equal(maskKey(k), 'sk-or-v1-a...wxyz');
  assert.ok(!maskKey(k).includes(k));

  assert.deepEqual(parseDotenv('A=1\n# comment\nB="two words"\n\nC=\'three\'\n'), { A: '1', B: 'two words', C: 'three' });
});
