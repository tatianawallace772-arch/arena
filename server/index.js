'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const config = require('./config');
const { AgentSession } = require('./agent');
const inception = require('./inception');
const wsfs = require('./workspace');
const git = require('./git');
const terminal = require('./terminal');
const diagnostics = require('./diagnostics');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));

// ── Static assets from node_modules ────────────────────────────────────────
const vendor = {
  '/vendor/xterm': path.join(config.repoRoot, 'node_modules/@xterm/xterm'),
  '/vendor/xterm-fit': path.join(config.repoRoot, 'node_modules/@xterm/addon-fit'),
  '/vendor/xterm-links': path.join(config.repoRoot, 'node_modules/@xterm/addon-web-links'),
  '/vendor/monaco': path.join(config.repoRoot, 'node_modules/monaco-editor/min'),
  '/vendor/marked': path.join(config.repoRoot, 'node_modules/marked/lib'),
};
for (const [route, dir] of Object.entries(vendor)) {
  app.use(route, express.static(dir, { maxAge: '1h', fallthrough: true }));
}
app.use(express.static(path.join(config.repoRoot, 'public'), { index: 'index.html' }));

// ── Auth (optional shared token) ───────────────────────────────────────────
function authorized(req) {
  if (!config.token) return true;
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const provided = bearer || req.query.token || req.headers['x-agent-token'];
  return provided === config.token;
}

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

const STATUS_FOR_CODE = {
  OUTSIDE_WORKSPACE: 400,
  BAD_PATH: 400,
  BAD_INPUT: 400,
  EXISTS: 409,
  NOT_FOUND: 404,
  IS_DIR: 400,
  NOT_DIR: 400,
  TOO_LARGE: 413,
};

const asyncRoute = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    const status =
      STATUS_FOR_CODE[err.code] || (err.code === 'ENOENT' ? 404 : err.status || 500);
    res.status(status).json({ error: err.message, code: err.code });
  });
};

// ── REST API ───────────────────────────────────────────────────────────────
let reachability = {
  checkedAt: 0,
  ok: null, // unknown until probed
  stage: null,
  headline: null,
  action: null,
};

/** Probe the Inception API, caching the result briefly so /health stays fast. */
async function refreshReachability({ force = false, timeoutMs = 8000 } = {}) {
  const age = Date.now() - reachability.checkedAt;
  if (!force && reachability.checkedAt && age < 60_000) return reachability;
  try {
    const result = await diagnostics.diagnose({
      baseUrl: config.inception.baseUrl,
      apiKey: config.inception.apiKey,
      timeoutMs,
    });
    reachability = {
      checkedAt: Date.now(),
      ok: result.ok,
      stage: result.stage,
      headline: result.headline,
      action: result.action,
      detail: result,
    };
  } catch (err) {
    reachability = {
      checkedAt: Date.now(),
      ok: false,
      stage: 'unknown',
      headline: err.message,
      action: 'Diagnostics failed to run.',
    };
  }
  return reachability;
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    workspace: config.workspaceRoot,
    model: config.inception.model,
    hasApiKey: !!config.inception.apiKey,
    baseUrl: config.inception.baseUrl,
    apiReachable: reachability.ok, // null = not probed yet
    approvalRequired: false,
    version: require('../package.json').version,
  });
});

/** Staged connectivity diagnosis: DNS → TCP → TLS → HTTP → auth → models. */
app.get('/api/diagnostics', asyncRoute(async (req, res) => {
  const result = await diagnostics.diagnose({
    baseUrl: config.inception.baseUrl,
    apiKey: config.inception.apiKey,
    timeoutMs: Number(req.query.timeoutMs) || 12000,
  });
  reachability = {
    checkedAt: Date.now(),
    ok: result.ok,
    stage: result.stage,
    headline: result.headline,
    action: result.action,
    detail: result,
  };
  res.json(result);
}));

const FALLBACK_MODELS = [
  { id: 'mercury-3', label: 'Mercury 3' },
  { id: 'mercury-2.5', label: 'Mercury 2.5' },
  { id: 'mercury-2', label: 'Mercury 2' },
];

app.get('/api/models', asyncRoute(async (req, res) => {
  try {
    const raw = await inception.listModels();
    const models = raw
      .map((m) => (typeof m === 'string' ? { id: m } : { id: m.id || m.name, label: m.name || m.id }))
      .filter((m) => m.id);
    res.json({ models, current: config.inception.model, source: 'api' });
  } catch (err) {
    res.status(200).json({
      models: FALLBACK_MODELS,
      current: config.inception.model,
      source: 'fallback',
      error: err.message,
    });
  }
}));

