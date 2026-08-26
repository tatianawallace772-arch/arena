'use strict';
/**
 * arena — one web app, two backends.
 *
 *   stealth/ox-alpha  ->  OpenRouter
 *   big-pickle        ->  OpenCode Zen
 *
 * The browser only ever talks to this server (relative URLs), so keys never
 * leave the server process and the app works behind a reverse proxy / preview
 * host. Zero runtime dependencies: Node's http + fetch only.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');

const env = require('./lib/env');
const { chatCompletions, listModels, UpstreamError } = require('./lib/upstream');

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

function sendError(res, status, message, extra = {}) {
  sendJson(res, status, { error: { status, message, ...extra } });
}

async function readJsonBody(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const err = new Error(`request body exceeds ${maxBytes} bytes`);
      err.code = 'BODY_TOO_LARGE';
      throw err;
    }
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const err = new Error('request body is not valid JSON');
    err.code = 'BAD_JSON';
    throw err;
  }
}

/** Accept only plain-text OpenAI-style message entries. */
function normalizeMessages(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const allowed = new Set(['system', 'user', 'assistant']);
  const out = [];
  for (const m of input) {
    if (!m || typeof m !== 'object') return null;
    const role = typeof m.role === 'string' ? m.role.trim() : '';
    const content = typeof m.content === 'string' ? m.content : null;
    if (!allowed.has(role) || content === null || !content.trim()) return null;
    out.push({ role, content: content.slice(0, 24000) });
  }
  return out;
}

/** Forward upstream chunks verbatim; the browser consumes the same SSE shape. */
function pipeSSE(upstream, res, onDone) {
  const readable = Readable.fromWeb(upstream.body);
  readable.on('error', (err) => {
    try {
      res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
    } catch {
      /* socket already gone */
    }
    try {
      res.end();
    } catch {
      /* ignore */
    }
    onDone(err);
  });
  readable.on('end', () => {
    upstream.cancel();
    onDone(null);
  });
  readable.pipe(res);
}

async function handleChat(req, res) {
  const settings = env.resolveEnv();
  let payload;
  try {
    payload = await readJsonBody(req, Number(settings.MAX_BODY_BYTES) || 262144);
  } catch (err) {
    return sendError(res, err.code === 'BODY_TOO_LARGE' ? 413 : 400, err.message);
  }

  const mode = env.getMode(String(payload.mode || '').trim());
  if (!mode) {
    return sendError(res, 400, 'unknown mode', {
      validModes: env.MODES.map((m) => m.id)
    });
  }

  const messages = normalizeMessages(payload.messages);
  if (!messages) {
    return sendError(res, 400, 'messages must be a non-empty array of {role: system|user|assistant, content: string}');
  }
  const maxMessages = Number(settings.MAX_MESSAGES) || 64;
  if (messages.length > maxMessages) {
    return sendError(res, 400, `too many messages (max ${maxMessages})`);
  }

  const runtime = env.resolveMode(mode);
  if (!runtime.apiKey) {
    return sendError(res, 503, `${mode.name} is not configured: set ${mode.keyVars.join(' or ')} in .env`, {
      mode: mode.id,
      keyVar: mode.keyVars[0]
    });
  }

  const wantStream = payload.stream !== false;
  let upstream;
  try {
    upstream = await chatCompletions({
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
      model: typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : runtime.model,
      messages,
      stream: wantStream,
      timeoutMs: runtime.timeoutMs,
      extraHeaders: runtime.extraHeaders
    });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return sendError(res, err.status >= 400 && err.status < 600 ? err.status : 502, err.bodyText || err.message, {
        mode: mode.id
      });
    }
    return sendError(res, 500, err.message, { mode: mode.id });
  }

  if (!wantStream) {
    const text = await (async () => {
      const chunks = [];
      for await (const c of Readable.fromWeb(upstream.body)) chunks.push(c);
      upstream.cancel();
      return Buffer.concat(chunks).toString('utf8');
    })();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return sendError(res, 502, 'upstream returned a non-JSON response');
    }
    return sendJson(res, 200, { mode: mode.id, model: runtime.model, completion: json });
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
    'x-mode': mode.id,
    'x-model': runtime.model
  });
  res.flushHeaders();

  const onClose = () => upstream.cancel();
  res.on('close', onClose);
  pipeSSE(upstream, res, (err) => {
    if (err) process.stderr.write(`[arena] ${mode.id} stream error: ${err.message}\n`);
  });
}

async function handleHealth(req, res) {
  const modes = env.describeModes();
  const results = {};
  await Promise.all(
    modes.map(async (m) => {
      if (!m.keyConfigured) {
        results[m.id] = { ok: false, skipped: true, detail: `${m.keyVar} not set` };
        return;
      }
      const mode = env.getMode(m.id);
      const runtime = env.resolveMode(mode);
      results[m.id] = await listModels({
        baseUrl: runtime.baseUrl,
        apiKey: runtime.apiKey,
        timeoutMs: runtime.timeoutMs,
        extraHeaders: runtime.extraHeaders
      });
    })
  );
  sendJson(res, 200, { ok: true, time: new Date().toISOString(), providers: results });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(PUBLIC_DIR, rel);
  if (!target.startsWith(PUBLIC_DIR + path.sep) && target !== path.join(PUBLIC_DIR, 'index.html')) {
    return sendError(res, 403, 'forbidden');
  }
  fs.readFile(target, (err, buf) => {
    if (err) return sendError(res, 404, 'not found');
    res.writeHead(200, {
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'content-length': buf.length,
      'cache-control': 'no-cache'
    });
    res.end(buf);
  });
}

function createApp() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (req.method !== 'GET' && req.method !== 'POST') {
      return sendError(res, 405, 'method not allowed');
    }

    if (pathname === '/api/health' && req.method === 'GET') return handleHealth(req, res);

    if (pathname === '/api/config' && req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        app: 'arena',
        modes: env.describeModes()
      });
    }

    if (pathname === '/api/chat' && req.method === 'POST') return handleChat(req, res);

    if (pathname.startsWith('/api/')) return sendError(res, 404, 'not found');

    return serveStatic(req, res, pathname);
  });
}

if (require.main === module) {
  const loaded = env.loadEnvFiles(__dirname);
  const settings = env.resolveEnv();
  const port = Number(settings.PORT) || 3000;
  const host = settings.HOST || '0.0.0.0';
  const server = createApp();
  server.listen(port, host, () => {
    const modes = env.describeModes();
    process.stdout.write(`[arena] listening on http://${host}:${port}\n`);
    if (loaded.length) process.stdout.write(`[arena] loaded ${loaded.join(', ')}\n`);
    for (const m of modes) {
      process.stdout.write(
        `[arena]   ${m.name.padEnd(18)} ${m.keyConfigured ? `key ${m.keyMasked}` : `NO KEY (set ${m.keyVar})`}  ${m.baseUrl}  ${m.model}\n`
      );
    }
  });
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => server.close(() => process.exit(0)));
  }
}

module.exports = { createApp, handleChat, handleHealth, normalizeMessages, readJsonBody };
