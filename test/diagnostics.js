'use strict';
/*
 * Verifies the connectivity diagnostics and the improved error messages.
 *
 * The sandbox this test runs in cannot reach api.inceptionlabs.ai, which makes
 * it a perfect fixture for "unreachable" — and registry.npmjs.org is reachable,
 * so we can prove the checker reports success too.
 */

const assert = require('assert');
const http = require('http');
const { diagnose } = require('../server/diagnostics');

let pass = 0;
let fail = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, err });
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

(async () => {
  console.log('\nConnectivity diagnostics\n');

  await test('reports each connection stage in order', async () => {
    const r = await diagnose({ baseUrl: 'https://api.inceptionlabs.ai/v1', apiKey: 'sk_test', timeoutMs: 8000 });
    assert.ok(Array.isArray(r.checks));
    assert.deepEqual(r.checks.map((c) => c.stage).slice(0, 4), ['dns', 'tcp', 'tls', 'http']);
    assert.ok(typeof r.headline === 'string' && r.headline.length > 0);
  });

  await test('a blocked host is pinned to the TLS stage, not "fetch failed"', async () => {
    const r = await diagnose({ baseUrl: 'https://api.inceptionlabs.ai/v1', apiKey: 'sk_test', timeoutMs: 8000 });
    assert.equal(r.ok, false);
    // DNS resolves and TCP opens in this sandbox; TLS is what gets reset.
    assert.equal(r.checks[0].ok, true, 'dns should resolve');
    assert.equal(r.checks[1].ok, true, 'tcp should connect');
    assert.equal(r.checks[2].ok, false, 'tls should fail');
    assert.equal(r.stage, 'tls');
    assert.ok(!/^fetch failed$/i.test(r.message || ''), 'must not be the bare fetch error');
    assert.ok(/reset|handshake|firewall|proxy|allowlist/i.test(r.headline + r.action));
  });

  await test('unreachable results carry an actionable next step', async () => {
    const r = await diagnose({ baseUrl: 'https://api.inceptionlabs.ai/v1', apiKey: 'sk_test', timeoutMs: 8000 });
    assert.ok(r.action && r.action.length > 40, 'action should explain what to do');
    assert.equal(r.error, 'ECONNRESET');
    assert.ok(r.summary.includes(r.headline));
  });

  await test('a reachable host passes DNS/TCP/TLS and reaches HTTP', async () => {
    const r = await diagnose({ baseUrl: 'https://registry.npmjs.org', apiKey: '', timeoutMs: 8000 });
    const stageOk = (s) => r.checks.find((c) => c.stage === s)?.ok;
    assert.equal(stageOk('dns'), true);
    assert.equal(stageOk('tcp'), true);
    assert.equal(stageOk('tls'), true, 'must complete a real TLS handshake when allowed');
    assert.equal(stageOk('http'), true);
  });

  await test('a bad hostname is reported as a DNS failure', async () => {
    const r = await diagnose({
      baseUrl: 'https://this-host-does-not-exist-arena-test.invalid/v1',
      apiKey: 'sk_test',
      timeoutMs: 5000,
    });
    assert.equal(r.ok, false);
    assert.equal(r.stage, 'dns');
    assert.ok(/resolve|dns/i.test(r.headline));
  });

  await test('a malformed base url is rejected clearly', async () => {
    const r = await diagnose({ baseUrl: 'not a url', apiKey: 'sk_test', timeoutMs: 3000 });
    assert.equal(r.ok, false);
    assert.ok(/valid URL|resolve/i.test(r.headline || ''));
  });

  await test('a closed local port is reported as a TCP failure', async () => {
    const r = await diagnose({ baseUrl: 'http://127.0.0.1:9/v1', apiKey: 'sk_test', timeoutMs: 5000 });
    assert.equal(r.ok, false);
    assert.equal(r.stage, 'tcp');
    assert.ok(/refused|timed out|route/i.test(r.headline));
  });

  await test('the API key is rejected distinctly from a network failure', async () => {
    // A local server that speaks HTTP but returns 401.
    const server = http.createServer((req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } }));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    try {
      const r = await diagnose({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'sk_bad', timeoutMs: 5000 });
      assert.equal(r.ok, false);
      assert.equal(r.stage, 'auth');
      assert.equal(r.status, 401);
      assert.ok(/key was rejected/i.test(r.headline));
      assert.ok(/platform\.inceptionlabs\.ai/.test(r.action));
    } finally {
      server.close();
    }
  });

  await test('a working API with models reports full success', async () => {
    const server = http.createServer((req, res) => {
      assert.ok(req.headers.authorization, 'should send the bearer token');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'mercury-3' }, { id: 'mercury-2.5' }] }));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    try {
      const r = await diagnose({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: 'sk_good', timeoutMs: 5000 });
      assert.equal(r.ok, true);
      assert.equal(r.stage, 'ok');
      assert.deepEqual(r.models, ['mercury-3', 'mercury-2.5']);
      assert.ok(r.summary.includes('reachable'));
    } finally {
      server.close();
    }
  });

  await test('network errors from the Inception client name the real cause', async () => {
    const inception = require('../server/inception');
    try {
      await inception.listModels();
      assert.fail('expected the call to fail in this sandbox');
    } catch (err) {
      assert.equal(err.code, 'NETWORK');
      assert.ok(!/fetch failed$/i.test(err.message), `message was unhelpful: ${err.message}`);
      assert.ok(/api\.inceptionlabs\.ai/.test(err.message), 'should name the host');
      assert.ok(err.hint && /doctor/i.test(err.hint), 'should point at npm run doctor');
      assert.ok(err.detail, 'should expose the underlying error code');
    }
  });

  await test('a request through a working mock API succeeds end to end', async () => {
    // Proves the networking code itself is fine: same client, reachable host.
    const server = http.createServer((req, res) => {
      if (req.url.includes('/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ data: [{ id: 'mercury-3' }] }));
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'hello' } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ choices: [], usage: { total_tokens: 7 } })}\n\n`);
      res.end('data: [DONE]\n\n');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    // Point a fresh client at the mock by loading config with a patched base url.
    const path = require('path');
    for (const key of Object.keys(require.cache)) {
      if (key.includes(`${path.sep}server${path.sep}`)) delete require.cache[key];
    }
    process.env.INCEPTION_BASE_URL = `http://127.0.0.1:${port}/v1`;
    const inception = require('../server/inception');
    try {
      const models = await inception.listModels();
      assert.equal(models.length, 1);

      const text = [];
      let usage = null;
      for await (const evt of inception.chatStream({
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        if (evt.type === 'text') text.push(evt.text);
        if (evt.type === 'usage') usage = evt.usage;
      }
      assert.equal(text.join(''), 'hello');
      assert.equal(usage.total_tokens, 7);
    } finally {
      server.close();
      delete process.env.INCEPTION_BASE_URL;
    }
  });

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  if (fail) {
    for (const f of failures) console.log(`  FAILED: ${f.name}\n  ${f.err.stack}\n`);
    process.exit(1);
  }
})();
