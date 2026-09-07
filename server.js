/**
 * server.js — a ~60 line static file server so the app can be opened from a
 * URL (module imports need http://, not file://). Zero dependencies.
 *
 *   node server.js            → http://localhost:3000
 *   PORT=8080 node server.js
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

/** Only serve files inside the project directory. */
function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = join(ROOT, clean === '/' ? 'index.html' : clean);
  const rel = normalize(full);
  if (rel !== ROOT && !rel.startsWith(ROOT + sep)) return null;
  return rel;
}

const server = createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, app: 'nano-banana-studio' }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }
  const file = safePath(req.url || '/');
  if (!file) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  try {
    const info = await stat(file);
    if (info.isDirectory()) throw Object.assign(new Error('EISDIR'), { code: 'EISDIR' });
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      // Dev server: never cache, so edits show up on reload.
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (err) {
    // SPA-ish fallback: unknown extensionless paths land on index.html.
    if (!extname(file)) {
      try {
        const body = await readFile(join(ROOT, 'index.html'));
        res.writeHead(200, { 'content-type': MIME['.html'], 'content-length': body.length, 'cache-control': 'no-cache' });
        res.end(body);
        return;
      } catch {
        /* fall through */
      }
    }
    const code = err?.code === 'ENOENT' || err?.code === 'EISDIR' ? 404 : 500;
    res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(code === 404 ? 'Not found' : 'Server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Nano Banana Studio → http://localhost:${PORT}  (serving ${ROOT})`);
});
