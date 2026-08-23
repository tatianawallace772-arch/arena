#!/usr/bin/env node
/**
 * Kimi AI Test Playground — server
 *
 * Zero-dependency Node server that:
 *   1. Serves the static chat UI from ./public
 *   2. Proxies chat requests to the Moonshot (Kimi) API so the browser
 *      never needs CORS access or a hardcoded key.
 *
 * The API key is supplied by the browser on each request (stored in the
 * user's localStorage only) and forwarded verbatim to Moonshot.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MOONSHOT_BASE = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.ai/v1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/* ---------------------------------- helpers ---------------------------------- */

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Forward a request to the Moonshot API, streaming the response through. */
async function proxyToMoonshot(req, res, endpoint, bodyBuffer) {
  const auth = req.headers['authorization'];
  if (!auth) {
    sendJSON(res, 401, { error: { message: 'No API key provided. Open Settings and paste your Moonshot API key.' } });
    return;
  }

  let upstream;
  try {
    upstream = await fetch(MOONSHOT_BASE + endpoint, {
      method: bodyBuffer === null ? 'GET' : 'POST',
      headers: {
        Authorization: auth,
        ...(bodyBuffer !== null && { 'Content-Type': 'application/json' }),
      },
      body: bodyBuffer === null ? undefined : bodyBuffer,
    });
  } catch (err) {
    sendJSON(res, 502, { error: { message: `Could not reach the Moonshot API: ${err.message}` } });
    return;
  }

  const isSSE = (upstream.headers.get('content-type') || '').includes('text/event-stream');
  res.writeHead(upstream.status, {
    'Content-Type': isSSE ? 'text/event-stream; charset=utf-8' : upstream.headers.get('content-type') || 'application/json',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  });

  if (!upstream.body) {
    res.end();
    return;
  }
  const reader = upstream.body.getReader();
  const push = () =>
    reader.read().then(({ done, value }) => {
      if (done) {
        res.end();
        return;
      }
      res.write(value);
      return push();
    });
  push().catch((err) => {
    console.error('[proxy] stream error:', err.message);
    try { res.end(); } catch (_) { /* already closed */ }
  });
}

/* ----------------------------------- server ----------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // --- API routes (all proxied to Moonshot) ---
  if (pathname === '/api/models' && req.method === 'GET') {
    return proxyToMoonshot(req, res, '/models', null);
  }
  if (pathname === '/api/chat' && req.method === 'POST') {
    const body = await readBody(req).catch(() => null);
    if (!body) return sendJSON(res, 400, { error: { message: 'Invalid or oversized request body.' } });
    return proxyToMoonshot(req, res, '/chat/completions', body);
  }
  if (pathname.startsWith('/api/')) {
    return sendJSON(res, 404, { error: { message: `Unknown API route: ${pathname}` } });
  }

  // --- Static files ---
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const abs = path.join(PUBLIC_DIR, filePath);
  if (!abs.startsWith(PUBLIC_DIR)) return sendJSON(res, 403, { error: { message: 'Forbidden' } });

  fs.readFile(abs, (err, data) => {
    if (err) return sendJSON(res, 404, { error: { message: 'Not found' } });
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Kimi AI Test Playground running at http://0.0.0.0:${PORT}`);
  console.log(`Proxying /api/* -> ${MOONSHOT_BASE}/*`);
});
