'use strict';

const { execFile } = require('child_process');
const config = require('./config');

const ROOT = config.workspaceRoot;

function git(args, { cwd = ROOT, timeout = 30_000, maxBuffer = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-c', 'core.quotepath=false', ...args],
      {
        cwd,
        timeout,
        maxBuffer,
        env: { ...process.env, GIT_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err && typeof err.code === 'number' ? err.code : err ? 1 : 0,
          stdout: (stdout || '').trimEnd(),
          stderr: (stderr || '').trimEnd(),
        });
      }
    );
  });
}

async function isRepo() {
  const res = await git(['rev-parse', '--is-inside-work-tree']);
  return res.ok && res.stdout.trim() === 'true';
}

async function status() {
  if (!(await isRepo())) return { isRepo: false };

  const [branch, porcelain, ahead] = await Promise.all([
    git(['rev-parse', '--abbrev-ref', 'HEAD']),
    git(['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    git(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']).catch(() => null),
  ]);

  const files = [];
  const parts = porcelain.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    const code = entry.slice(0, 2);
    const file = entry.slice(3);
    if (code[0] === 'R' || code[0] === 'C') i++; // skip rename source
    files.push({
      path: file,
      index: code[0],
      worktree: code[1],
      status: describeStatus(code),
    });
  }

  let aheadCount = 0;
  let behindCount = 0;
  if (ahead && ahead.ok) {
    const [a, b] = ahead.stdout.split(/\s+/).map(Number);
    aheadCount = a || 0;
    behindCount = b || 0;
  }

  return {
    isRepo: true,
    branch: branch.ok ? branch.stdout.trim() : '(detached)',
    ahead: aheadCount,
    behind: behindCount,
    clean: files.length === 0,
    files,
  };
}

function describeStatus(code) {
  if (code === '??') return 'untracked';
  if (code.includes('U') || code === 'AA' || code === 'DD') return 'conflicted';
  if (code[0] === 'R') return 'renamed';
  if (code[0] === 'A') return 'added';
  if (code[0] === 'D' || code[1] === 'D') return 'deleted';
  if (code[0] === 'M' || code[1] === 'M') return 'modified';
  return 'changed';
}

async function diff(file, { staged = false, context = 3 } = {}) {
  const args = ['diff', `--unified=${context}`, '--no-color'];
  if (staged) args.push('--cached');
  if (file) args.push('--', file);
  const res = await git(args);
  return { diff: res.stdout, ok: res.ok, error: res.ok ? null : res.stderr };
}

async function log({ limit = 30 } = {}) {
  if (!(await isRepo())) return [];
  const res = await git([
    'log',
    `-n${limit}`,
    '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%at%x1f%s%x1e',
  ]);
  if (!res.ok || !res.stdout) return [];
  return res.stdout
    .split('\x1e')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((row) => {
      const [hash, short, author, email, ts, subject] = row.split('\x1f');
      return {
        hash,
        short,
        author,
        email,
        date: Number(ts) * 1000,
        subject,
      };
    });
}

async function branches() {
  const res = await git(['branch', '--format=%(HEAD)%00%(refname:short)%00%(upstream:short)']);
  if (!res.ok) return [];
  return res.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [head, name, upstream] = line.split('\0');
      return { current: head === '*', name, upstream: upstream || null };
    });
}

async function stage(paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  const args = ['add', '--'];
  for (const p of list) {
    if (typeof p !== 'string' || !p.trim()) throw new Error('Invalid path');
    args.push(p);
  }
  return git(args);
}

async function unstage(paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  const args = ['restore', '--staged', '--'];
  args.push(...list);
  return git(args);
}

async function commit({ message, all = false, author, email }) {
  if (!message || !message.trim()) throw new Error('Commit message is required');
  const args = [];
  if (author) args.push('-c', `user.name=${author}`);
  if (email) args.push('-c', `user.email=${email}`);
  args.push('commit', '-m', message.trim());
  if (all) args.push('-a');
  const res = await git(args, { timeout: 60_000 });
  if (!res.ok) {
    const missingIdentity = /empty ident|Please tell me who you are|unable to auto-detect/i.test(
      res.stderr
    );
    if (missingIdentity) {
      const fallback = await git(
        ['-c', 'user.name=Arena Agent', '-c', 'user.email=agent@arena.local', 'commit', '-m', message.trim(), ...(all ? ['-a'] : [])],
        { timeout: 60_000 }
      );
      return fallback;
    }
  }
  return res;
}

async function checkout(branch, { create = false } = {}) {
  if (!branch || !/^[\w./-]+$/.test(branch)) throw new Error('Invalid branch name');
  return create ? git(['checkout', '-b', branch]) : git(['checkout', branch]);
}

async function push({ remote = 'origin', branch, setUpstream = true } = {}) {
  const args = ['push'];
  if (setUpstream) args.push('--set-upstream');
  args.push(remote);
  if (branch) args.push(branch);
  return git(args, { timeout: 120_000 });
}

async function pull({ remote = 'origin' } = {}) {
  return git(['pull', '--ff-only', remote], { timeout: 120_000 });
}

async function stash({ action = 'push' } = {}) {
  return git(['stash', action]);
}

async function show(rev, file) {
  const args = ['show', `${rev}${file ? `:${file}` : ''}`];
  return git(args);
}

async function init() {
  return git(['init', '-b', 'main']);
}

async function addRemote(url, name = 'origin') {
  return git(['remote', 'add', name, url]);
}

module.exports = {
  git,
  isRepo,
  status,
  diff,
  log,
  branches,
  stage,
  unstage,
  commit,
  checkout,
  push,
  pull,
  stash,
  show,
  init,
  addRemote,
};