// Files
app.get('/api/files', asyncRoute(async (req, res) => {
  const entries = await wsfs.list(req.query.path || '.', {
    maxDepth: Number(req.query.depth ?? 4),
  });
  res.json({ root: wsfs.ROOT, entries });
}));

app.get('/api/file', asyncRoute(async (req, res) => {
  if (!req.query.path) return res.status(400).json({ error: 'path is required' });
  const file = await wsfs.readFile(req.query.path);
  res.json(file);
}));

app.put('/api/file', asyncRoute(async (req, res) => {
  const { path: p, content } = req.body || {};
  if (!p) return res.status(400).json({ error: 'path is required' });
  if (typeof content !== 'string') return res.status(400).json({ error: 'content must be a string' });
  res.json(await wsfs.writeFile(p, content));
}));

app.post('/api/file', asyncRoute(async (req, res) => {
  const { path: p, content = '', type } = req.body || {};
  if (!p) return res.status(400).json({ error: 'path is required' });
  if (type === 'dir') res.json(await wsfs.mkdir(p));
  else res.json(await wsfs.createFile(p, content));
}));

app.delete('/api/file', asyncRoute(async (req, res) => {
  const p = req.query.path || (req.body || {}).path;
  if (!p) return res.status(400).json({ error: 'path is required' });
  res.json(await wsfs.deletePath(p));
}));

app.post('/api/rename', asyncRoute(async (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  res.json(await wsfs.renamePath(from, to));
}));

app.get('/api/search', asyncRoute(async (req, res) => {
  const hits = await wsfs.search({
    query: req.query.q || '',
    pattern: req.query.pattern || '',
    regex: req.query.regex === 'true',
  });
  res.json({ hits });
}));

// Git
app.get('/api/git/status', asyncRoute(async (req, res) => res.json(await git.status())));
app.get('/api/git/diff', asyncRoute(async (req, res) =>
  res.json(await git.diff(req.query.path, { staged: req.query.staged === 'true' }))
));
app.get('/api/git/log', asyncRoute(async (req, res) =>
  res.json({ commits: await git.log({ limit: Number(req.query.limit) || 30 }) })
));
app.get('/api/git/branches', asyncRoute(async (req, res) =>
  res.json({ branches: await git.branches() })
));
app.post('/api/git/stage', asyncRoute(async (req, res) => {
  const { paths } = req.body || {};
  if (!paths) return res.status(400).json({ error: 'paths is required' });
  const out = await git.stage(paths);
  res.status(out.ok ? 200 : 400).json(out);
}));
app.post('/api/git/unstage', asyncRoute(async (req, res) => {
  const { paths } = req.body || {};
  if (!paths) return res.status(400).json({ error: 'paths is required' });
  const out = await git.unstage(paths);
  res.status(out.ok ? 200 : 400).json(out);
}));
app.post('/api/git/commit', asyncRoute(async (req, res) => {
  const { message, all, author, email } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });
  const out = await git.commit({ message, all, author, email });
  res.status(out.ok ? 200 : 400).json(out);
}));
app.post('/api/git/checkout', asyncRoute(async (req, res) => {
  const { name, create } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const out = await git.checkout(name, { create });
  res.status(out.ok ? 200 : 400).json(out);
}));
app.post('/api/git/push', asyncRoute(async (req, res) => {
  const out = await git.push(req.body || {});
  res.status(out.ok ? 200 : 400).json(out);
}));
app.post('/api/git/pull', asyncRoute(async (req, res) => {
  const out = await git.pull(req.body || {});
  res.status(out.ok ? 200 : 400).json(out);
}));
app.post('/api/git/init', asyncRoute(async (req, res) => res.json(await git.init())));

// One-shot command execution (used by the "Run" button in the terminal panel)
app.post('/api/exec', asyncRoute(async (req, res) => {
  const { runCommand } = require('./exec');
  const { command, cwd } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command is required' });
  const out = await runCommand(command, {
    cwd: cwd ? wsfs.resolveSafe(cwd) : config.workspaceRoot,
  });
  res.json(out);
}));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(config.repoRoot, 'public', 'index.html'));
});

// ── HTTP + WebSocket server ────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

/** sessionId -> AgentSession */
const sessions = new Map();

