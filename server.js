#!/usr/bin/env node
/**
 * Fish Audio Playground — local server (zero dependencies, Node 18+)
 *
 *   node server.js            → http://localhost:8080
 *   PORT=3000 node server.js  → custom port
 *
 * What it does
 *   1. Serves the static app (index.html, style.css, app.js, config.js).
 *   2. Proxies  /api/*  →  https://api.fish.audio/*  including the
 *      Authorization header, so the browser never hits a CORS wall.
 *
 * Why? api.fish.audio does not return Access-Control-Allow-Origin, so a
 * page opened from any origin (localhost, GitHub Pages, this preview…)
 * cannot call it directly. Proxying through the same origin fixes that
 * and keeps the API key out of third-party relay services.
 *
 * NOTE: the proxy accepts cross-origin requests too (Access-Control-
 * Allow-Origin: *), so keep it bound to localhost unless you know what
 * you are doing.
 */

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const UPSTREAM = 'https://api.fish.audio';

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
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

/* ------------------------------------------------------- static */
function serveStatic(req, res, pathname) {
  let file = decodeURIComponent(pathname);
  if (file === '/') file = '/index.html';

  // Reject hidden files/directories (.git, .env, …) — the URL constructor
  // already collapses ../ segments, but /.git/config style paths still
  // point inside the repo and must never be served.
  const segments = file.split('/').filter(Boolean);
  if (segments.some((s) => s.startsWith('.'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  const full = path.normalize(path.join(ROOT, file));
  if (!full.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(full).pipe(res);
  });
}

/* -------------------------------------------------------- proxy */
// Headers we forward to api.fish.audio (never cookie or host headers).
const FORWARD_HEADERS = ['authorization', 'content-type', 'model', 'accept'];

function proxy(req, res) {
  const target = new URL(UPSTREAM + req.url.replace(/^\/api/, ''));
  const headers = {};
  for (const name of FORWARD_HEADERS) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }
  headers['host'] = target.host;

  const upstreamReq = https.request(
    {
      hostname: target.hostname,
      port: 443,
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const outHeaders = {
        'Content-Type': upstreamRes.headers['content-type'] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
        'Cache-Control': 'no-store',
      };
      if (upstreamRes.headers['content-length']) {
        outHeaders['Content-Length'] = upstreamRes.headers['content-length'];
      }
      res.writeHead(upstreamRes.statusCode, outHeaders);
      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on('error', (err) => {
    // Deliberately text/plain: the frontend treats JSON responses as
    // "fish audio answered" and anything else as "transport broken".
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end('Upstream unreachable: ' + err.message);
  });

  req.pipe(upstreamReq);
}

/* -------------------------------------------------------- server */
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname;

  // CORS preflight for the proxy endpoints (other-origin pages).
  if (pathname.startsWith('/api/') && req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, model, Accept',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  if (pathname.startsWith('/api/')) return proxy(req, res);

  // /config.js: prefer the gitignored static file; if it is absent
  // (e.g. it was not persisted), fall back to the FISH_API_KEY env var
  // so the preview still gets a pre-filled key.
  if (pathname === '/config.js' && !fs.existsSync(path.join(ROOT, 'config.js'))) {
    const key = (process.env.FISH_API_KEY || '').trim();
    const body = key
      ? `window.FISH_CONFIG = { apiKey: ${JSON.stringify(key)} };`
      : 'window.FISH_CONFIG = { apiKey: "" };';
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(body);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method not allowed');
  }
  return serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  🐟  Fish Audio Playground');
  console.log(`  →  http://localhost:${PORT}`);
  console.log('');
  console.log('  Static app served from :', ROOT);
  console.log('  /api/* proxied to      :', UPSTREAM);
  console.log('');
  console.log('  Tip: create config.js (see config.example.js) to');
  console.log('  pre-fill your API key, or paste it in the UI.');
  console.log('');
});
