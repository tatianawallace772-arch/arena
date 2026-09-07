import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const magicHourBase = 'https://api.magichour.ai/v1';

loadDotEnv();
const port = Number(process.env.PORT || 3000);

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!existsSync(envPath)) return;

  try {
    const contents = requireFile(envPath);
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // An absent or unreadable local env file should not prevent the UI from loading.
  }
}

function requireFile(filePath) {
  // This tiny reader keeps the app dependency-free while still supporting a local .env file.
  return readFileSync(filePath, 'utf8');
}

class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function magicRequest(endpoint, options = {}) {
  const token = process.env.MAGIC_HOUR_API_KEY;
  if (!token) {
    throw new ApiError(503, 'Magic Hour is not connected yet. Add MAGIC_HOUR_API_KEY to .env.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 35_000);
  try {
    const response = await fetch(`${magicHourBase}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text || 'Magic Hour returned an empty response.' };
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `Magic Hour returned ${response.status}.`;
      throw new ApiError(response.status, message, data);
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError(504, 'Magic Hour took too long to respond. Try again in a moment.');
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'Could not reach Magic Hour right now.');
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadAsset(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) {
    throw new ApiError(400, 'Please upload a PNG, JPG, or WEBP image.');
  }

  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const extension = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 15 * 1024 * 1024) {
    throw new ApiError(413, 'Images must be smaller than 15 MB.');
  }

  const upload = await magicRequest('/files/upload-urls', {
    method: 'POST',
    body: { items: [{ type: 'image', extension }] },
  });
  const target = upload?.items?.[0];
  if (!target?.upload_url || !target?.file_path) {
    throw new ApiError(502, 'Magic Hour did not return an upload destination.');
  }

  const response = await fetch(target.upload_url, {
    method: 'PUT',
    headers: { 'content-type': mime },
    body: buffer,
  });
  if (!response.ok) {
    throw new ApiError(502, 'The reference image could not be uploaded to Magic Hour.');
  }
  return target.file_path;
}

function cleanPrompt(value) {
  const prompt = typeof value === 'string' ? value.trim() : '';
  if (!prompt) throw new ApiError(400, 'Add a prompt before generating.');
  if (prompt.length > 2_000) throw new ApiError(400, 'Prompts are limited to 2,000 characters.');
  return prompt;
}

function cleanName(value, fallback) {
  const name = typeof value === 'string' ? value.trim().slice(0, 80) : '';
  return name || fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

async function createGeneration(payload) {
  const kind = payload?.kind === 'video' ? 'video' : 'image';
  const prompt = cleanPrompt(payload?.prompt);
  const aspectRatio = ['1:1', '16:9', '9:16', '4:3', '3:4'].includes(payload?.aspectRatio)
    ? payload.aspectRatio
    : '1:1';

  if (kind === 'image') {
    const body = {
      name: cleanName(payload?.name, 'Magic Hour image'),
      image_count: 1,
      model: 'default',
      aspect_ratio: aspectRatio,
      resolution: ['1k', '2k', 'auto'].includes(payload?.resolution) ? payload.resolution : '1k',
      style: { prompt },
    };
    const result = await magicRequest('/ai-image-generator', { method: 'POST', body });
    return { ...result, kind, prompt, estimatedCredits: result?.credits_charged || 5 };
  }

  const source = payload?.source === 'image' ? 'image' : 'text';
  const duration = clampNumber(payload?.duration, 3, 10, 5);
  const body = {
    name: cleanName(payload?.name, source === 'image' ? 'Magic Hour animation' : 'Magic Hour video'),
    end_seconds: duration,
    aspect_ratio: aspectRatio,
    resolution: ['720p', '1080p', '4k'].includes(payload?.resolution) ? payload.resolution : '720p',
    model: 'kling-3.0',
    audio: Boolean(payload?.audio),
    style: { prompt },
  };

  let endpoint = '/text-to-video';
  if (source === 'image') {
    const imageFilePath = await uploadAsset(payload?.imageData);
    body.assets = { image_file_path: imageFilePath };
    endpoint = '/image-to-video';
  }

  const result = await magicRequest(endpoint, { method: 'POST', body });
  return { ...result, kind, source, prompt, estimatedCredits: result?.credits_charged || 450 };
}

async function parseJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 24 * 1024 * 1024) throw new ApiError(413, 'This request is too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.');
  }
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
  });
  response.end(body);
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  }[extension] || 'application/octet-stream';
}

async function serveStatic(request, response, pathname) {
  let requested = pathname === '/' ? '/index.html' : pathname;
  try {
    requested = decodeURIComponent(requested);
  } catch {
    sendJson(response, 400, { error: 'Invalid path.' });
    return;
  }
  const filePath = path.resolve(publicDir, `.${requested}`);
  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { error: 'Forbidden.' });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'content-type': getMimeType(filePath),
      'cache-control': 'no-cache',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    if (pathname !== '/') {
      // Keep the single-page app usable if the browser refreshes a client-side view.
      const fallback = path.join(publicDir, 'index.html');
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      createReadStream(fallback).pipe(response);
    } else {
      sendJson(response, 404, { error: 'Not found.' });
    }
  }
}

const server = http.createServer(async (request, response) => {
  const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    response.end();
    return;
  }

  try {
    if (pathname === '/api/config' && request.method === 'GET') {
      sendJson(response, 200, {
        configured: Boolean(process.env.MAGIC_HOUR_API_KEY),
        provider: 'Magic Hour',
        docsUrl: 'https://docs.magichour.ai/api-reference',
      });
      return;
    }

    if (pathname === '/api/account' && request.method === 'GET') {
      const account = await magicRequest('/account');
      sendJson(response, 200, account);
      return;
    }

    if (pathname === '/api/generate' && request.method === 'POST') {
      const payload = await parseJsonBody(request);
      const result = await createGeneration(payload);
      sendJson(response, 200, result);
      return;
    }

    const projectMatch = pathname.match(/^\/api\/projects\/(image|video)\/([^/]+)$/);
    if (projectMatch && request.method === 'GET') {
      const [, kind, rawId] = projectMatch;
      const id = decodeURIComponent(rawId);
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new ApiError(400, 'Invalid project id.');
      const project = await magicRequest(`/${kind}-projects/${encodeURIComponent(id)}`);
      sendJson(response, 200, project);
      return;
    }

    await serveStatic(request, response, pathname);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : 'Something went wrong.';
    sendJson(response, status, { error: message, details: error instanceof ApiError ? error.details : null });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Magic Hour playground running at http://0.0.0.0:${port}`);
  console.log(process.env.MAGIC_HOUR_API_KEY ? 'Magic Hour API: connected' : 'Magic Hour API: demo mode (MAGIC_HOUR_API_KEY is not set)');
});
