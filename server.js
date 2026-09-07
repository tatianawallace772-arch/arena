import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const magicHourBase = 'https://api.magichour.ai/v1';

// The public Magic Hour model catalog is the source of truth for the picker. The
// catalog is intentionally served from our own origin so the browser never needs
// to know about API credentials or depend on a cross-origin request.
const MODEL_CATALOG = [
  { id: 'sora-2', name: 'Sora 2', kind: 'video', availableFor: ['video'], description: "OpenAI's model for surreal concepts and viral clips.", tools: ['Text to Video', 'Image to Video'], resolutions: ['720p'], durations: [4, 8, 12, 24, 36, 48, 60], audio: true, premium: true },
  { id: 'ltx-2.3', name: 'LTX 2.3', kind: 'video', availableFor: ['video'], description: 'Fast iteration with synced audio and expressive faces.', tools: ['Text to Video', 'Image to Video'], resolutions: ['480p', '720p', '1080p'], durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30], audio: true },
  { id: 'minimax-h3', name: 'MiniMax H3', kind: 'video', availableFor: ['video'], description: 'Reference-driven video with native audio.', tools: ['Text to Video', 'Image to Video'], resolutions: ['480p', '720p', '1080p'], durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30], audio: true },
  { id: 'seedance-2.0', name: 'Seedance 2.0', kind: 'video', availableFor: ['video'], description: 'Cinematic continuity with reference-to-video control.', tools: ['Text to Video', 'Image to Video'], resolutions: ['480p', '720p'], durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], audio: true },
  { id: 'seedance-2.0-mini', name: 'Seedance 2 Mini', kind: 'video', availableFor: ['video'], description: 'Faster, lower-cost Seedance 2 with reference-to-video.', tools: ['Text to Video', 'Image to Video'], resolutions: ['480p', '720p'], durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], audio: true },
  { id: 'seedance-2.5', name: 'Seedance 2.5', kind: 'video', availableFor: ['video'], description: 'Cinematic continuity with premium realism and detail.', tools: ['Text to Video', 'Image to Video'], resolutions: ['480p', '720p', '1080p'], durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25, 30], audio: true, premium: true },
  { id: 'kling-3.0', name: 'Kling 3.0', kind: 'video', availableFor: ['video'], description: 'Multi-shot storytelling with character control.', tools: ['Text to Video', 'Image to Video'], resolutions: ['720p', '1080p', '4k'], durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], audio: true, recommended: true },
  { id: 'kling-2.5', name: 'Kling 2.5', kind: 'video', availableFor: ['video'], description: 'Great for motion, action, and camera control.', tools: ['Text to Video', 'Image to Video'], resolutions: ['720p', '1080p'], durations: [5, 10], audio: false },
  { id: 'veo3.1', name: 'Veo 3.1', kind: 'video', availableFor: ['video'], description: "Google's frontier model with premium realism.", tools: ['Text to Video', 'Image to Video'], resolutions: ['720p', '1080p'], durations: [4, 6, 8, 16, 24, 32, 40, 48, 56], audio: true, premium: true },
  { id: 'gemini-omni-1.1', name: 'Google Omni', kind: 'video', availableFor: [], description: 'Natural-language video editing with the Google Omni model.', tools: ['Video Edit'], resolutions: ['360p', '720p', '1080p', '4k'], durations: [3, 4, 5, 6, 7, 8, 9, 10], audio: false, catalogOnly: true },
  { id: 'wan-2.2', name: 'Wan 2.2', kind: 'video', availableFor: ['video'], description: 'Best for cinematic control and flexible text-to-video.', tools: ['Text to Video', 'Image to Video'], resolutions: ['480p', '720p', '1080p'], durations: [3, 4, 5, 6, 7, 8, 9, 10, 15], audio: false },
  { id: 'wan-animate', name: 'Wan-Animate', kind: 'video', availableFor: [], description: 'Character animation and performance transfer.', tools: ['Character Replace'], resolutions: ['480p', '720p'], durations: [5, 10], audio: false, catalogOnly: true },
  { id: 'kling-3.0-omni', name: 'Kling 3.0 Omni', kind: 'video', availableFor: ['video'], description: 'Dialogue-friendly video with native audio and references.', tools: ['Text to Video', 'Image to Video'], resolutions: ['720p', '1080p'], durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], audio: true, premium: true },
  { id: 'seedance-1.5', name: 'Seedance 1.5', kind: 'video', availableFor: ['video'], description: 'Prompt-following multi-shot narrative video.', tools: ['Text to Video', 'Image to Video'], resolutions: ['480p', '720p', '1080p'], durations: [4, 5, 6, 7, 8, 9, 10, 11, 12], audio: true },
  { id: 'flux-2-klein', name: 'Flux 2 Klein', kind: 'image', availableFor: ['image'], description: 'Sub-second generation and editing from Black Forest Labs.', tools: ['Text to Image', 'Image Edit'], resolutions: ['640px', '1k', '2k'], durations: [], audio: false },
  { id: 'gpt-image-2', name: 'GPT Image 2', kind: 'image', availableFor: ['image'], description: 'Strong prompt adherence with output up to 4K.', tools: ['Text to Image', 'Image Edit'], resolutions: ['640px', '1k', '2k', '4k'], durations: [], audio: false, premium: true },
  { id: 'nano-banana', name: 'Nano Banana', kind: 'image', availableFor: ['image'], description: 'Precise, realistic generations with consistent results.', tools: ['Text to Image', 'Image Edit'], resolutions: ['640px', '1k', '2k'], durations: [], audio: false },
  { id: 'nano-banana-2', name: 'Nano Banana 2', kind: 'image', availableFor: ['image'], description: 'Fast generation with strong prompt adherence.', tools: ['Text to Image', 'Image Edit'], resolutions: ['640px', '1k', '2k', '4k'], durations: [], audio: false },
  { id: 'nano-banana-2-lite', name: 'Nano Banana 2 Lite', kind: 'image', availableFor: ['image'], description: 'Fastest, lowest-cost Nano Banana 2 for drafts.', tools: ['Text to Image', 'Image Edit'], resolutions: ['640px', '1k'], durations: [], audio: false },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', kind: 'image', availableFor: ['image'], description: 'Highest quality for realistic, detailed images.', tools: ['Text to Image', 'Image Edit'], resolutions: ['1k', '2k', '4k'], durations: [], audio: false, premium: true },
  { id: 'seedream-v4', name: 'Seedream 4', kind: 'image', availableFor: ['image'], description: 'Creative, imaginative images with artistic freedom.', tools: ['Text to Image', 'Image Edit'], resolutions: ['640px', '1k', '2k', '4k'], durations: [], audio: false },
  { id: 'seedream-v4.5', name: 'Seedream 4.5', kind: 'image', availableFor: ['image'], description: 'Stylized, imaginative, high-resolution images.', tools: ['Text to Image', 'Image Edit'], resolutions: ['640px', '1k', '2k', '4k'], durations: [], audio: false, premium: true },
  { id: 'seedream-v5-pro', name: 'Seedream 5 Pro', kind: 'image', availableFor: ['image'], description: 'Pro-level detail with sharper quality for design.', tools: ['Text to Image', 'Image Edit'], resolutions: ['640px', '1k', '2k'], durations: [], audio: false, premium: true },
  { id: 'flux-schnell', name: 'FLUX Schnell', kind: 'image', availableFor: ['image'], description: 'Free, ultra-fast image generation for quick drafts.', tools: ['Text to Image'], resolutions: ['640px', '1k', '2k'], durations: [], audio: false },
  { id: 'z-image-turbo', name: 'Z-Image Turbo', kind: 'image', availableFor: ['image'], description: 'Ultra-fast, high-quality images for rapid iteration.', tools: ['Text to Image'], resolutions: ['640px', '1k', '2k'], durations: [], audio: false },
  { id: 'qwen-edit', name: 'Qwen Edit', kind: 'image', availableFor: [], description: 'Fast, low-cost prompt-based image edits.', tools: ['Image Edit'], resolutions: ['640px', '1k', '2k'], durations: [], audio: false, catalogOnly: true },
];

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

