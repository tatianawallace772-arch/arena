'use strict';

const path = require('path');
const fs = require('fs');

// Minimal .env loader (avoids a hard dependency at boot time, though dotenv
// is installed — this keeps `require('./config')` usable from any entrypoint).
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const repoRoot = path.resolve(__dirname, '..');
loadDotEnv(path.join(repoRoot, '.env'));

function resolveWorkspace() {
  const configured = (process.env.WORKSPACE_ROOT || '').trim();
  const root = configured ? path.resolve(configured) : repoRoot;
  try {
    return fs.realpathSync(root);
  } catch {
    return root;
  }
}

const config = {
  repoRoot,
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  token: (process.env.AGENT_TOKEN || '').trim(),
  workspaceRoot: resolveWorkspace(),

  inception: {
    apiKey: (process.env.INCEPTION_API_KEY || '').trim(),
    baseUrl: (process.env.INCEPTION_BASE_URL || 'https://api.inceptionlabs.ai/v1').replace(
      /\/+$/,
      ''
    ),
    // Mercury 3 is the current flagship. Older keys can still use
    // mercury-2.5 / mercury-2 — the UI lists whatever /v1/models returns.
    model: process.env.INCEPTION_MODEL || 'mercury-3',
    // Inception requires 0.5–1.0; out-of-range values are silently reset to 1.
    temperature: Number(process.env.INCEPTION_TEMPERATURE || 0.7),
    maxTokens: Number(process.env.INCEPTION_MAX_TOKENS || 16384),
    reasoningEffort: process.env.INCEPTION_REASONING_EFFORT || 'medium',
  },

  // Limits that keep a runaway agent from melting the machine.
  limits: {
    maxSteps: Number(process.env.AGENT_MAX_STEPS || 40),
    maxReadBytes: 400_000,
    maxWriteBytes: 2_000_000,
    maxTerminalOutput: 30_000,
    commandTimeoutMs: Number(process.env.AGENT_COMMAND_TIMEOUT_MS || 120_000),
  },
};

module.exports = config;
