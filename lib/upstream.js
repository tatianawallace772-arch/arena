'use strict';
/**
 * OpenAI-compatible upstream client.
 *
 * Both providers speak the same `/chat/completions` shape, so a single client
 * covers them; only the base URL, key and headers differ (see lib/env.js).
 */

class UpstreamError extends Error {
  constructor(status, bodyText) {
    super(`upstream ${status}`);
    this.name = 'UpstreamError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

/** Extract a human-readable message from a JSON error body if possible. */
function parseUpstreamError(status, bodyText) {
  let detail = '';
  try {
    const parsed = JSON.parse(bodyText);
    detail =
      (parsed.error && (parsed.error.message || parsed.error)) ||
      parsed.message ||
      parsed.detail ||
      '';
    if (typeof detail !== 'string') detail = JSON.stringify(detail);
  } catch {
    detail = bodyText || '';
  }
  return { status, detail: detail.slice(0, 2000) };
}

async function readBody(res, limit = 8192) {
  const chunks = [];
  let size = 0;
  for await (const chunk of res) {
    size += chunk.length;
    if (size > limit) break;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * POST /chat/completions upstream.
 * @returns {Promise<{status:number, headers:Headers, body:ReadableStream|null}>}
 * @throws {UpstreamError} on non-2xx
 */
async function chatCompletions({ baseUrl, apiKey, model, messages, stream, timeoutMs, extraHeaders }) {
  const url = `${baseUrl}/chat/completions`;
  const payload = { model, messages };
  if (stream) payload.stream = true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...extraHeaders
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new UpstreamError(504, `upstream timed out after ${timeoutMs}ms`);
    throw new UpstreamError(502, `could not reach ${url}: ${err.message}`);
  }

  if (!res.ok) {
    const bodyText = await readBody(res.body);
    clearTimeout(timer);
    const parsed = parseUpstreamError(res.status, bodyText);
    throw new UpstreamError(res.status, parsed.detail);
  }

  return { status: res.status, headers: res.headers, body: res.body, cancel: () => clearTimeout(timer) };
}

/** GET /models upstream — used by the health check. */
async function listModels({ baseUrl, apiKey, timeoutMs, extraHeaders }) {
  const url = `${baseUrl}/models`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 10000));
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${apiKey}`, ...extraHeaders },
      signal: controller.signal
    });
    const bodyText = await readBody(res.body, 65536);
    if (!res.ok) {
      const parsed = parseUpstreamError(res.status, bodyText);
      return { ok: false, status: res.status, detail: parsed.detail };
    }
    let count = 0;
    try {
      const parsed = JSON.parse(bodyText);
      count = Array.isArray(parsed.data) ? parsed.data.length : 0;
    } catch {
      /* ignore */
    }
    return { ok: true, status: res.status, models: count };
  } catch (err) {
    if (err.name === 'AbortError') return { ok: false, status: 504, detail: 'timed out' };
    return { ok: false, status: 502, detail: err.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { chatCompletions, listModels, UpstreamError };
