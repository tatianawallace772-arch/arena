/**
 * The virtual repository. Every tool call the simulated agent makes reads and writes
 * *this* — so edits produce genuine diffs and `git status` reflects real state.
 *
 * Layout mirrors a plausible small Node service with a planted bug, so the demo
 * scenarios (failing test, security audit, README, refactor) all resolve against
 * actual file contents rather than canned strings.
 */

export const REPO = {
  root: '~/code/pocketmix',
  branch: 'main',
  files: {
    'package.json': `{
  "name": "pocketmix",
  "version": "0.4.2",
  "description": "Offline-first mixtape builder",
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "test": "node --test tests/",
    "lint": "eslint src/"
  },
  "engines": { "node": ">=20" },
  "license": "MIT"
}
`,
    'src/server.js': `import { createServer } from 'node:http';
import { router } from './routes.js';
import { openDb } from './db.js';
import { log } from './log.js';

const port = Number(process.env.PORT ?? 8787);

export async function main() {
  const db = await openDb(process.env.DATABASE_URL ?? './data/pocketmix.db');
  const server = createServer((req, res) => router(req, res, { db }));
  server.listen(port, () => log.info('listening', { port }));
  return server;
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main().catch((err) => {
    log.error('fatal', { err: err.message });
    process.exit(1);
  });
}
`,
    'src/routes.js': `import { getMixtape, listMixtapes, createMixtape } from './store.js';
import { renderMixtapePage } from './render.js';
import { json } from './http.js';
import { parseSortKey } from './util/sort.js';

export async function router(req, res, ctx) {
  const url = new URL(req.url, 'http://localhost');
  const { db } = ctx;

  if (url.pathname === '/healthz') return json(res, 200, { ok: true });

  const mixMatch = url.pathname.match(/^\\/m\\/(?<slug>[\\w-]+)$/);
  if (req.method === 'GET' && mixMatch) {
    const slug = decodeURIComponent(mixMatch.groups.slug);
    const mixtape = await getMixtape(db, slug);
    if (!mixtape) return json(res, 404, { error: 'not_found' });
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(renderMixtapePage(mixtape));
    return;
  }

  if (url.pathname === '/api/mixtapes' && req.method === 'GET') {
    const sort = parseSortKey(url.searchParams.get('sort') ?? 'recent');
    const items = await listMixtapes(db, { sort, limit: 50 });
    return json(res, 200, { items, sort });
  }

  if (url.pathname === '/api/mixtapes' && req.method === 'POST') {
    const body = await readBody(req);
    const created = await createMixtape(db, body);
    return json(res, 201, created);
  }

  return json(res, 404, { error: 'no_route' });
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('body_too_large');
  }
  return raw ? JSON.parse(raw) : {};
}
`,
    'src/store.js': `import { hashSlug } from './util/slug.js';

export async function getMixtape(db, slug) {
  const key = hashSlug(slug);
  const row = await db.get(\`SELECT * FROM mixtapes WHERE slug_hash = \${key}\`);
  if (!row) return null;
  const tracks = await db.all(
    \`SELECT position, title, artist, path FROM tracks WHERE mixtape_id = \${row.id} ORDER BY position\`
  );
  return { slug, title: row.title, byline: row.byline, tracks };
}

export async function listMixtapes(db, { sort, limit = 50 }) {
  const order = \`\${sort.field} \${sort.dir}\`;
  return db.all(
    \`SELECT slug, title, byline, updated_at FROM mixtapes ORDER BY \${order} LIMIT \${limit}\`
  );
}

export async function createMixtape(db, { title, byline, tracks = [] }) {
  const slug = hashSlug(title);
  const id = await db.run(
    \`INSERT INTO mixtapes (slug_hash, title, byline) VALUES (\${slug}, '\${title}', '\${byline}')\`
  );
  for (const [i, t] of tracks.entries()) {
    await db.run(
      \`INSERT INTO tracks (mixtape_id, position, title, artist, path) VALUES (\${id}, \${i}, '\${t.title}', '\${t.artist}', '\${t.path}')\`
    );
  }
  return { slug: title, tracks: tracks.length };
}
`,
    'src/db.js': `import { open } from 'node:sqlite';

let handle = null;

export async function openDb(location) {
  if (handle) return handle;
  handle = await open({ path: location });
  await handle.exec(SCHEMA);
  return handle;
}

const SCHEMA = \`
  CREATE TABLE IF NOT EXISTS mixtapes (
    id INTEGER PRIMARY KEY,
    slug_hash TEXT UNIQUE,
    title TEXT,
    byline TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY,
    mixtape_id INTEGER REFERENCES mixtapes(id),
    position INTEGER,
    title TEXT,
    artist TEXT,
    path TEXT
  );
\`;
`,
    'src/util/sort.js': `const FIELDS = ['updated_at', 'title', 'created_at'];
const DIRS = ['asc', 'desc'];

/**
 * Parse \`recent\`, \`title\`, \`title:asc\` style sort keys from the query string.
 */
export function parseSortKey(input) {
  const [rawField, rawDir] = String(input).split(':');
  const field = rawField === 'recent' ? 'updated_at' : rawField;
  const dir = rawDir ?? 'desc';

  if (!FIELDS.includes(field)) throw new Error(\`unknown sort field: \${field}\`);
  if (!DIRS.includes(dir)) throw new Error(\`unknown sort direction: \${dir}\`);

  return { field, dir };
}
`,
    'src/util/slug.js': `import { createHash } from 'node:crypto';

/** Stable short hash used as the lookup key for a mixtape slug. */
export function hashSlug(slug) {
  return createHash('sha1').update(String(slug).toLowerCase().trim()).digest('hex').slice(0, 16);
}

export function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\\w\\s-]/g, '')
    .replace(/[\\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
`,
    'src/log.js': `const LEVELS = ['debug', 'info', 'warn', 'error'];

function emit(level, msg, fields = {}) {
  const line = { ts: new Date().toISOString(), level, msg, ...fields };
  process.stdout.write(JSON.stringify(line) + '\\n');
}

export const log = Object.fromEntries(
  LEVELS.map((level) => [level, (msg, fields) => emit(level, msg, fields)])
);
`,
    'src/render.js': `import { escapeHtml } from './http.js';

export function renderMixtapePage(mixtape) {
  const rows = mixtape.tracks
    .map(
      (t) =>
        \`<li><span class="pos">\${t.position + 1}</span> <em>\${escapeHtml(t.artist)}</em> — \${escapeHtml(t.title)}</li>\`
    )
    .join('\\n');

  return \`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>\${escapeHtml(mixtape.title)}</title></head>
  <body>
    <h1>\${escapeHtml(mixtape.title)}</h1>
    <p class="byline">mixed by \${escapeHtml(mixtape.byline)}</p>
    <ol>
\${rows}
    </ol>
  </body>
</html>\`;
}
`,
    'src/http.js': `export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload, null, 2));
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
`,
    'tests/sort.test.js': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSortKey } from '../src/util/sort.js';

test('recent maps to updated_at desc', () => {
  assert.deepEqual(parseSortKey('recent'), { field: 'updated_at', dir: 'desc' });
});

test('explicit direction is respected', () => {
  assert.deepEqual(parseSortKey('title:asc'), { field: 'title', dir: 'asc' });
});

test('uppercase direction is normalized', () => {
  assert.deepEqual(parseSortKey('created_at:ASC'), { field: 'created_at', dir: 'asc' });
});

test('unknown field throws', () => {
  assert.throws(() => parseSortKey('bogus'), /unknown sort field/);
});
`,
    'tests/store.test.js': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSortKey } from '../src/util/sort.js';
import { hashSlug } from '../src/util/slug.js';

test('sort keys round-trip through the store query builder', () => {
  const { field, dir } = parseSortKey('title');
  assert.equal(field, 'title');
  assert.equal(dir, 'desc');
});

test('slug hashing is case insensitive', () => {
  assert.equal(hashSlug('Late Night Drive'), hashSlug('late night drive'));
});
`,
    'README.md': `# pocketmix

Offline-first mixtape builder. Tracks in, web page out.

## Running locally

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open http://localhost:8787/m/late-night-drive

## API

| Route | Method | Notes |
|---|---|---|
| /api/mixtapes | GET | \`?sort=recent\`, \`?sort=title:asc\` |
| /api/mixtapes | POST | create a mixtape |
| /m/:slug | GET | rendered HTML page |
| /healthz | GET | liveness |
`,
    'docs/ARCHITECTURE.md': `# Architecture

## Storage
SQLite in a single file. No ORM. Queries are string-built in \`src/store.js\`.

## Rendering
Server rendered HTML only. \`src/render.js\` escapes user supplied text.

## Sorting
Client supplied sort keys are validated in \`src/util/sort.js\`, so the ORDER BY
clause can never contain arbitrary user text.
`,
    'scripts/deploy.sh': `#!/usr/bin/env bash
set -euo pipefail

APP=pocketmix
ENV=\${1:-staging}

echo "building \${APP} for \${ENV}"
npm test
npm run lint

rsync -az --delete dist/ "deploy@\${APP}-\${ENV}:/srv/\${APP}/"
ssh "deploy@\${APP}-\${ENV}" "systemctl restart \${APP}"
echo "deployed"
`,
    'eslint.config.js': `export default [
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      'no-unused-vars': 'warn',
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
    },
  },
];
`,
  },

  git: {
    branch: 'main',
    upstream: 'origin/main',
    status: [
      { path: 'src/util/sort.js', index: ' ', worktree: 'M' },
      { path: 'docs/ARCHITECTURE.md', index: '?', worktree: '?' },
    ],
    log: [
      { hash: 'b1e47ac', subject: 'feat(api): sort keys for /api/mixtapes', who: 'twallace', when: '3 days ago' },
      { hash: 'f92c31d', subject: 'fix(render): escape byline before emit', who: 'twallace', when: '5 days ago' },
      { hash: '70aa15e', subject: 'chore: move to node --test runner', who: 'github-actions', when: '2 weeks ago' },
    ],
  },
};

