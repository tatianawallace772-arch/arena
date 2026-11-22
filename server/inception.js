'use strict';

const config = require('./config');

class InceptionError extends Error {
  constructor(message, { status = 0, code = '', body = '' } = {}) {
    super(message);
    this.name = 'InceptionError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/**
 * Turn an opaque "fetch failed" into something that names the real cause.
 * Node puts the useful part on err.cause; without this the user only ever
 * sees the words "fetch failed".
 */
function networkError(err) {
  const cause = err && err.cause;
  const code = (cause && (cause.code || cause.errno)) || err.code || '';
  const host = (() => {
    try {
      return new URL(config.inception.baseUrl).hostname;
    } catch {
      return config.inception.baseUrl;
    }
  })();

  let detail;
  if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNABORTED') {
    detail =
      `the connection to ${host} was reset before/while the TLS handshake finished. ` +
      'DNS and routing worked, so a firewall, VPN or egress allowlist is almost certainly ' +
      `blocking outbound HTTPS to ${host}`;
  } else if (code === 'ETIMEDOUT' || code === 'ETIMEDOUT') {
    detail = `the connection to ${host} timed out — traffic is being dropped by a firewall or proxy`;
  } else if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    detail = `${host} could not be resolved. Check DNS and INCEPTION_BASE_URL`;
  } else if (code === 'ECONNREFUSED') {
    detail = `${host} refused the connection — nothing is listening, or a local proxy rejected it`;
  } else if (code === 'CERT_HAS_EXPIRED' || /CERT|SELF_SIGNED/i.test(code)) {
    detail = `TLS certificate problem talking to ${host} — something may be intercepting HTTPS`;
  } else {
    detail = cause?.message || err.message || 'unknown network error';
  }

  const message = `Could not reach Inception Labs: ${detail}`;
  const wrapped = new InceptionError(message, { code: 'NETWORK' });
  wrapped.detail = code || 'NETWORK';
  wrapped.hint = 'Run `npm run doctor` (or click "Diagnose connection") for a staged check.';
  return wrapped;
}

function authHeaders() {
  const key = config.inception.apiKey;
  if (!key) {
    throw new InceptionError(
      'No Inception Labs API key configured. Add INCEPTION_API_KEY to your .env file.',
      { code: 'NO_API_KEY' }
    );
  }
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function withRetry(fn, { attempts = 3, baseDelay = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retriable =
        err instanceof InceptionError &&
        (err.status === 429 || err.status >= 500 || err.code === 'NETWORK');
      if (!retriable || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
    }
  }
  throw lastErr;
}

/** Turn an error response into a message a human can act on. */
async function describeFailure(res) {
  const body = await res.text().catch(() => '');
  let detail = '';
  try {
    const parsed = JSON.parse(body);
    detail = parsed.error?.message || parsed.message || '';
  } catch {
    detail = body.slice(0, 300);
  }

  const hints = {
    400: 'The request was rejected. Check the model name and token limits.',
    401: 'Inception Labs rejected the API key. Check INCEPTION_API_KEY in .env.',
    402: 'Billing is inactive or the quota is exhausted on this API key.',
    403: 'This API key is not allowed to use that model.',
    404: 'That model is not available on this account. Pick another in the model menu.',
    429: 'Rate limit reached. Wait a moment and retry.',
  };
  const hint = hints[res.status] || 'Inception Labs returned an error.';
  return new InceptionError(`${hint}${detail ? ` — ${detail}` : ''}`, {
    status: res.status,
    body,
  });
}

/** GET /models */
async function listModels() {
  return withRetry(async () => {
    let res;
    try {
      res = await fetch(`${config.inception.baseUrl}/models`, { headers: authHeaders() });
    } catch (err) {
      throw networkError(err);
    }
    if (!res.ok) {
      throw await describeFailure(res);
    }
    const json = await res.json();
    return json.data || json.models || [];
  });
}

/**
 * Non-streaming chat completion.
 * @param {{messages:Array, tools?:Array, temperature?:number, maxTokens?:number, model?:string}} opts
 */
// Inception only accepts 0.5–1.0; anything outside is silently reset to 1.
function clampTemperature(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return config.inception.temperature;
  return Math.min(1, Math.max(0.5, n));
}

function basePayload({ messages, model, temperature, maxTokens, reasoningEffort, stream }) {
  return {
    model: model || config.inception.model,
    messages,
    temperature: clampTemperature(temperature),
    max_tokens: maxTokens || config.inception.maxTokens,
    reasoning_effort: reasoningEffort || config.inception.reasoningEffort,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };
}

async function chat({ messages, tools, temperature, maxTokens, model, toolChoice }) {
  const payload = basePayload({ messages, model, temperature, maxTokens, stream: false });
  if (tools && tools.length) {
    payload.tools = tools;
    payload.tool_choice = toolChoice || 'auto';
  }

  return withRetry(async () => {
    let res;
    try {
      res = await fetch(`${config.inception.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw networkError(err);
    }
    if (!res.ok) {
      throw await describeFailure(res);
    }
    return res.json();
  });
}

/**
 * Streaming chat completion. Yields deltas as they arrive.
 * @returns {AsyncGenerator<{type:'text'|'tool_calls'|'done', ...}>}
 */
async function* chatStream({ messages, tools, temperature, maxTokens, model, signal }) {
  const payload = basePayload({ messages, model, temperature, maxTokens, stream: true });
  if (tools && tools.length) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  let res;
  try {
    res = await fetch(`${config.inception.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    throw networkError(err);
  }

  if (!res.ok) {
    throw await describeFailure(res);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // Tool-call fragments are streamed piecemeal; accumulate by index.
  const toolCalls = new Map();
  let finishReason = 'stop';

  while (true) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch {
      break;
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      // Usage normally arrives on its own final chunk, with `choices: []`.
      if (parsed.usage) yield { type: 'usage', usage: parsed.usage };

      const choice = parsed.choices && parsed.choices[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta || {};

      if (delta.content) {
        yield { type: 'text', text: delta.content };
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const cur = toolCalls.get(idx) || { id: '', name: '', arguments: '' };
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name = tc.function.name;
          if (tc.function?.arguments) cur.arguments += tc.function.arguments;
          toolCalls.set(idx, cur);
          yield { type: 'tool_call_delta', index: idx, name: cur.name };
        }
      }
    }
  }

  if (toolCalls.size) {
    yield {
      type: 'tool_calls',
      toolCalls: [...toolCalls.values()].map((c) => ({
        id: c.id || `call_${Math.random().toString(36).slice(2, 10)}`,
        name: c.name,
        arguments: c.arguments || '{}',
      })),
    };
  }
  yield { type: 'done', finishReason };
}

module.exports = { chat, chatStream, listModels, InceptionError };
