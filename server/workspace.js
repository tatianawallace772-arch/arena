'use strict';

const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');
const config = require('./config');

const ROOT = config.workspaceRoot;

// Directories that are never worth walking into.
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.venv',
  '__pycache__',
  '.cache',
  'target',
  'coverage',
  '.turbo',
  '.pytest_cache',
  '.mypy_cache',
]);

const MAX_LIST = 2000;

class WorkspaceError extends Error {
  constructor(message, code = 'WORKSPACE_ERROR') {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
  }
}

/** Resolve a user/agent supplied path, guaranteeing it stays inside ROOT. */
function resolveSafe(input, { allowRoot = true } = {}) {
  const raw = input == null ? '.' : String(input);
  if (raw.includes('\0')) throw new WorkspaceError('Invalid path', 'BAD_PATH');

  const abs = path.resolve(ROOT, raw);
  const rel = path.relative(ROOT, abs);

  const escapes = rel.startsWith('..') || path.isAbsolute(rel);
  if (escapes) {
    throw new WorkspaceError(
      `Path escapes the workspace: ${raw} (workspace root is ${ROOT})`,
      'OUTSIDE_WORKSPACE'
    );
  }
  if (!allowRoot && rel === '') {
    throw new WorkspaceError('Operation not allowed on the workspace root', 'BAD_PATH');
  }

  // Follow symlinks and re-check, so a link inside the repo cannot point out.
  try {
    const real = fssync.realpathSync(abs);
    const realRel = path.relative(ROOT, real);
    if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
      throw new WorkspaceError(`Path escapes the workspace via symlink: ${raw}`, 'OUTSIDE_WORKSPACE');
    }
    return real;
  } catch (err) {
    if (err instanceof WorkspaceError) throw err;
    // Path does not exist yet (e.g. writing a new file) — use the resolved path.
    return abs;
  }
}

const toRel = (abs) => path.relative(ROOT, abs).replace(/\\/g, '/') || '.';

async function list(dirInput = '.', { depth = 0, maxDepth = 3, includeHidden = true } = {}) {
  const dir = resolveSafe(dirInput);
  const entries = [];

  async function walk(current, level) {
    let dirents;
    try {
      dirents = await fs.readdir(current, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOTDIR') return;
      throw err;
    }
    dirents.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const d of dirents) {
      if (entries.length >= MAX_LIST) return;
      if (!includeHidden && d.name.startsWith('.')) continue;
      if (d.isDirectory() && SKIP_DIRS.has(d.name)) {
        entries.push({
          name: d.name,
          path: toRel(path.join(current, d.name)),
          type: 'dir',
          skipped: true,
        });
        continue;
      }
      const full = path.join(current, d.name);
      const rel = toRel(full);
      if (d.isDirectory()) {
        entries.push({ name: d.name, path: rel, type: 'dir' });
        if (level < maxDepth) await walk(full, level + 1);
      } else {
        let size = 0;
        try {
          size = (await fs.stat(full)).size;
        } catch {
          /* ignore */
        }
        entries.push({ name: d.name, path: rel, type: 'file', size });
      }
    }
  }

  await walk(dir, depth);
  return entries;
}

async function readFile(fileInput, { startLine, endLine } = {}) {
  const file = resolveSafe(fileInput, { allowRoot: false });
  const stat = await fs.stat(file).catch(() => null);
  if (!stat) throw new WorkspaceError(`File not found: ${fileInput}`, 'NOT_FOUND');
  if (stat.isDirectory()) throw new WorkspaceError(`${fileInput} is a directory`, 'IS_DIR');
  if (stat.size > config.limits.maxReadBytes) {
    throw new WorkspaceError(
      `File is too large to read (${stat.size} bytes). Use search or read a line range.`,
      'TOO_LARGE'
    );
  }

  const content = await fs.readFile(file, 'utf8');
  const lines = content.split('\n');
  let out = content;
  let truncated = false;

  if (startLine || endLine) {
    const s = Math.max(1, Number(startLine) || 1);
    const e = Math.min(lines.length, Number(endLine) || lines.length);
    out = lines.slice(s - 1, e).join('\n');
    truncated = s > 1 || e < lines.length;
  }

  return {
    path: toRel(file),
    content: out,
    lines: lines.length,
    size: stat.size,
    truncated,
    language: languageFor(file),
  };
}