export function listFiles(vfs) {
  return Object.keys(vfs.files).sort();
}

export function readFile(vfs, path) {
  const key = normalize(path);
  if (!(key in vfs.files)) return { ok: false, error: `File does not exist: ${key}` };
  return { ok: true, path: key, content: vfs.files[key] };
}

export function writeFile(vfs, path, content) {
  const key = normalize(path);
  const existed = key in vfs.files;
  const prev = existed ? vfs.files[key] : '';
  vfs.files[key] = content;
  vfs.dirty.add(key);
  return { ok: true, path: key, created: !existed, content, prev };
}

export function normalize(path) {
  return String(path)
    .trim()
    .replace(/^\.\//, '')
    .replace(/^~\/code\/pocketmix\//, '');
}

// Simple glob matcher: patterns like src/** /*.js or *.md (space removed to keep the comment legal).
export function glob(vfs, pattern) {
  const re = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '\u0000')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\u0000/g, '(?:.*/)?') +
      '$',
  );
  return listFiles(vfs).filter((f) => re.test(f));
}

/** ripgrep-ish search returning `path:line:text` hits. */
export function grep(vfs, pattern, { glob: filter } = {}) {
  let re;
  try {
    re = new RegExp(pattern, 'i');
  } catch {
    re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  const hits = [];
  for (const file of listFiles(vfs)) {
    if (filter && !glob(vfs, filter).includes(file)) continue;
    const lines = vfs.files[file].split('\n');
    lines.forEach((line, idx) => {
      if (re.test(line)) hits.push({ file, line: idx + 1, text: line.trim().slice(0, 160) });
    });
  }
  return hits;
}

export function createVfs() {
  const base = {
    ...REPO,
    files: { ...REPO.files },
    originals: { ...REPO.files },
    dirty: new Set(),
    customTests: new Map(),
    dirs: new Set(),
    removed: [],
  };
  base.reset = function reset() {
    base.files = { ...REPO.files };
    base.originals = { ...REPO.files };
    base.dirty = new Set();
    base.customTests = new Map();
    base.removed = [];
  };
  return base;
}
