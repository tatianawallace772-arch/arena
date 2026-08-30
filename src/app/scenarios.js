/**
 * Scenario library: the "brain" of the simulation. Each scenario plans a sequence of
 * agent steps against the live virtual filesystem, so edits/diffs/test results are
 * computed rather than canned. Steps are data; the Agent in agent.js executes them.
 *
 * Step kinds: think | text | tool | todos | wait | error | notice | done
 */

const re = (src) => new RegExp(src, 'i');

/** Exact-string edit computed from the file's *current* contents. */
function editFrom(file, find, replace) {
  return (ctx) => {
    const cur = ctx.vfs.files[file] ?? '';
    const oldText = typeof find === 'string' ? find : (cur.match(find) ?? [''])[0];
    const newText = typeof replace === 'string' ? replace : oldText.replace(find, replace);
    return { file_path: file, old_string: oldText, new_string: newText };
  };
}

const SCENARIOS = [
  // ---------------------------------------------------------------- failing tests
  {
    id: 'fix-tests',
    label: 'Diagnose and fix the failing test',
    match: (p) => re('fail|broken|red ci|why.*test|fix.*(test|sort|bug)|not passing').test(p),
    plan(ctx) {
      const src = ctx.vfs.files['src/util/sort.js'] ?? '';
      const alreadyFixed = /toLowerCase/.test(src.split('const dir')[1]?.split('\n')[0] ?? '');
      const steps = [
        {
          kind: 'think',
          ms: 2600,
          text:
            'The user says tests are failing. I should reproduce before theorising: run the suite, read the assertion, then read the source under test. I expect one of the sort-key tests is the culprit since that is the newest change on the branch (b1e47ac).',
        },
        {
          kind: 'text',
          md: 'Let me reproduce it first, then trace it to the source.',
        },
        { kind: 'tool', name: 'Bash', args: { command: 'npm test', description: 'Run the test suite' }, approval: 'auto' },
      ];
      if (alreadyFixed) {
        steps.push({
          kind: 'text',
          md: `The suite is green — 6/6 passing. \`parseSortKey\` already normalises the direction in \`src/util/sort.js\`, so whatever was failing looks already fixed on this branch.

If CI is still red, it is probably the lint step rather than the tests. Want me to run \`npm run lint\` and diff against \`origin/main\`?`,
        });
        return steps;
      }
      steps.push(
        {
          kind: 'text',
          md: `Reproduced: one failure, \`uppercase direction is normalized\` in \`tests/sort.test.js\`.

\`\`\`
✖ uppercase direction is normalized (3.700 ms)
  + actual  { dir: 'ASC' }
  - expected { dir: 'asc' }
\`\`\`

Reading the parser and its callers to see where normalisation should live.`,
        },
        { kind: 'tool', name: 'Read', args: { file_path: 'src/util/sort.js' }, approval: 'none' },
        { kind: 'tool', name: 'Grep', args: { pattern: 'parseSortKey', glob: 'src/**/*.js', output_mode: 'content' }, approval: 'none' },
        {
          kind: 'think',
          ms: 1800,
          text:
            '`DIRS.includes(dir)` rejects "ASC", so the route throws on `?sort=title:ASC`. Two options: normalise at the caller in routes.js, or normalise inside parseSortKey. The function already owns the `recent` → `updated_at` mapping, so normalisation belongs there — one change instead of three, and the test expects exactly that.',
        },
        {
          kind: 'text',
          md: `Found it. \`src/util/sort.js:11\` lowercases nothing, so \`ASC\` reaches \`DIRS.includes(dir)\` and throws:

\`\`\`js
const dir = rawDir ?? 'desc';   // "ASC" survives, validation rejects it
\`\`\`

The field is already case-mapped two lines above, so the direction belongs here too — normalising at the callers in \`routes.js\` would leave the same trap for the next caller.`,
        },
        {
          kind: 'todos',
          items: [
            { content: 'Reproduce the failure', status: 'completed' },
            { content: 'Trace root cause to src/util/sort.js', status: 'completed' },
            { content: 'Normalise sort direction case-insensitively', status: 'in_progress' },
            { content: 'Add a regression test for mixed case', status: 'pending' },
            { content: 'Re-run the full suite + lint', status: 'pending' },
          ],
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          note: 'One-line root-cause fix',
          args: editFrom(
            'src/util/sort.js',
            /const dir = rawDir \?\? 'desc';/,
            "const dir = (rawDir ?? 'desc').toLowerCase();",
          ),
        },
        { kind: 'text', md: 'Now a regression test so this stays fixed, covering both casing and the default.' },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: {
            file_path: 'tests/sort.test.js',
            old_string: `test('unknown field throws', () => {`,
            new_string: `test('mixed-case direction defaults are normalized too', () => {
  assert.deepEqual(parseSortKey('title:DeSc'), { field: 'title', dir: 'desc' });
  assert.deepEqual(parseSortKey('UPDATED_AT'), { field: 'updated_at', dir: 'desc' });
});

test('unknown field throws', () => {`,
          },
        },
        { kind: 'tool', name: 'Bash', args: { command: 'npm test', description: 'Verify the fix' }, approval: 'auto' },
        { kind: 'tool', name: 'Bash', args: { command: 'npm run lint', description: 'Lint check' }, approval: 'auto' },
        {
          kind: 'text',
          md: (c) => `Green: **${c.tests().pass} tests, ${c.tests().fail} failure${c.tests().fail === 1 ? '' : 's'}** (the run before the fix: 6 with 1 failing). Lint is clean.

**Root cause:** \`parseSortKey\` mapped the field but passed the direction through unchanged, so \`?sort=title:ASC\` threw \`unknown sort direction\` in production — the client-visible bug was \`/api/mixtapes\` 500-ing for any capitalized sort.

**Changes**
- \`src/util/sort.js\` — lowercase the direction before validation
- \`tests/sort.test.js\` — regression test for mixed case + default direction

Nothing else calls \`parseSortKey\`, so no other call sites need updating. Want me to commit this as \`fix(sort): normalize direction casing before validation\`?`,
        },
        {
          kind: 'todos',
          items: [
            { content: 'Reproduce the failure', status: 'completed' },
            { content: 'Trace root cause to src/util/sort.js', status: 'completed' },
            { content: 'Normalise sort direction case-insensitively', status: 'completed' },
            { content: 'Add a regression test for mixed case', status: 'completed' },
            { content: 'Re-run the full suite + lint', status: 'completed' },
          ],
        },
      );
      return steps;
    },
  },

  // ------------------------------------------------------------------ security
  {
    id: 'security',
    label: 'Audit for injection bugs',
    match: (p) => re('security|inject|xss|vuln|audit|sanitiz|unsafe|exploit').test(p),
    plan(ctx) {
      const store = ctx.vfs.files['src/store.js'] ?? '';
      const fixed = /\?\s*,?\s*\[/.test(store) || /bind\(/.test(store) || /params/.test(store);
      if (fixed) {
        return [
          { kind: 'tool', name: 'Grep', args: { pattern: "VALUES \\(|SELECT .* \\$\\{", glob: 'src/**/*.js', output_mode: 'content' }, approval: 'none' },
          {
            kind: 'text',
            md: `No string interpolation reaches \`db.run\`/\`db.get\` anymore — \`src/store.js\` binds parameters now. Remaining notes from the earlier pass:

- \`src/util/sort.js\` is still the guard that makes \`ORDER BY\` safe; keep the allowlist in sync if new fields are added
- \`readBody\` in \`src/routes.js\` caps at 1 MB — worth promoting to a constant if you raise it

Want me to add an \`asks\` rule so a future edit that reintroduces interpolation gets flagged?`,
          },
        ];
      }
      return [
        {
          kind: 'think',
          ms: 2100,
          text:
            'Audit scope: untrusted input reaching a sink. Sinks here are SQL strings, HTML output, and the filesystem. Start with the query builders, then check the renderer for escaping. I want to enumerate call sites, not grep for one pattern, so I do not miss a second sink.',
        },
        { kind: 'text', md: 'I will trace every place untrusted input reaches a sink: SQL, HTML, and file paths.' },
        { kind: 'tool', name: 'Read', args: { file_path: 'src/store.js' }, approval: 'none' },
        { kind: 'tool', name: 'Read', args: { file_path: 'src/render.js' }, approval: 'none' },
        { kind: 'tool', name: 'Grep', args: { pattern: 'db\\.(run|get|all)\\(`', glob: 'src/**/*.js', output_mode: 'content' }, approval: 'none' },
        {
          kind: 'think',
          ms: 1500,
          text:
            'createMixtape interpolates title and byline straight into the INSERT — classic SQL injection through the POST body, and it is reachable unauthenticated. getMixtape interpolates a sha1 hex digest, so it is not injectable, but it should still be parameterised for consistency. render.js escapes, so HTML is fine.',
        },
        {
          kind: 'text',
          md: `## Findings

**1. SQL injection — \`src/store.js:26\` (high, reachable unauthenticated)**

\`createMixtape\` interpolates the POST body into the \`INSERT\`:

\`\`\`js
\`INSERT INTO mixtapes (slug_hash, title, byline) VALUES (\${slug}, '\${title}', '\${byline}')\`
\`\`\`

A \`byline\` of \`x'), (SELECT sql FROM sqlite_master)--\` executes arbitrary SQL. \`docs/ARCHITECTURE.md\` claims all queries are validated, which is true for \`ORDER BY\` but not here.

**2. Slug is not persisted — \`src/store.js:31\` (medium, logic)**

The insert writes \`slug_hash\` but \`createMixtape\` returns \`{ slug: title }\`, so the client gets the raw title back and \`GET /m/:slug\` will 404 for anything with a space or apostrophe.

**3. \`getMixtape\` interpolation (low)**

Hashing makes it non-injectable, but it is one refactor away from becoming injectable.

Escaping in \`src/render.js\` looks correct — \`escapeHtml\` covers \`& < > "\` for every user field.

Fixing 1 and 2 now with parameter binding, which needs no dependency:`,
        },
        {
          kind: 'todos',
          items: [
            { content: 'Parameterize createMixtape INSERTs', status: 'in_progress' },
            { content: 'Parameterize getMixtape lookup', status: 'pending' },
            { content: 'Return the real slug from create', status: 'pending' },
            { content: 'Add an injection regression test', status: 'pending' },
            { content: 'Correct ARCHITECTURE.md claim', status: 'pending' },
          ],
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          note: 'bind parameters instead of interpolating',
          args: editFrom(
            'src/store.js',
            /export async function createMixtape[\s\S]*?\n\}/,
            `export async function createMixtape(db, { title, byline, tracks = [] }) {
  const slug = slugify(title);
  const id = await db.run(
    'INSERT INTO mixtapes (slug_hash, title, byline) VALUES (?, ?, ?)',
    [hashSlug(slug), title, byline]
  );
  for (const [i, t] of tracks.entries()) {
    await db.run(
      'INSERT INTO tracks (mixtape_id, position, title, artist, path) VALUES (?, ?, ?, ?, ?)',
      [id, i, t.title, t.artist, t.path]
    );
  }
  return { slug, id, tracks: tracks.length };
}`,
          ),
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: editFrom(
            'src/store.js',
            /export async function getMixtape[\s\S]*?\n\}/,
            `export async function getMixtape(db, slug) {
  const row = await db.get('SELECT * FROM mixtapes WHERE slug_hash = ?', [hashSlug(slug)]);
  if (!row) return null;
  const tracks = await db.all(
    'SELECT position, title, artist, path FROM tracks WHERE mixtape_id = ? ORDER BY position',
    [row.id]
  );
  return { slug, title: row.title, byline: row.byline, tracks };
}`,
          ),
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          note: 'import slugify alongside hashSlug',
          args: editFrom('src/store.js', /import \{ hashSlug \} from '\.\/util\/slug\.js';/, "import { hashSlug, slugify } from './util/slug.js';"),
        },
        {
          kind: 'tool',
          name: 'Write',
          approval: 'ask',
          args: {
            file_path: 'tests/injection.test.js',
            content: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const store = await readFile(new URL('../src/store.js', import.meta.url), 'utf8');

test('no user input is interpolated into SQL', () => {
  const interpolated = [...store.matchAll(/\\$\\{[^}]*(title|byline|path|artist)[^}]*\\}/g)];
  assert.deepEqual(interpolated, [], 'found template interpolation in a SQL string');
});

test('write paths use bound parameters', () => {
  assert.match(store, /VALUES \\(\\?, \\?, \\?\\)/);
  assert.match(store, /VALUES \\(\\?, \\?, \\?, \\?, \\?\\)/);
});

test('slug returned to the client is the stored slug', () => {
  assert.doesNotMatch(store, /return \\{ slug: title/);
});
`,
          },
        },
        { kind: 'tool', name: 'Bash', args: { command: 'npm test', description: 'Run suite incl. new injection tests' }, approval: 'auto' },
        {
          kind: 'text',
          md: (c) => {
            const t = c.tests();
            const note = t.fail
              ? `\n\nNote: \`tests/sort.test.js\` still has the pre-existing direction-casing failure — unrelated to this change, but CI stays red until that one lands.`
              : '';
            return `**${t.pass} tests, ${t.fail} failure${t.fail === 1 ? '' : 's'}.**${note} Both \`db.run\` calls bind parameters, the lookup is parameterised, and \`createMixtape\` now returns the same \`slug\` the lookup expects.

One thing I did **not** change: \`docs/ARCHITECTURE.md\` still says queries are validated rather than bound, which is what let this slip past review. Say the word and I will correct the doc, and open a follow-up for rate limiting on \`POST /api/mixtapes\` — the injection is fixed but the endpoint is still unauthenticated and will happily burn CPU parsing 1 MB bodies.`;
          },
        },
        {
          kind: 'todos',
          items: [
            { content: 'Parameterize createMixtape INSERTs', status: 'completed' },
            { content: 'Parameterize getMixtape lookup', status: 'completed' },
            { content: 'Return the real slug from create', status: 'completed' },
            { content: 'Add an injection regression test', status: 'completed' },
            { content: 'Correct ARCHITECTURE.md claim', status: 'pending' },
          ],
        },
      ];
    },
  },

  // ------------------------------------------------------------------ explain
  {
    id: 'explain',
    label: 'Explain the codebase',
    match: (p) => re('explain|overview|walk me through|how does|what does|structure|onboard|architecture|read this (repo|codebase)').test(p),
    plan(ctx) {
      return [
        { kind: 'text', md: 'Let me get the shape of the repo before reading anything specific.' },
        { kind: 'tool', name: 'Bash', args: { command: 'ls -la', description: 'List repo root' }, approval: 'none' },
        { kind: 'tool', name: 'Read', args: { file_path: 'package.json' }, approval: 'none' },
        { kind: 'tool', name: 'Read', args: { file_path: 'src/routes.js' }, approval: 'none' },
        { kind: 'tool', name: 'Read', args: { file_path: 'docs/ARCHITECTURE.md' }, approval: 'none' },
        {
          kind: 'text',
          md: `## pocketmix

A ~500 line HTTP service: mixtapes go in, server-rendered HTML comes out. No framework, no ORM, one SQLite file.

**Request path**

\`\`\`
client → server.js → routes.js ─┬─→ store.js → sqlite (src/db.js)
                                 └─→ render.js → html
\`\`\`

**Modules**

| File | Responsibility | Notes |
|---|---|---|
| src/server.js | boot, port, structured log | \`node --watch\` in dev |
| src/routes.js | hand-rolled routing + body parsing | 1 MB body cap |
| src/store.js | SQL queries | string-built queries — see below |
| src/render.js | HTML templates | escapes all user text |
| src/util/sort.js | sort-key allowlist | the only validation layer |

**How it hangs together**

- Routing is a \`switch\` on \`url.pathname\` with one regex for \`/m/:slug\`. Adding a route means touching \`routes.js\`; there is no registry.
- \`parseSortKey\` is the safety boundary for \`ORDER BY\`: an allowlist of three fields and two directions. Because \`listMixtapes\` interpolates its result, **any relaxation there is a SQL injection**, not just a bad sort.
- \`slug_hash\` (sha1, 16 chars) is the primary lookup key; the human slug is not stored, which is why \`createMixtape\` returning \`{ slug: title }\` will not round-trip through \`GET /m/:slug\`.
- Tests run on \`node --test\`, no runner dependency, and assert against pure functions only — nothing touches SQLite.

**Where I would look first if you are onboarding**

1. \`src/routes.js\` for the request contract
2. \`src/store.js\` for the query assumptions
3. \`tests/sort.test.js\` for the intended behaviour of the sort parser

Want me to trace one request end to end, or dig into \`store.js\`?`,
        },
      ];
    },
  },

  // ------------------------------------------------------------------ feature
  {
    id: 'feature',
    label: 'Add a feature',
    match: (p) => re('add |implement|build|introduc|support|rate limit|cache|retry|validat|endpoint|pagin').test(p),
    plan(ctx) {
      const wantsLimit = re('rate.?limit|throttl|429').test(ctx.prompt);
      const wantsCache = re('cache|etag|memo').test(ctx.prompt);
      const wantsPaginate = re('paginat|page|offset|cursor').test(ctx.prompt);
      if (wantsCache) {
        return [
          { kind: 'think', ms: 1700, text: 'A caching layer for /m/:slug. The render is deterministic given the row, so an ETag over the serialized mixtape is cheap and correct without inventing an invalidation policy.' },
          { kind: 'text', md: 'Cheapest correct win here is conditional GETs — content-hash ETags, \`304\` on match — because the rendered page only changes when the row changes.' },
          { kind: 'tool', name: 'Read', args: { file_path: 'src/routes.js' }, approval: 'none' },
          {
            kind: 'tool',
            name: 'Write',
            approval: 'ask',
            args: {
              file_path: 'src/util/etag.js',
              content: `import { createHash } from 'node:crypto';

/** Strong ETag over the rendered body; 12 hex chars is plenty for per-page caching. */
export function etagFor(body) {
  return '"' + createHash('sha256').update(body).digest('hex').slice(0, 12) + '"';
}

export function isFresh(ifNoneMatch, etag) {
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(',')
    .map((v) => v.trim().replace(/^W\\//, ''))
    .includes(etag);
}
`,
            },
          },
          {
            kind: 'tool',
            name: 'Edit',
            approval: 'ask',
            args: editFrom(
              'src/routes.js',
              /    res\.setHeader\('content-type', 'text\/html; charset=utf-8'\);\n    res\.end\(renderMixtapePage\(mixtape\)\);/,
              `    const html = renderMixtapePage(mixtape);
    const etag = etagFor(html);
    res.setHeader('etag', etag);
    res.setHeader('cache-control', 'private, max-age=0, must-revalidate');
    if (isFresh(req.headers['if-none-match'], etag)) {
      res.statusCode = 304;
      return res.end();
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html);`,
            ),
          },
          {
            kind: 'tool',
            name: 'Edit',
            approval: 'ask',
            args: editFrom('src/routes.js', /import \{ parseSortKey \} from '\.\/util\/sort\.js';/, "import { parseSortKey } from './util/sort.js';\nimport { etagFor, isFresh } from './util/etag.js';"),
          },
          { kind: 'tool', name: 'Write', approval: 'ask', args: { file_path: 'tests/etag.test.js', content: `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { etagFor, isFresh } from '../src/util/etag.js';\n\ntest('same body yields same etag', () => {\n  assert.equal(etagFor('<h1>a</h1>'), etagFor('<h1>a</h1>'));\n});\n\ntest('weak validators still match', () => {\n  const tag = etagFor('x');\n  assert.ok(isFresh('W/' + tag, tag));\n});\n\ntest('missing header is never fresh', () => {\n  assert.ok(!isFresh(undefined, '"abc"'));\n});\n` } },
          { kind: 'tool', name: 'Bash', args: { command: 'npm test && npm run lint', description: 'Run tests and lint' }, approval: 'auto' },
          {
            kind: 'text',
            md: `Done. \`/m/:slug\` now emits \`ETag\` + \`must-revalidate\` and answers \`304\` before touching HTML, and there are three tests covering weak validators and the missing-header case.

Notes:
- I used a **strong** ETag over the final HTML rather than \`updated_at\`, so a same-second edit cannot serve stale markup
- The hash costs one \`sha256\` per request; if that ever matters, memoise on \`row.id + updated_at\`
- \`/api/mixtapes\` is untouched — JSON caching needs a client contract decision, not a code change

Nothing is committed. \`git diff --stat\` shows 3 files; want me to commit as \`feat(web): conditional GET for mixtape pages\`?`,
          },
        ];
      }
      if (wantsPaginate) {
        return [
          { kind: 'text', md: '`/api/mixtapes` currently hard-caps at 50 with no way to go deeper. Checking the query shape.' },
          { kind: 'tool', name: 'Read', args: { file_path: 'src/store.js', limit: 22 }, approval: 'none' },
          {
            kind: 'text',
            md: `Keyset pagination is the right call over \`OFFSET\` here — \`updated_at\` is not unique, so offset paging will skip or repeat rows when timestamps tie. Two changes:

\`\`\`js
// src/store.js
const where = after ? 'WHERE (updated_at, id) < (?, ?)' : '';
// routes.js
const after = url.searchParams.get('after');
\`\`\`

Plus a \`next_cursor\` in the response built from the last row — implementing it now; say the word if you would rather have offset paging for an admin table with page numbers.`,
          },
          {
          kind: 'todos',
          items: [
            { content: 'Read the current query shape', status: 'completed' },
            { content: 'Keyset paging in listMixtapes', status: 'in_progress' },
            { content: 'Accept after/limit in routes.js', status: 'pending' },
            { content: 'Return next_cursor', status: 'pending' },
            { content: 'Cover ties with a test', status: 'pending' },
          ],
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: editFrom(
            'src/store.js',
            /export async function listMixtapes\(db, \{ sort, limit = 50 \}\) \{[\s\S]*?\n\}/,
            'export function encodeCursor(row) {\n  return Buffer.from(JSON.stringify([row.updated_at, row.id])).toString("base64url");\n}\n\n/** A hand-edited cursor should page from the start, not throw. */\nexport function parseCursor(value) {\n  if (!value) return null;\n  try {\n    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString());\n    return Array.isArray(parsed) && parsed.length === 2 ? parsed : null;\n  } catch {\n    return null;\n  }\n}\n\nexport async function listMixtapes(db, { sort, limit = 20, after = null }) {\n  const order = `${sort.field} ${sort.dir}`;\n  const cursor = parseCursor(after);\n  const where = cursor ? `WHERE (updated_at, id) < (\\${cursor[0]}, \\${cursor[1]})` : "";\n  const rows = await db.all(\n    `SELECT slug, title, byline, updated_at, id FROM mixtapes ${where} ORDER BY ${order} LIMIT ${Math.min(limit, 100)}`\n  );\n  return {\n    items: rows,\n    next_cursor: rows.length === Math.min(limit, 100) ? encodeCursor(rows[rows.length - 1]) : null,\n  };\n}',
          ),
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: editFrom(
            'src/routes.js',
            /    const sort = parseSortKey\(url\.searchParams\.get\('sort'\) \?\? 'recent'\);[\s\S]*?return json\(res, 200, \{ items, sort \}\);/,
            "    const sort = parseSortKey(url.searchParams.get('sort') ?? 'recent');\n    const limit = Number(url.searchParams.get('limit') ?? 20);\n    const page = await listMixtapes(db, { sort, limit, after: url.searchParams.get('after') });\n    return json(res, 200, { ...page, sort });",
          ),
        },
        {
          kind: 'tool',
          name: 'Write',
          approval: 'ask',
          args: {
            file_path: 'tests/paging.test.js',
            content:
              "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { encodeCursor, parseCursor } from '../src/store.js';\n\ntest('a cursor round-trips through base64url', () => {\n  const cur = encodeCursor({ updated_at: '2024-01-01T00:00:00Z', id: 7 });\n  assert.deepEqual(parseCursor(cur), ['2024-01-01T00:00:00Z', 7]);\n});\n\ntest('a garbage cursor pages from the start instead of throwing', () => {\n  assert.equal(parseCursor('###not-base64###'), null);\n  assert.equal(parseCursor(null), null);\n});\n",
          },
        },
        { kind: 'tool', name: 'Bash', args: { command: 'npm test', description: 'Run the suite' }, approval: 'auto' },
        {
          kind: 'text',
          md: (ctx) => `Implemented. \`listMixtapes\` now returns \`{ items, next_cursor }\`, \`GET /api/mixtapes\` takes \`?after=&limit=\`, and the cursor is a base64url \`(updated_at, id)\` pair so ties cannot skip or repeat rows. \`parseCursor\` swallows garbage instead of throwing, which keeps a hand-edited URL from 500ing.

${ctx.tests().fail ? `One caveat: the suite is still red on \`tests/sort.test.js\` — that is the pre-existing sort-direction bug, nothing to do with paging. Want me to fix it on this branch?

` : ''}Two things I deliberately left: \`?offset=\` is now ignored rather than deleted — removing it is a breaking change for the admin table — and the response shape changed from \`{ mixtapes }\` to \`{ items, next_cursor }\`, so say the word if you want me to keep the old key alongside it for a release.`,
        },
      ];
    }
      const limitTarget = wantsLimit ? 'rate limiting' : 'the change';
      return [
        { kind: 'think', ms: 1900, text: `${limitTarget}: start at the edge the traffic crosses, which is readBody in routes.js. A token bucket in memory is enough for a single-process app; adding Redis would be speculative generality since there is no cluster. ` },
        { kind: 'text', md: `For ${limitTarget} the only place worth touching is the request entry point, so let me read it and check whether a limiter already exists.` },
        { kind: 'tool', name: 'Grep', args: { pattern: 'limit|throttle|retry|bucket', glob: 'src/**/*.js', output_mode: 'content' }, approval: 'none' },
        { kind: 'tool', name: 'Read', args: { file_path: 'src/routes.js' }, approval: 'none' },
        {
          kind: 'text',
          md: `No existing limiter, and \`routes.js\` is a single \`router\` function, which is where the check belongs. Plan:

1. \`src/util/bucket.js\` — token bucket, no deps, keyed by \`remoteAddress\`
2. \`src/routes.js\` — reject before body parsing, so rejected requests do not allocate strings
3. \`429\` + \`retry-after\` header, and a test that a fresh bucket admits 30 writes and denies the 31st

Two decisions I am making, flag if you disagree:
- **POST only.** GETs are cacheable and cheap; limiting them would need ETags first
- **In-memory.** Wrong across restarts and multi-process, but correct for \`npm run dev\` and one production box`,
        },
        {
          kind: 'tool',
          name: 'Write',
          approval: 'ask',
          args: {
            file_path: 'src/util/bucket.js',
            content: `const buckets = new Map();

const REFILL_PER_MS = 30 / 60_000; // 30 writes per minute
const CAPACITY = 30;

/** Token bucket per client. Returns { allowed, retryAfterMs }. */
export function take(ip, cost = 1, now = Date.now()) {
  const b = buckets.get(ip) ?? { tokens: CAPACITY, at: now };
  b.tokens = Math.min(CAPACITY, b.tokens + (now - b.at) * REFILL_PER_MS);
  b.at = now;
  if (b.tokens < cost) {
    buckets.set(ip, b);
    return { allowed: false, retryAfterMs: Math.ceil(((cost - b.tokens) / REFILL_PER_MS)) };
  }
  b.tokens -= cost;
  buckets.set(ip, b);
  return { allowed: true, retryAfterMs: 0 };
}

export function _reset() {
  buckets.clear();
}
`,
          },
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: editFrom(
            'src/routes.js',
            /  if \(url\.pathname === '\/api\/mixtapes' && req\.method === 'POST'\) \{\n    const body = await readBody\(req\);/,
            `  if (url.pathname === '/api/mixtapes' && req.method === 'POST') {
    const budget = take(req.socket?.remoteAddress ?? 'unknown');
    if (!budget.allowed) {
      res.setHeader('retry-after', String(Math.ceil(budget.retryAfterMs / 1000)));
      return json(res, 429, { error: 'rate_limited' });
    }
    const body = await readBody(req);`,
          ),
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: editFrom('src/routes.js', /import \{ etagFor, isFresh \} from '\.\/util\/etag\.js';/, "import { take } from './util/bucket.js';"),
        },
        {
          kind: 'tool',
          name: 'Write',
          approval: 'ask',
          args: {
            file_path: 'tests/bucket.test.js',
            content: `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { take, _reset } from '../src/util/bucket.js';\n\ntest('admits 30 writes then denies the 31st', () => {\n  _reset();\n  for (let i = 0; i < 30; i++) assert.ok(take('1.2.3.4').allowed, \`request \${i}\`);\n  assert.ok(!take('1.2.3.4').allowed);\n});\n\ntest('clients are isolated', () => {\n  _reset();\n  for (let i = 0; i < 30; i++) take('1.2.3.4');\n  assert.ok(take('5.6.7.8').allowed);\n});\n\ntest('bucket refills over time', () => {\n  _reset();\n  const t0 = 1_700_000_000_000;\n  for (let i = 0; i < 30; i++) take('1.2.3.4', 1, t0);\n  assert.ok(!take('1.2.3.4', 1, t0 + 1000).allowed);\n  assert.ok(take('1.2.3.4', 1, t0 + 61_000).allowed);\n});\n`,
          },
        },
        { kind: 'tool', name: 'Bash', args: { command: 'npm test', description: 'Run the suite' }, approval: 'auto' },
        {
          kind: 'text',
          md: (c) => `Written. Tests: **${c.tests().pass} pass, ${c.tests().fail} fail** — including the refill boundary at 61s.

\`npm run lint\` is clean. Two things I want to be straight with you about:

- **Imports:** I placed the limiter import where an \`etag\` import may or may not exist depending on whether you applied the caching change earlier. If lint flags an unused or missing import, that is why.
- **Not committed, not deployed.** No config knob yet: capacity and window are constants in \`bucket.js\`. Say the word and I will lift them to env vars (\`RATE_LIMIT_BURST\`, \`RATE_LIMIT_WINDOW\`).

\`scripts/deploy.sh\` runs \`npm test\` before rsync, so this ships through the normal path once committed.`,
        },
      ];
    },
  },

  // ------------------------------------------------------------------ refactor
  {
    id: 'refactor',
    label: 'Refactor a module',
    match: (p) => re('refactor|clean\s?up|simplify|split |extract|dedup|restructur|modular').test(p),
    plan(ctx) {
      return [
        { kind: 'text', md: 'Before proposing a split I want the current coupling: what imports what, and how big each file actually is.' },
        { kind: 'tool', name: 'Bash', args: { command: 'wc -l src/*.js src/util/*.js', description: 'Line counts per module' }, approval: 'none' },
        { kind: 'tool', name: 'Grep', args: { pattern: "^import .+ from '\\.\\/", glob: 'src/**/*.js', output_mode: 'content' }, approval: 'none' },
        { kind: 'tool', name: 'Read', args: { file_path: 'src/routes.js' }, approval: 'none' },
        {
          kind: 'think',
          ms: 1600,
          text:
            'routes.js does four things: route matching, body parsing, JSON responses, and HTML rendering decisions. The body parser and the matcher are separable. I want to avoid inventing a framework — the win is testability of readBody and the matcher, not indirection.',
        },
        {
          kind: 'text',
          md: `**Current shape**

\`\`\`
routes.js  58  ├─ imports: store, render, http, util/sort
store.js   33  ├─ imports: util/slug
render.js  22  └─ imports: http
\`\`\`

\`src/routes.js\` is the only file doing more than one job. It mixes matching, body parsing and response shaping in one 58-line function. Proposal — two extractions, no new abstractions:

1. \`src/http.js\` gains \`readJson(req, {limit})\` (it already owns response helpers, so the request side belongs there)
2. \`src/routes.js\` becomes a table of \`[method, pattern, handler]\` tuples, which makes \`/api/mixtapes\` testable without a socket

I would **not** add a router class, middleware, or a DI container: at 16 files that is ceremony you pay for forever.

Applying both, and the tests should stay green untouched — that is the check that this is behaviour-preserving.`,
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: editFrom(
            'src/http.js',
            /export function escapeHtml/,
            `const MAX_BODY = 1_000_000;

/** Read and parse a JSON request body, rejecting anything over 1 MB. */
export async function readJson(req, { limit = MAX_BODY } = {}) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw new Error('body_too_large');
  }
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('body_not_json');
  }
}

export function escapeHtml`,
          ),
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: editFrom(
            'src/routes.js',
            /import \{ json \} from '\.\/http\.js';/,
            "import { json, readJson } from './http.js';",
          ),
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: editFrom(
            'src/routes.js',
            /  if \(url\.pathname === '\/api\/mixtapes' && req\.method === 'POST'\) \{\n    const body = await readBody\(req\);\n    const created = await createMixtape\(db, body\);\n    return json\(res, 201, created\);\n  \}/,
            `  if (url.pathname === '/api/mixtapes' && req.method === 'POST') {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      const tooBig = err.message === 'body_too_large';
      return json(res, tooBig ? 413 : 400, { error: err.message });
    }
    const created = await createMixtape(db, body);
    return json(res, 201, created);
  }`,
          ),
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          note: 'delete the now-duplicated local parser',
          args: editFrom(
            'src/routes.js',
            /\nasync function readBody\(req\) \{[\s\S]*?\n\}\n/,
            '\n',
          ),
        },
        { kind: 'tool', name: 'Bash', args: { command: 'npm test && npm run lint', description: 'Confirm behaviour preserved' }, approval: 'auto' },
        {
          kind: 'text',
          md: (ctx) => {
            const t = ctx.tests();
            const status = t.fail
              ? `${t.fail === 1 ? '1 of ' + (t.pass + t.fail) + ' test is' : t.fail + ' of ' + (t.pass + t.fail) + ' tests are'} still red — that is the pre-existing \`parseSortKey\` direction case, which this refactor does not touch. Lint is clean.`
              : 'Suite green, lint clean.';
            return `${status}

\`routes.js\` dropped 6 lines while gaining a real error path:

| Before | After |
|---|---|
| \`readBody\` in routes.js, throws raw \`SyntaxError\` → 500 | \`readJson\` in http.js → \`400 body_not_json\` |
| oversized body → unhandled throw | → \`413 body_too_large\` |

That is the payoff I was after: parsing was untested and returned 500s on malformed JSON. Now it is one function in \`http.js\` sitting next to the response helpers, with the failure modes named.

Left alone on purpose: \`store.js\` query strings, and the regex route matcher — a table-driven router for three routes is a wash. Commit as \`refactor(http): move body parsing out of the router\`?`;
          },
        },
      ];
    },
  },

  // ------------------------------------------------------------------ docs
  {
    id: 'docs',
    label: 'Write or update documentation',
    match: (p) => re('readme|document|docstring|docs?\\b|changelog|jsdoc|comment').test(p),
    plan(ctx) {
      return [
        { kind: 'text', md: 'Reading what is there now so I document this repo rather than a generic one.' },
        { kind: 'tool', name: 'Read', args: { file_path: 'README.md' }, approval: 'none' },
        { kind: 'tool', name: 'Glob', args: { pattern: 'docs/**' }, approval: 'none' },
        { kind: 'tool', name: 'Read', args: { file_path: 'src/routes.js', limit: 30 }, approval: 'none' },
        {
          kind: 'think',
          ms: 1400,
          text:
            'The README documents /api/mixtapes but not error shapes, and never mentions the sort-key allowlist — the one contract a caller can actually break. Keep the voice imperative and short; this is a setup doc, not a spec.',
        },
        {
          kind: 'text',
          md: `The README is honest but incomplete: no error bodies, no mention that \`sort\` only accepts three fields, and \`POST\` has no example. Writing those three, keeping the existing structure and voice.`,
        },
        {
          kind: 'tool',
          name: 'Write',
          approval: 'ask',
          args: {
            file_path: 'README.md',
            content: `# pocketmix

Offline-first mixtape builder. Tracks in, web page out.

## Running locally

\`\`\`bash
npm install
npm run dev      # watch mode, http://localhost:8787
npm test         # node --test, no runner dependency
\`\`\`

Open http://localhost:8787/m/late-night-drive

## API

| Route | Method | Notes |
|---|---|---|
| \`/api/mixtapes\` | GET | list, \`?sort=\` and \`limit\` capped at 50 |
| \`/api/mixtapes\` | POST | create; JSON body, 1 MB max |
| \`/m/:slug\` | GET | server-rendered page |
| \`/healthz\` | GET | \`{ "ok": true }\` |

### Sorting

\`sort\` takes an optional \`field:direction\`. Only these are accepted —
anything else is a \`400\`, by design, because the value reaches \`ORDER BY\`:

\`\`\`text
fields      recent (→ updated_at), title, created_at
directions  asc, desc          (case insensitive)
examples    ?sort=title         ?sort=title:asc
\`\`\`

### Errors

Every failure is JSON, never HTML:

\`\`\`json
{ "error": "no_route" }
\`\`\`

| Status | Body | When |
|---|---|---|
| 400 | \`body_not_json\` | unparseable POST body |
| 404 | \`not_found\` | unknown \`/m/:slug\` |
| 413 | \`body_too_large\` | over 1 MB |
| 400 | \`unknown sort field\` | \`sort\` not on the allowlist |

### Creating a mixtape

\`\`\`bash
curl -s localhost:8787/api/mixtapes \\
  -H 'content-type: application/json' \\
  -d '{"title":"Late Night Drive","byline":"t","tracks":[
        {"title":"Interior Traffic","artist":"Boards of Canada","path":"/m/x.mp3"}]}'
\`\`\`

Returns \`201\` with \`{ slug, tracks }\`. Track \`position\` is the array index;
do not sort client-side.

## Layout

    src/server.js   boot, listen
    src/routes.js   routing, body parsing
    src/store.js    SQL (string-built — see docs/ARCHITECTURE.md)
    src/render.js   HTML, escapes all user text
    src/util/       sort allowlist, slug hashing, structured log

See \`docs/ARCHITECTURE.md\` for the storage and escaping rules.
`,
          },
        },
        { kind: 'tool', name: 'Bash', args: { command: 'git diff --stat', description: 'Confirm only docs changed' }, approval: 'none' },
        {
          kind: 'text',
          md: `Rewrote \`README.md\` (+41/−6). Everything documented is verified against the source:

- status codes read off \`routes.js\`, not invented — \`413\` and \`body_not_json\` exist
- the \`sort\` allowlist is the three fields in \`FIELDS\`
- the \`position\` warning reflects \`createMixtape\` using the array index

I deliberately left out a "contributing" section and the deploy steps — \`scripts/deploy.sh\` is three lines and lives better as a comment there than as docs that drift.

One real gap: \`docs/ARCHITECTURE.md\` says the \`ORDER BY\` value "can never contain arbitrary user text", which is only true because of the allowlist. Want me to link the two so the constraint is discoverable from the file that could break it?`,
        },
      ];
    },
  },

  // ------------------------------------------------------------------ git
  {
    id: 'git',
    label: 'Commit and push',
    match: (p) => re('commit|push\\b|merge|branch|pull request|\\bpr\\b|tag|release').test(p),
    plan(ctx) {
      const dirty = [...(ctx.vfs.dirty ?? [])];
      if (!dirty.length) {
        return [
          { kind: 'tool', name: 'Bash', args: { command: 'git status', description: 'Working tree' }, approval: 'none' },
          {
            kind: 'text',
            md: `Working tree is clean — nothing staged, nothing modified, and \`main\` matches \`origin/main\`. Nothing to commit.

If you expected changes here, they may be in a different worktree, or the edits were rolled back. I can show \`git log -3\` or diff against \`origin/main\` to check.`,
          },
        ];
      }
      const added = dirty.reduce((n, f) => n + (ctx.vfs.files[f] ?? '').split('\n').length, 0);
      return [
        { kind: 'text', md: 'Let me look at what is actually staged before writing a message.' },
        { kind: 'tool', name: 'Bash', args: { command: 'git status', description: 'Working tree' }, approval: 'none' },
        { kind: 'tool', name: 'Bash', args: { command: 'git diff', description: 'Unstaged diff' }, approval: 'none' },
        {
          kind: 'think',
          ms: 1500,
          text:
            'Two logical changes in the tree? If unrelated, they should be two commits. Here the diff is one theme, so a single commit with a body explaining why is right. Never commit files that look like secrets or generated data.',
        },
        {
          kind: 'text',
          md: `**${dirty.length} file${dirty.length === 1 ? '' : 's'} changed, ${added} lines in the working tree**

- ${dirty.map((f) => `\`${f}\``).join(', ')}

All one theme, so: one commit. No secrets or generated files in the diff (I checked for \`.env\`, \`data/\`, and lockfile churn). Tests before committing, since \`scripts/deploy.sh\` will run them anyway:`,
        },
        { kind: 'tool', name: 'Bash', args: { command: 'npm test', description: 'Verify before commit' }, approval: 'auto' },
        { kind: 'tool', name: 'Bash', args: { command: 'git add src/util/sort.js tests/sort.test.js && git commit -m "fix(sort): normalize direction casing before validation"', description: 'Stage and commit' }, approval: 'ask' },
        {
          kind: 'text',
          md: `Committed. \`git log -1\`:

\`\`\`
${'fix(sort): normalize direction casing before validation'}

parseSortKey mapped the field but passed the direction through, so
?sort=title:ASC threw "unknown sort direction" and 500'd the list
endpoint. Lowercase before validating, add a mixed-case regression
test.
\`\`\`

I have **not** pushed — you never asked me to, and \`main\` is a protected branch on this repo. Two options:

1. \`git push\` straight to \`main\`
2. branch + PR (\`git switch -c fix/sort-direction-case\`, push, then \`gh pr create\`) — which the CI in \`.github/workflows\` expects

Which do you want?`,
        },
      ];
    },
  },

  // ------------------------------------------------------------------ test gen
  {
    id: 'tests',
    label: 'Write tests',
    match: (p) => re('write.*tests?|add tests|more tests|tests for|test cov|coverage|unit test').test(p),
    plan(ctx) {
      return [
        { kind: 'text', md: 'Checking what is already covered so I only write what is missing.' },
        { kind: 'tool', name: 'Glob', args: { pattern: 'tests/*.js' }, approval: 'none' },
        { kind: 'tool', name: 'Grep', args: { pattern: "from '\\.\\./src", glob: 'tests/**/*.js', output_mode: 'content' }, approval: 'none' },
        {
          kind: 'text',
          md: `**Covered:** \`util/sort\` (4 cases), \`util/slug\` + \`store\` (2).
**Not covered at all:** \`http.js\`, \`render.js\`, \`routes.js\`, \`store.js\`.

Ranked by "cheap to test × bad if broken":

| Module | Risk | Testable without a server? |
|---|---|---|
| \`escapeHtml\` | XSS surface | yes — pure function |
| \`renderMixtapePage\` | breaks every page | yes — string in, string out |
| \`readBody\` | 500s on bad JSON | needs a fake req |
| \`store\` | SQL, injection | needs a sqlite fake |

Writing the first two properly now; the last two need a test double for \`res\`/\`db\` which is its own change. \`escapeHtml\` matters most — \`render.js\` calls it on every field, and if it ever regresses on \`'\` that is an attribute-injection hole.`,
        },
        {
          kind: 'tool',
          name: 'Write',
          approval: 'ask',
          args: {
            file_path: 'tests/render.test.js',
            content: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/http.js';
import { renderMixtapePage } from '../src/render.js';

test('escapeHtml covers the five dangerous characters', () => {
  assert.equal(escapeHtml('\`&<>"'\`'), '&amp;&lt;&gt;&quot;&#39;');
});

test('escaping is idempotent-safe for already-escaped text', () => {
  assert.equal(escapeHtml('&amp;'), '&amp;amp;');
});

test('non-string fields are coerced, not dropped', () => {
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(null), 'null');
});

test('a quote in the byline cannot break out of its attribute', () => {
  const html = renderMixtapePage({
    title: 'x',
    byline: '"><script>alert(1)</script>',
    tracks: [],
  });
  assert.ok(!html.includes('<script>'), 'raw script tag reached the document');
});

test('positions are 1-based for humans', () => {
  const html = renderMixtapePage({ title: 'a', byline: 'b', tracks: [{ position: 0, title: 'T', artist: 'A', path: '/t.mp3' }] });
  assert.match(html, /<span class="pos">1<\\/span>/);
});
`,
          },
        },
        { kind: 'tool', name: 'Bash', args: { command: 'npm test', description: 'Run the suite' }, approval: 'auto' },
        {
          kind: 'text',
          md: `Two of those fail, and they are real:

- **\`escapeHtml\` does not escape \`'\`.** \`src/render.js\` only emits text nodes and a \`<title>\`, so it is safe *today* — but the moment someone puts a user field inside \`onclick="...'\${x}'"\` this is XSS. Either add \`' → &#39;\` to the escape or never use it in attributes. I would add the rule and be done.
- **\`positions are 1-based\` passes** — \`render.js:8\` already does \`t.position + 1\`. Kept the test as a guard.

Fixing the first one is a one-line change to \`src/http.js\`, but it changes an escaping contract that \`ARCHITECTURE.md\` documents, so I stopped and asked instead of editing. Want the fix + doc line, or a lint rule banning \`escapeHtml\` inside quotes?`,
        },
      ];
    },
  },

  // ------------------------------------------------------------------ perf
  {
    id: 'perf',
    label: 'Investigate performance',
    match: (p) => re('slow|perf|latency|profil|memory|n+1|optimi|timeout|hang').test(p),
    plan(ctx) {
      return [
        { kind: 'think', ms: 1500, text: 'Do not guess. Measure first: find where a request spends its time, and look for the classic N+1 in the tracks query.' },
        { kind: 'text', md: 'Measuring before guessing. First: where does a \`/m/:slug\` request spend its time?' },
        { kind: 'tool', name: 'Read', args: { file_path: 'src/store.js', limit: 14 }, approval: 'none' },
        { kind: 'tool', name: 'Grep', args: { pattern: 'for (const|await db\\.', glob: 'src/**/*.js', output_mode: 'content' }, approval: 'none' },
        {
          kind: 'text',
          md: `**Two things show up immediately.**

1. \`createMixtape\` runs one \`INSERT\` **per track** — an N-write loop, each awaiting its own round trip. 200-track mixtape = 201 sequential statements.
2. No index on \`tracks.mixtape_id\`, so \`getMixtape\` scans the whole tracks table on every page view. That is the read path, and it is what your users feel.

Measured shape:

\`\`\`text
getMixtape   1 SELECT + 1 SELECT  → both scan   O(tracks)
createMixtape 1 + N INSERTs        → serial      O(N) round trips
\`\`\`

Fixes in order of payoff:

\`\`\`sql
CREATE INDEX IF NOT EXISTS tracks_mixtape_idx
  ON tracks (mixtape_id, position);
\`\`\`

…plus wrapping the insert loop in a single transaction, which on SQLite is a large win — each autocommit statement fsyncs.

Applying the index now (it is additive and reversible), and I would like your call on the transaction because it changes error semantics: a failed track insert currently leaves a partial mixtape, and inside a transaction it would leave nothing at all.`,
        },
        {
          kind: 'tool',
          name: 'Edit',
          approval: 'ask',
          args: editFrom('src/db.js', /  \);\n`;/, `  );
  CREATE INDEX IF NOT EXISTS tracks_mixtape_idx
    ON tracks (mixtape_id, position);
\`;`),
        },
        { kind: 'tool', name: 'Bash', args: { command: 'npm test', description: 'Ensure the schema change is harmless' }, approval: 'auto' },
        {
          kind: 'text',
          md: `Green. The index is created in \`openDb\`, which already runs \`SCHEMA\` with \`IF NOT EXISTS\`, so existing databases pick it up on next boot without a migration.

I did **not** add the transaction — that is your call above, since it changes what a half-failed create leaves behind.

Also worth knowing: the \`ORDER BY position\` in \`getMixtape\` is now covered by the composite index, so the sort is free. If you want real numbers rather than my reading of the code, I can add a tiny benchmark script that opens a temp DB, seeds 5k tracks, and times both paths — that would tell us whether the transaction is worth the semantics change.`,
        },
      ];
    },
  },
];

// ------------------------------------------------------------------ fallbacks

const SMALL_TALK = [
  {
    match: (p) => re('^(hi|hey|hello|yo|sup|good (morning|evening))\\b').test(p.trim()),
    reply: `Hey. I'm in \`~/code/pocketmix\` on \`main\`, with 16 files and a test suite that currently has one failure in \`tests/sort.test.js\`.

Some things I could do right now:
- fix that failing sort test
- audit \`store.js\` for the injection risk in the docs
- explain how the request path hangs together

Or point me at a file, a stack trace, or a GitHub issue.`,
  },
  {
    match: (p) => re('\\b(thanks|ty|cheers|appreciate|nice one|perfect)\\b').test(p.trim()) && p.length < 40,
    reply: `Anytime. Nothing is committed yet — the working tree has ${''}changes staged only in memory. Run \`git status\` through me if you want to see them, or tell me to commit.`,
  },
  {
    match: (p) => re('who are you|what are you|can you do|help$|^\\?').test(p.trim()),
    reply: `I'm Claude Code — this window is an **offline simulation** of it, so nothing I say reaches a real model or your real disk. Inside the simulation I have a working repo, a real diff engine, a test runner and git.

Try:
- \`why are the tests failing?\`
- \`do a security review of src/store.js\`
- \`explain this codebase\`
- \`add rate limiting to the POST endpoint\`
- \`write a test for render.js\`

Slash commands: \`/help\`, \`/model\`, \`/cost\`, \`/context\`, \`/compact\`, \`/init\`, \`/export\`, \`/vim\`, \`/theme\`.`,
  },
];

/**
 * Generic planner for prompts nothing matches: still does real work against the VFS so
 * the answer is grounded in the simulated repo.
 */
function planGeneric(prompt, ctx) {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 3 && !['with', 'this', 'that', 'from', 'have', 'would', 'could', 'about', 'into', 'they', 'them', 'your', 'please', 'make', 'code', 'file', 'when', 'what'].includes(w));
  const idents = prompt.match(/\b[A-Za-z_$][\w$]{2,}\b/g) ?? [];
  const mentionsFiles = (prompt.match(/[\w./-]+\.(?:js|ts|json|md|sh|yml|yaml)\b/g) ?? []).map((f) => f.replace(/^\.\//, ''));
  const candidates = [...new Set([...mentionsFiles, ...idents, ...words])];
  const hits = [];
  for (const cand of candidates) {
    const found = vfsGrepByName(ctx.vfs, cand);
    if (found.length) hits.push({ cand, found });
  }
  const touched = [...new Set(hits.flatMap((h) => h.found.map((f) => f.file)))].slice(0, 4);
  if (!touched.length) {
    const files = Object.keys(ctx.vfs.files);
    return [
      { kind: 'tool', name: 'Bash', args: { command: 'ls -la', description: 'Survey the repo' }, approval: 'none' },
      {
        kind: 'text',
        md: `I looked for anything in this prompt that maps onto the repo (${files.length} files, \`src/\`, \`tests/\`, \`docs/\`) and did not find a match, so I don't want to invent a task.

What is here:

| Area | Files |
|---|---|
| entry + routing | \`src/server.js\`, \`src/routes.js\` |
| data | \`src/db.js\`, \`src/store.js\` |
| output | \`src/render.js\`, \`src/http.js\` |
| utils | \`src/util/sort.js\`, \`src/util/slug.js\`, \`src/log.js\` |
| tests | \`tests/sort.test.js\`, \`tests/store.test.js\` |

Tell me the symptom ("500 on \`/api/mixtapes\`"), a file to change, or a behaviour to add, and I'll take it from there.`,
      },
    ];
  }
  const primary = touched[0];
  const readSteps = touched.slice(0, 2).map((f) => ({ kind: 'tool', name: 'Read', args: { file_path: f }, approval: 'none' }));
  const asksForChange = re('add |fix|change|remov|renam|updat|write|creat|delet|refactor|implement').test(prompt);
  const isQuestion = /\?$|^(what|how|why|where|can|does|is)\b/.test(prompt.trim());
  const body = ctx.vfs.files[primary] ?? '';
  const exports = [...body.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]);
  const findLines = hits
    .slice(0, 3)
    .map((h) => `- \`${h.cand}\` → ${h.found.slice(0, 2).map((f) => `\`${f.file}:${f.line}\``).join(', ')}`)
    .join('\n');
  const fileTable = touched
    .map((f) => `- \`${f}\` — ${f.startsWith('src/') ? 'source' : f.startsWith('tests/') ? 'tests' : 'docs'}`)
    .join('\n');
  const trimPrompt = `${prompt.trim().slice(0, 60)}${prompt.trim().length > 60 ? '…' : ''}`;
  let md;
  if (isQuestion) {
    const exportLine = exports.length ? `It exports **${exports.join('**, **')}**.\n\n` : '';
    const caller = primary.startsWith('src/')
      ? '`src/routes.js`, which awaits it inside the request handler'
      : 'outside this repo as far as I can tell';
    md = `Looking at \`${primary}\`:\n\n${exportLine}${findLines}\n\nWorth knowing: the callers of this module are ${caller}, so a signature change here ripples into the response path.\n\nWant me to go deeper on any of these, or make a change and run the suite?`;
  } else if (asksForChange) {
    const near = exports.length ? `, near \`${exports[0]}\`` : '';
    md = `Here's how I'd read the request against \`${primary}\`:\n\n1. The change lands in \`${primary}\`${near}\n2. Nothing under \`tests/\` covers that path yet, so I would add one alongside\n3. \`npm test\` and \`npm run lint\` gate it, and \`scripts/deploy.sh\` runs the same pair\n\nI can make it a real edit in the virtual repo — diff and permission prompt included — if you tell me the concrete behaviour you want. As written, "${trimPrompt}" is underspecified and I would be guessing at the contract.`;
  } else {
    md = `I searched the repo for that. It lands in \`${primary}\` (${touched.length} file${touched.length === 1 ? '' : 's'} total):\n\n${fileTable}\n\nGive me the concrete ask — a bug symptom, a file to change, a behaviour to add — and I'll run it through the usual loop: read → edit → test → diff.`;
  }
  return [
    { kind: 'think', ms: 1400, text: `Nothing in my scenario set matches this exactly. Rather than guess, search the repo for the terms the user used, read what turns up, and answer from the code. If the ask is a change, ask for the missing specifics instead of inventing a contract.` },
    { kind: 'tool', name: 'Grep', args: { pattern: candidates[0] ?? 'mixtape', glob: '**/*.js', output_mode: 'content' }, approval: 'none' },
    ...readSteps,
    { kind: 'text', md },
  ];
}

function vfsGrepByName(vfs, needle) {
  if (!needle) return [];
  const out = [];
  for (const [file, text] of Object.entries(vfs.files)) {
    text.split('\n').forEach((line, i) => {
      if (line.toLowerCase().includes(needle.toLowerCase()) && out.length < 40) {
        out.push({ file, line: i + 1, text: line.trim().slice(0, 120) });
      }
    });
  }
  return out;
}

/**
 * @returns {{id:string,label:string,plan:(ctx:object)=>object[]}|null}
 */
export function selectScenario(prompt, ctx) {
  const p = String(prompt ?? '');
  for (const s of SCENARIOS) {
    if (s.match(p, ctx)) return s;
  }
  for (const t of SMALL_TALK) {
    if (t.match(p)) return { id: 'small-talk', label: 'Reply', plan: () => [{ kind: 'text', md: t.reply }] };
  }
  return { id: 'generic', label: 'Grounded answer', plan: () => planGeneric(p, ctx) };
}

export const SCENARIO_LIST = SCENARIOS.map((s) => ({ id: s.id, label: s.label }));

export { SCENARIOS };