async function writeFile(fileInput, content) {
  const file = resolveSafe(fileInput, { allowRoot: false });
  if (Buffer.byteLength(content) > config.limits.maxWriteBytes) {
    throw new WorkspaceError('File content exceeds the write limit', 'TOO_LARGE');
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
  return { path: toRel(file), bytes: Buffer.byteLength(content) };
}

async function createFile(fileInput, content = '') {
  const file = resolveSafe(fileInput, { allowRoot: false });
  if (fssync.existsSync(file)) throw new WorkspaceError(`File already exists: ${fileInput}`, 'EXISTS');
  return writeFile(fileInput, content);
}

async function deletePath(targetInput) {
  const target = resolveSafe(targetInput, { allowRoot: false });
  if (!fssync.existsSync(target)) throw new WorkspaceError(`Not found: ${targetInput}`, 'NOT_FOUND');
  await fs.rm(target, { recursive: true, force: true });
  return { path: toRel(target), deleted: true };
}

async function renamePath(fromInput, toInput) {
  const from = resolveSafe(fromInput, { allowRoot: false });
  const to = resolveSafe(toInput, { allowRoot: false });
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
  return { from: toRel(from), to: toRel(to) };
}

async function mkdir(dirInput) {
  const dir = resolveSafe(dirInput, { allowRoot: false });
  await fs.mkdir(dir, { recursive: true });
  return { path: toRel(dir), created: true };
}

/** Walk the tree and collect files matching a glob-ish pattern. */
async function findFiles({ pattern = '', limit = 200 } = {}) {
  const results = [];
  const re = pattern ? globToRegExp(pattern) : null;

  async function walk(dir) {
    if (results.length >= limit) return;
    let dirents;
    try {
      dirents = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of dirents) {
      if (results.length >= limit) return;
      if (d.name.startsWith('.') && d.name !== '.env.example') continue;
      if (d.isDirectory()) {
        if (SKIP_DIRS.has(d.name)) continue;
        await walk(path.join(dir, d.name));
      } else {
        const rel = toRel(path.join(dir, d.name));
        if (!re || re.test(rel)) results.push(rel);
      }
    }
  }

  await walk(ROOT);
  return results;
}

/** Regex search across the workspace (a small grep). */
async function search({ query, pattern = '', maxResults = 100, caseSensitive = false, regex = false }) {
  if (!query) throw new WorkspaceError('Search query is required', 'BAD_INPUT');
  const files = await findFiles({ pattern, limit: 5000 });
  const matcher = regex
    ? new RegExp(query, caseSensitive ? 'g' : 'gi')
    : null;
  const needle = caseSensitive ? query : query.toLowerCase();
  const hits = [];

  for (const rel of files) {
    if (hits.length >= maxResults) break;
    const abs = path.join(ROOT, rel);
    let stat;
    try {
      stat = await fs.stat(abs);
    } catch {
      continue;
    }
    if (stat.size > 2_000_000) continue;
    let content;
    try {
      content = await fs.readFile(abs, 'utf8');
    } catch {
      continue; // binary
    }
    if (content.includes('\0')) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let matched = false;
      if (matcher) {
        matcher.lastIndex = 0;
        matched = matcher.test(line);
      } else {
        matched = (caseSensitive ? line : line.toLowerCase()).includes(needle);
      }
      if (matched) {
        hits.push({
          path: rel,
          line: i + 1,
          text: line.length > 300 ? `${line.slice(0, 300)}…` : line,
        });
        if (hits.length >= maxResults) break;
      }
    }
  }
  return hits;
}

async function statFile(fileInput) {
  const file = resolveSafe(fileInput);
  const stat = await fs.stat(file).catch(() => null);
  if (!stat) return { exists: false, path: toRel(file) };
  return {
    exists: true,
    path: toRel(file),
    type: stat.isDirectory() ? 'dir' : 'file',
    size: stat.size,
    mtime: stat.mtimeMs,
    mode: stat.mode.toString(8),
  };
}

function globToRegExp(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        out += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else out += '[^/]*';
    } else if (c === '?') out += '.';
    else if ('.+^$(){}|[]\\'.includes(c)) out += `\\${c}`;
    else out += c;
  }
  return new RegExp(`${out}$`);
}

function languageFor(file) {
  const ext = path.extname(file).toLowerCase();
  return (
    {
      '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
      '.ts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
      '.json': 'json', '.md': 'markdown', '.py': 'python', '.rb': 'ruby',
      '.go': 'go', '.rs': 'rust', '.java': 'java', '.c': 'c', '.h': 'c',
      '.cpp': 'cpp', '.hpp': 'cpp', '.cs': 'csharp', '.php': 'php',
      '.sh': 'shell', '.bash': 'shell', '.yml': 'yaml', '.yaml': 'yaml',
      '.css': 'css', '.scss': 'scss', '.html': 'html', '.sql': 'sql',
      '.xml': 'xml', '.toml': 'ini', '.ini': 'ini', '.dockerfile': 'dockerfile',
    }[ext] || 'plaintext'
  );
}

module.exports = {
  ROOT,
  WorkspaceError,
  resolveSafe,
  toRel,
  list,
  readFile,
  writeFile,
  createFile,
  deletePath,
  renamePath,
  mkdir,
  findFiles,
  search,
  statFile,
  languageFor,
};