function getOrCreateAgent(sessionId, { model, approvalMode } = {}) {
  let agent = sessions.get(sessionId);
  if (!agent) {
    agent = new AgentSession({ id: sessionId, model, approvalMode });
    sessions.set(sessionId, agent);
  }
  if (model) agent.model = model;
  if (approvalMode) agent.approvalMode = approvalMode;
  return agent;
}

function safeSend(socket, data) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(data));
}

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const isTerminal = url.pathname === '/ws/terminal';
  if (!isTerminal && url.pathname !== '/ws/agent') {
    socket.destroy();
    return;
  }
  if (!authorized({ query: Object.fromEntries(url.searchParams) })) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (client) => {
    if (isTerminal) handleTerminal(client, url);
    else handleAgent(client, url);
  });
});

// ── Terminal socket ────────────────────────────────────────────────────────
function handleTerminal(socket, url) {
  const cols = Number(url.searchParams.get('cols')) || 100;
  const rows = Number(url.searchParams.get('rows')) || 30;
  let session = null;

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.type) {
      case 'start': {
        if (session) return;
        session = terminal.createSession({
          cols,
          rows,
          cwd: config.workspaceRoot,
          onData: (data) => safeSend(socket, { type: 'data', data }),
          onExit: ({ exitCode }) => safeSend(socket, { type: 'exit', exitCode }),
        });
        safeSend(socket, { type: 'started', id: session.id, cwd: session.cwd });
        break;
      }
      case 'input': {
        if (session) terminal.write(session.id, msg.data);
        break;
      }
      case 'resize': {
        if (session) terminal.resize(session.id, msg.cols, msg.rows);
        break;
      }
      case 'kill': {
        if (session) terminal.kill(session.id);
        session = null;
        break;
      }
    }
  });

  socket.on('close', () => {
    if (session) terminal.kill(session.id);
  });
}

// ── Agent socket ───────────────────────────────────────────────────────────
function handleAgent(socket, url) {
  const sessionId = url.searchParams.get('session') || 'default';
  const agent = getOrCreateAgent(sessionId, {
    model: url.searchParams.get('model') || undefined,
  });

  const onEvent = (event) => safeSend(socket, { type: 'agent_event', event });
  agent.on('event', onEvent);

  safeSend(socket, {
    type: 'ready',
    session: {
      id: agent.id,
      model: agent.model,
      approvalMode: agent.approvalMode,
      messages: agent.messages.filter((m) => ['user', 'assistant'].includes(m.role)),
    },
    workspace: config.workspaceRoot,
  });

  socket.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    try {
      switch (msg.type) {
        case 'chat': {
          if (agent.running) {
            safeSend(socket, { type: 'agent_event', event: { type: 'error', message: 'Agent is already running.' } });
            return;
          }
          if (msg.model) agent.model = msg.model;
          if (msg.approvalMode) agent.approvalMode = msg.approvalMode;
          await agent.run(msg.message || '');
          break;
        }
        case 'abort':
          agent.abort();
          break;
        case 'approval':
          agent.resolveApproval(msg.approvalId, { approved: !!msg.approved, reason: msg.reason });
          break;
        case 'reset':
          agent.abort();
          agent.reset();
          break;
        case 'set_model':
          if (msg.model) agent.model = msg.model;
          break;
        case 'set_approval_mode':
          if (msg.approvalMode) agent.approvalMode = msg.approvalMode;
          break;
        case 'history':
          safeSend(socket, { type: 'history', messages: agent.toJSON().messages });
          break;
      }
    } catch (err) {
      safeSend(socket, { type: 'agent_event', event: { type: 'error', message: err.message } });
    }
  });

  socket.on('close', () => agent.off('event', onEvent));
}

// Probe the API once at startup and report the outcome in the banner.
refreshReachability().then((r) => {
  if (r.ok) {
    console.log('   api reach   ok');
  } else {
    console.log(`   api reach   UNREACHABLE (${r.stage}): ${r.headline}`);
    console.log('               run: npm run doctor  — for the full staged diagnosis');
  }
});

server.listen(config.port, config.host, () => {
  const banner = [
    '',
    '  ┌───────────────────────────────────────────────┐',
    '  │   Arena Code Agent — powered by Mercury        │',
    '  └───────────────────────────────────────────────┘',
    `   listening   http://${config.host}:${config.port}`,
    `   workspace   ${config.workspaceRoot}`,
    `   model       ${config.inception.model}`,
    `   api key     ${config.inception.apiKey ? 'configured' : 'MISSING — set INCEPTION_API_KEY'}`,
    '',
  ].join('\n');
  console.log(banner);
});

function shutdown() {
  terminal.killAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { app, server };
