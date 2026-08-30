'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const PUBLIC_ROOT = __dirname;
const ALLOWED_FORMATS = new Set(['mp3', 'wav', 'opus']);
const ALLOWED_MODELS = new Set(['s2-pro', 's2.1-pro', 's2.1-mini']);

function securityHeaders() {
  return {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  };
}

function sendJson(response, status, body) {
  const output = JSON.stringify(body);
  response.writeHead(status, {
    ...securityHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(output)
  });
  response.end(output);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (_) {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function getApiKey(request) {
  // Prefer the server environment so production keys never need to reach the page.
  return process.env.FISH_API_KEY || request.headers['x-fish-api-key'];
}

function requestFishAudio(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const upstream = https.request({
      hostname: 'api.fish.audio',
      path: '/v1/tts',
      method: 'POST',
      timeout: 120000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        model: payload.model
      }
    }, (response) => {
      const chunks = [];
      let total = 0;

      response.on('data', (chunk) => {
        total += chunk.length;
        if (total <= MAX_AUDIO_BYTES) chunks.push(chunk);
      });
      response.on('end', () => {
        if (total > MAX_AUDIO_BYTES) {
          reject(new Error('Fish Audio returned an audio file that is too large.'));
          return;
        }
        resolve({
          status: response.statusCode || 502,
          contentType: response.headers['content-type'] || 'application/octet-stream',
          body: Buffer.concat(chunks)
        });
      });
    });

    upstream.on('timeout', () => upstream.destroy(new Error('Fish Audio timed out.')));
    upstream.on('error', reject);
    upstream.write(body);
    upstream.end();
  });
}

function validatePayload(input) {
  if (!input || typeof input !== 'object') throw new Error('Request body must be an object.');
  if (typeof input.text !== 'string' || !input.text.trim()) throw new Error('Text is required.');
  if (input.text.length > 1500) throw new Error('Text must be 1500 characters or fewer.');

  const format = ALLOWED_FORMATS.has(input.format) ? input.format : 'mp3';
  const model = ALLOWED_MODELS.has(input.model) ? input.model : 's2-pro';
  const speed = Number(input.prosody && input.prosody.speed);
  const payload = {
    text: input.text.trim(),
    format,
    model,
    prosody: { speed: Number.isFinite(speed) ? Math.min(2, Math.max(.5, speed)) : 1 }
  };

  if (typeof input.reference_id === 'string' && input.reference_id.trim()) {
    payload.reference_id = input.reference_id.trim();
  }
  return payload;
}

async function handleTts(request, response) {
  const apiKey = getApiKey(request);
  if (!apiKey) {
    sendJson(response, 401, { error: 'Missing Fish Audio API key.', message: 'Enter a key in the page or configure FISH_API_KEY on the server.' });
    return;
  }

  let input;
  try {
    input = await readJson(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  let payload;
  try {
    payload = validatePayload(input);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  try {
    const result = await requestFishAudio(apiKey, payload);
    response.writeHead(result.status, {
      ...securityHeaders(),
      'Content-Type': result.contentType,
      'Content-Length': result.body.length
    });
    response.end(result.body);
  } catch (_) {
    sendJson(response, 502, { error: 'Fish Audio is unavailable.', message: 'The upstream voice request could not be completed.' });
  }
}

function serveIndex(response) {
  const file = fs.readFileSync(path.join(PUBLIC_ROOT, 'index.html'));
  response.writeHead(200, {
    ...securityHeaders(),
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': file.length
  });
  response.end(file);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html')) {
    serveIndex(response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/tts') {
    await handleTts(request, response);
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
});

server.listen(PORT, HOST, () => {
  console.log(`Fish Audio Voice Lab running at http://${HOST}:${PORT}`);
  console.log(process.env.FISH_API_KEY ? 'Using the server-side FISH_API_KEY.' : 'Waiting for a key from the local test form.');
});
