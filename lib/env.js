'use strict';
/**
 * Environment loading + mode registry.
 *
 * Modes are the two user-facing personalities of this app. Each one is a thin
 * OpenAI-compatible chat-completions target:
 *
 *   stealth/ox-alpha -> OpenRouter          (OPENROUTER_API_KEY)
 *   big-pickle       -> OpenCode Zen        (OPENCODE_API_KEY)
 *
 * No API keys are ever stored in this repo. They are read from the process
 * environment at request time (`.env` is loaded here if present, and is
 * git-ignored). See .env.example.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = {
  PORT: '3000',
  HOST: '0.0.0.0',

  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  OPENROUTER_MODEL: 'openai/gpt-4o-mini',
  // Optional OpenRouter ranking/attribution headers.
  OPENROUTER_SITE_URL: '',
  OPENROUTER_APP_TITLE: 'arena / stealth-ox-alpha',

  OPENCODE_BASE_URL: 'https://opencode.ai/zen/v1',
  OPENCODE_MODEL: 'opencode/gpt-5-nano',

  UPSTREAM_TIMEOUT_MS: '60000',
  MAX_BODY_BYTES: '262144', // 256 KiB request cap
  MAX_MESSAGES: '64'
};

/** Load KEY=VALUE lines from a dotenv file without a dependency. */
function parseDotenv(text) {
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Merge `.env` (then `.env.local`) into process.env without overriding
 * values that are already set by the real environment.
 * Returns the list of files that were loaded.
 */
function loadEnvFiles(root = process.cwd()) {
  const loaded = [];
  for (const file of ['.env', '.env.local']) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    let parsed;
    try {
      parsed = parseDotenv(fs.readFileSync(full, 'utf8'));
    } catch {
      continue;
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined || process.env[k] === '') process.env[k] = v;
    }
    loaded.push(file);
  }
  return loaded;
}

/** First non-empty value among the given env var names. */
function firstSet(names) {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

/**
 * `sk-or-v1-abcdefghijklmnopqrstuvwxyz` -> `sk-or-v1-a...wxyz`
 * Used for UI status only. Never returns enough of a key to be usable.
 */
function maskKey(key) {
  if (!key) return '';
  const head = key.slice(0, 10);
  const tail = key.length > 18 ? key.slice(-4) : '';
  return `${head}...${tail}`;
}

const MODES = [
  {
    id: 'stealth',
    name: 'stealth/ox-alpha',
    shortName: 'stealth',
    accent: '#7df2c3',
    blurb: 'Routed through OpenRouter. Model is fully configurable (any OpenRouter slug).',
    baseUrlVar: 'OPENROUTER_BASE_URL',
    keyVars: ['OPENROUTER_API_KEY', 'OPENROUTER_KEY'],
    modelVar: 'OPENROUTER_MODEL',
    defaultBase: DEFAULTS.OPENROUTER_BASE_URL,
    defaultModel: DEFAULTS.OPENROUTER_MODEL,
    upstreamHeaders(env) {
      const h = {};
      if (env.OPENROUTER_SITE_URL) h['HTTP-Referer'] = env.OPENROUTER_SITE_URL;
      if (env.OPENROUTER_APP_TITLE) h['X-Title'] = env.OPENROUTER_APP_TITLE;
      return h;
    }
  },
  {
    id: 'pickle',
    name: 'big-pickle',
    shortName: 'pickle',
    accent: '#ffd166',
    blurb: 'Routed through OpenCode Zen, an OpenAI-compatible gateway. One key, many models.',
    baseUrlVar: 'OPENCODE_BASE_URL',
    keyVars: ['OPENCODE_API_KEY', 'OPENCODE_ZEN_API_KEY'],
    modelVar: 'OPENCODE_MODEL',
    defaultBase: DEFAULTS.OPENCODE_BASE_URL,
    defaultModel: DEFAULTS.OPENCODE_MODEL,
    upstreamHeaders() {
      return {};
    }
  }
];

function resolveEnv() {
  const env = { ...DEFAULTS, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) };
  return env;
}

/** Runtime description of both modes, safe to send to a browser. */
function describeModes() {
  const env = resolveEnv();
  return MODES.map((m) => {
    const key = firstSet(m.keyVars);
    return {
      id: m.id,
      name: m.name,
      shortName: m.shortName,
      accent: m.accent,
      blurb: m.blurb,
      baseUrl: env[m.baseUrlVar] || m.defaultBase,
      model: env[m.modelVar] || m.defaultModel,
      keyVar: m.keyVars[0],
      keyConfigured: Boolean(key),
      keyMasked: maskKey(key)
    };
  });
}

function getMode(id) {
  return MODES.find((m) => m.id === id) || null;
}

/** Fully resolved runtime settings for one mode. */
function resolveMode(mode) {
  const env = resolveEnv();
  const apiKey = firstSet(mode.keyVars);
  return {
    mode,
    baseUrl: (env[mode.baseUrlVar] || mode.defaultBase).replace(/\/+$/, ''),
    apiKey,
    model: env[mode.modelVar] || mode.defaultModel,
    extraHeaders: mode.upstreamHeaders(env),
    timeoutMs: Number(env.UPSTREAM_TIMEOUT_MS) || 60000
  };
}

module.exports = {
  DEFAULTS,
  MODES,
  parseDotenv,
  loadEnvFiles,
  firstSet,
  maskKey,
  resolveEnv,
  describeModes,
  getMode,
  resolveMode
};