const DEFAULT_MODEL = {
  id: 'default',
  name: 'Magic Hour Default',
  kind: 'all',
  availableFor: ['image', 'video'],
  description: 'Magic Hour picks the current recommended model for your account.',
  tools: ['Text to Image', 'Text to Video', 'Image to Video'],
  resolutions: ['640px', '480p', '1k', '720p', '2k', '1080p', '4k'],
  durations: [3, 4, 5, 6, 7, 8, 9, 10],
  audio: true,
  recommended: true,
};

function getCatalogModel(id) {
  return id === 'default' ? DEFAULT_MODEL : MODEL_CATALOG.find((model) => model.id === id);
}

function supportedAspectRatios(model, kind) {
  if (kind === 'image') return ['1:1', '16:9', '9:16', '4:3', '3:4'];
  if (model?.id === 'sora-2') return ['16:9', '9:16'];
  return ['16:9', '9:16', '1:1'];
}

async function createGeneration(payload) {
  const kind = payload?.kind === 'video' ? 'video' : 'image';
  const prompt = cleanPrompt(payload?.prompt);
  const modelId = typeof payload?.model === 'string' && payload.model.trim() ? payload.model.trim() : 'default';
  const model = getCatalogModel(modelId);
  if (!model) throw new ApiError(400, 'That model is not in the Magic Hour catalog. Refresh the model list and try again.');
  if (!model.availableFor.includes(kind)) {
    throw new ApiError(400, `${model.name} is listed for ${model.tools.join(', ')}, not this playground output.`);
  }

  const ratios = supportedAspectRatios(model, kind);
  const aspectRatio = ratios.includes(payload?.aspectRatio) ? payload.aspectRatio : ratios[0];
  const qualityOptions = model.resolutions.filter((resolution) => kind === 'image' ? resolution.match(/^(640px|1k|2k|4k)$/) : resolution.match(/^(360p|480p|720p|1080p|4k)$/));

  if (kind === 'image') {
    const body = {
      name: cleanName(payload?.name, 'Magic Hour image'),
      image_count: 1,
      model: modelId,
      aspect_ratio: aspectRatio,
      resolution: qualityOptions.includes(payload?.resolution) ? payload.resolution : (qualityOptions.includes('1k') ? '1k' : qualityOptions[0]),
      style: { prompt },
    };
    const result = await magicRequest('/ai-image-generator', { method: 'POST', body });
    return { ...result, kind, model: modelId, prompt, estimatedCredits: result?.credits_charged || 5 };
  }

  const source = payload?.source === 'image' ? 'image' : 'text';
  const durationOptions = model.durations.length ? model.durations : [5];
  const requestedDuration = clampNumber(payload?.duration, 1, 60, 5);
  const duration = durationOptions.includes(requestedDuration) ? requestedDuration : durationOptions.reduce((closest, option) => Math.abs(option - requestedDuration) < Math.abs(closest - requestedDuration) ? option : closest, durationOptions[0]);
  const body = {
    name: cleanName(payload?.name, source === 'image' ? 'Magic Hour animation' : 'Magic Hour video'),
    end_seconds: duration,
    aspect_ratio: aspectRatio,
    resolution: qualityOptions.includes(payload?.resolution) ? payload.resolution : (qualityOptions.includes('720p') ? '720p' : qualityOptions[0]),
    model: modelId,
    audio: model.audio === false ? false : Boolean(payload?.audio),
    style: { prompt },
  };

  let endpoint = '/text-to-video';
  if (source === 'image') {
    const imageFilePath = await uploadAsset(payload?.imageData);
    body.assets = { image_file_path: imageFilePath };
    endpoint = '/image-to-video';
  }

  const result = await magicRequest(endpoint, { method: 'POST', body });
  return { ...result, kind, source, model: modelId, prompt, estimatedCredits: result?.credits_charged || 450 };
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

    if (pathname === '/api/models' && request.method === 'GET') {
      sendJson(response, 200, {
        source: 'Magic Hour public model catalog',
        updatedAt: '2026-09-07',
        count: MODEL_CATALOG.length,
        models: [DEFAULT_MODEL, ...MODEL_CATALOG],
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
