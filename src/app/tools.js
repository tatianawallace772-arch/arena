/**
 * Tool implementations that run against the virtual filesystem. These are the tools the
 * simulated agent can call; each returns a transcript summary (`⎿ …` line), the payload
 * that would be fed back to the model, and any structured side-effects (diff, todos).
 */
import { diffLines } from '../ui/diff.js';
import { applyEdits } from '../ui/diff.js';
import { glob as vfsGlob, grep as vfsGrep, listFiles, normalize, readFile, writeFile } from './vfs.js';
import { strWidth } from '../ansi/text.js';

const lineNo = (n) => String(n).padStart(5, ' ');

export function numbered(code, start = 1, width = 60) {
  return code
    .split('\n')
    .map((l, i) => `${lineNo(start + i)}\t${l.slice(0, width)}`)
    .join('\n');
}

// --------------------------------------------------------------------------- reads

export function toolRead(vfs, args) {
  const path = normalize(args.file_path ?? args.path ?? '');
  const res = readFile(vfs, path);
  if (!res.ok) {
    return { ok: false, error: res.error, summary: `Error reading file: ${res.error}` };
  }
  const lines = res.content.split('\n');
  const offset = Math.max(0, (args.offset ?? args.from ?? 1) - 1);
  const limit = args.limit ? Math.min(args.limit, lines.length - offset) : lines.length - offset;
  const slice = lines.slice(offset, offset + limit);
  const content = slice.map((l, i) => `${lineNo(offset + i + 1)}\t${l}`).join('\n');
  return {
    ok: true,
    path,
    content,
    preview: slice.slice(0, 12).map((l, i) => `${lineNo(offset + i + 1)}\t${l.slice(0, 70)}`),
    summary: `Read ${limit} line${limit === 1 ? '' : 's'}`,
    lines: limit,
  };
}

export function toolGlob(vfs, args) {
  const files = vfsGlob(vfs, args.pattern ?? '*');
  return {
    ok: true,
    files,
    content: files.length ? files.join('\n') : 'No files found',
    summary: `Found ${files.length} file${files.length === 1 ? '' : 's'}`,
  };
}

export function toolGrep(vfs, args) {
  const hits = vfsGrep(vfs, args.pattern ?? '', { glob: args.glob });
  const mode = args.output_mode ?? 'content';
  let body;
  if (mode === 'files_with_matches') body = [...new Set(hits.map((h) => h.file))].join('\n');
  else if (mode === 'count') body = [...new Map(hits.map((h) => [h.file, h])).values()].map((h) => `${h.file}: ${hits.filter((x) => x.file === h.file).length}`).join('\n');
  else body = hits.slice(0, 40).map((h) => `${h.file}:${h.line}:${h.text}`).join('\n');
  return {
    ok: true,
    hits,
    content: body || 'No matches found',
    summary: `${hits.length} match${hits.length === 1 ? '' : 'es'}${args.glob ? ` in ${args.glob}` : ''}`,
  };
}

// --------------------------------------------------------------------------- writes

export function toolWrite(vfs, args, originals) {
  const path = normalize(args.file_path ?? args.path ?? '');
  const content = String(args.content ?? '');
  const prev = path in vfs.files ? vfs.files[path] : '';
  const d = diffLines(prev, content);
  const write = writeFile(vfs, path, content);
  registerTests(vfs, path, content);
  return {
    ok: true,
    path,
    write,
    diff: { prev, next: content },
    summary: write.created ? `Created file with ${content.split('\n').length} lines` : `Updated file with ${content.split('\n').length} lines`,
    stats: { added: d.added, removed: d.removed },
    content: `The file ${path} was${write.created ? ' created' : ' updated'} successfully.`,
  };
}

export function toolEdit(vfs, args, originals) {
  const path = normalize(args.file_path ?? args.path ?? '');
  const cur = readFile(vfs, path);
  if (!cur.ok) return { ok: false, error: cur.error, summary: `Error: ${cur.error}` };
  const edits = args.edits
    ? args.edits
    : [{ oldText: args.old_string ?? '', newText: args.new_string ?? '', replaceAll: !!args.replace_all }];
  const { text, problems, replaced } = applyEdits(cur.content, edits);
  if (replaced === 0) {
    return {
      ok: false,
      error: problems[0] ?? 'no edits applied',
      summary: `Error: ${problems[0] ?? 'no edits applied'}`,
      content: `Cannot edit ${path}: ${problems[0] ?? 'no edits applied'}`,
    };
  }
  const d = diffLines(cur.content, text);
  const write = writeFile(vfs, path, text);
  registerTests(vfs, path, text);
  return {
    ok: true,
    path,
    write,
    diff: { prev: cur.content, next: text },
    summary: `Updated ${path} with ${replaced} edit${replaced === 1 ? '' : 's'}`,
    stats: { added: d.added, removed: d.removed },
    content: `The file ${path} has been updated successfully. (${d.added} lines added, ${d.removed} removed)`,
  };
}

function registerTests(vfs, path, content) {
  if (!/^tests\/[\w.-]+\.test\.js$/.test(path)) return;
  const names = [...content.matchAll(/^\s*test\(\s*['"`](.+?)['"`]/gm)].map((m) => m[1]);
  vfs.customTests = vfs.customTests || new Map();
  vfs.customTests.set(path, names.map((name) => ({ name, check: () => true })));
}

// --------------------------------------------------------------------------- shell

const FAKE_CMDS = new Set(['claude', 'git', 'node', 'npm', 'npx', 'ls', 'cat', 'rg', 'grep', 'head', 'tail', 'wc', 'find', 'pwd', 'echo', 'tree', 'which', 'date', 'uname', 'whoami', 'du', 'touch', 'mkdir', 'rm', 'cp', 'mv', 'curl', 'open', 'sort', 'uniq', 'sed', 'awk']);

export function toolBash(vfs, args) {
  const cmd = String(args.command ?? '').trim();
  const out = runShell(vfs, cmd);
  if (out.error) return { ok: false, error: out.error, summary: out.error };
  return {
    ok: true,
    content: out.stdout,
    summary: out.summary ?? `${cmd.split(/\s+/)[0]} finished`,
    stream: out.stream,
    exitCode: out.code ?? 0,
  };
}

/** Very small shell: enough to look real for the commands a coding agent reaches for. */
/** Tokens a shell would expand before the program ever sees them (`src/*.js` → the files). */
function expandGlobs(vfs, cmd) {
  return String(cmd).replace(/(?<!["'])([\w./*-]*[*?][\w./*-]*)(?!["'])/g, (token, pattern) => {
    if (!/[*/]/.test(pattern)) return token;
    const hits = vfsGlob(vfs, pattern);
    return hits.length ? hits.join(' ') : pattern;
  });
}

export function runShell(vfs, cmd, cwd = '/', stdin = null) {
  void cwd;
  cmd = expandGlobs(vfs, cmd);
  const pipe = splitPipes(cmd);
  if (pipe) {
    let text = '';
    for (const [i, segment] of pipe.entries()) {
      const out = runShell(vfs, segment, cwd, i ? text : null);
      if (out.error) return out;
      text = out.stdout ?? '';
    }
    return { stdout: text, summary: 'finished' };
  }
  const head = cmd.split(/\s+/)[0];
  if (!head) return { stdout: '', code: 0 };
  if (!FAKE_CMDS.has(head)) {
    return { error: `zsh:1: command not found: ${head}`, code: 127 };
  }
  const argv = (cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []).map((a) => a.replace(/^["']|["']$/g, ''));
  const flags = argv.slice(1);

  switch (head) {
    case 'echo':
      return { stdout: expandEnv(flags.join(' '), vfs), summary: 'finished' };
    case 'pwd':
      return { stdout: '/home/user/code/pocketmix', summary: 'finished' };
    case 'whoami':
      return { stdout: 'user', summary: 'finished' };
    case 'date':
      return { stdout: new Date().toString(), summary: 'finished' };
    case 'uname':
      return { stdout: flags.includes('-a') ? 'Linux arena 6.8.0 x86_64 GNU/Linux' : 'Linux', summary: 'finished' };
    case 'node':
      if (flags[0] === '--version') return { stdout: 'v22.16.0', summary: 'finished' };
      return { stdout: '', code: 0, summary: 'node exited' };
    case 'ls': {
      const long = flags.some((f) => f.startsWith('-') && f.includes('l'));
      const targets = flags.filter((f) => !f.startsWith('-'));
      const all = listFiles(vfs);
      const row = (name, size, dir) =>
        long
          ? `${dir ? 'drwxr-xr-x' : '-rw-r--r--'}  1 user  staff  ${String(size).padStart(6, ' ')} ${dateStub()} ${name}${dir ? '/' : ''}`
          : name + (dir ? '/' : '');
      if (!targets.length) {
        const top = [...new Set(all.map((f) => f.split('/')[0]))].sort();
        const body = top.map((name) => row(name, (vfs.files[name] ?? '').length, !vfs.files[name]));
        return { stdout: (long ? [`total ${top.length}`, ...body] : body).join('\n'), summary: 'finished' };
      }
      const out = [];
      for (const target of targets) {
        const t = normalize(target).replace(/\/+$/, '');
        if (vfs.files[t] !== undefined) {
          out.push(row(t.split('/').pop(), vfs.files[t].length, false));
          continue;
        }
        const kids = all.filter((f) => f.startsWith(`${t}/`));
        if (!kids.length) {
          out.push(`ls: ${target}: No such file or directory`);
          continue;
        }
        if (targets.length > 1) out.push(`${target}:`);
        const names = [...new Set(kids.map((f) => f.slice(t.length + 1).split('/')[0]))].sort();
        const body = names.map((name) => row(name, (vfs.files[`${t}/${name}`] ?? '').length, !(`${t}/${name}` in vfs.files)));
        out.push(...(long ? [`total ${names.length}`, ...body] : body));
        if (targets.length > 1) out.push('');
      }
      return { stdout: out.join('\n').trimEnd(), code: out.some((l) => l.startsWith('ls:')) ? 1 : 0, summary: 'finished' };
    }
    case 'tree': {
      const files = listFiles(vfs);
      const tree = ['pocketmix'];
      const byDir = new Map();
      for (const f of files) {
        const parts = f.split('/');
        parts.slice(0, -1).reduce((acc, seg) => {
          const key = acc ? `${acc}/${seg}` : seg;
          if (!byDir.has(key)) {
            byDir.set(key, new Set());
            tree.push(key);
          }
          byDir.get(key).add(parts[parts.length - 1]);
          return key;
        }, '');
      }
      const leaves = files.filter((f) => !f.includes('/'));
      return { stdout: [...tree, ...leaves].join('\n'), summary: 'finished' };
    }
    case 'head':
    case 'tail':
    case 'wc':
    case 'cat': {
      const files = flags.filter((f) => !f.startsWith('-') && !/^\d+$/.test(f));
      const opts = flags.filter((f) => f.startsWith('-')).join('');
      const countFlag = flags.find((f) => /^-\d+$/.test(f));
      const limit = countFlag ? Number(countFlag.slice(1)) : /-n/.test(opts) ? Number((flags[flags.indexOf('-n') + 1] ?? '10') || 10) : 10;
      const text = files.length
        ? files
            .map((f) => readFile(vfs, f).content)
            .join('')
        : stdin ?? '';
      const number = (t) => (head === 'cat' && opts.includes('n') ? t.split('\n').map((l, idx) => `${String(idx + 1).padStart(6, ' ')}\t${l}`).join('\n') : t);
      if (!files.length && stdin === null) return { error: `${head}: missing file operand`, code: 1 };
      const read = (f) => {
        const res = readFile(vfs, f);
        return res.ok ? res.content : null;
      };
      if (head === 'wc') {
        const all = !/[lwc]/.test(opts.replace(/-n\s*\d*/g, ''));
        const cols = [];
        if (all || /l/.test(opts)) cols.push((t) => t.split('\n').length);
        if (all || /w/.test(opts)) cols.push((t) => t.split(/\s+/).filter(Boolean).length);
        if (all || /c/.test(opts)) cols.push((t) => t.length);
        const rows = [];
        const totals = cols.map(() => 0);
        for (const f of files) {
          const body = read(f);
          if (body === null) return { error: `wc: ${f}: No such file or directory`, code: 1 };
          const got = cols.map((fn) => fn(body));
          got.forEach((v, i) => (totals[i] += v));
          rows.push(got.map((v) => String(v).padStart(8, ' ')).join('') + ` ${normalize(f)}`);
        }
        if (!files.length) {
          const got = cols.map((fn) => fn(text));
          return { stdout: got.map((v) => String(v).padStart(8, ' ')).join(''), summary: 'finished' };
        }
        if (files.length > 1) rows.push(totals.map((v) => String(v).padStart(8, ' ')).join('') + ' total');
        return { stdout: rows.join('\n'), summary: 'finished' };
      }
      if (head === 'cat' && !files.length) return { stdout: number(text), summary: 'finished' };
      const parts = [];
      for (const f of files.length ? files : []) {
        const body = read(f);
        if (body === null) return { error: `${head}: ${f}: No such file or directory`, code: 1 };
        const lines = body.split('\n');
        const slice = head === 'head' ? lines.slice(0, limit) : head === 'tail' ? lines.slice(-limit) : lines;
        parts.push(files.length > 1 && head !== 'cat' ? `==> ${normalize(f)} <==\n${slice.join('\n')}` : slice.join('\n'));
      }
      if (!parts.length) {
        const lines = String(text).split('\n');
        parts.push(head === 'head' ? lines.slice(0, limit).join('\n') : head === 'tail' ? lines.slice(-limit).join('\n') : lines.join('\n'));
      }
      return { stdout: number(parts.join('\n')), summary: 'finished' };
    }
    case 'grep':
    case 'rg': {
      const list = flags.some((f) => f === '-l' || f === '--files-with-matches');
      const count = flags.some((f) => f === '-c' || f === '--count');
      const nums = flags.some((f) => f === '-n' || f === '--line-number' || (f.startsWith('-') && f.includes('n')));
      const ignoreCase = flags.some((f) => f === '-i' || (f.startsWith('-') && f.includes('i')));
      const rest = flags.filter((f) => !f.startsWith('-'));
      const pattern = rest[0];
      if (!pattern) return { error: `${head}: missing pattern`, code: 2 };
      const re = toRegex(pattern, ignoreCase);
      if (!re) return { error: `${head}: invalid pattern: ${pattern}`, code: 2 };
      const paths = rest.slice(1);
      const targets = paths.length
        ? [...new Set(paths.flatMap((p) => {
            const key = normalize(p);
            if (vfs.files[key] !== undefined) return [key];
            return listFiles(vfs).filter((f) => f === key || f.startsWith(`${key}/`));
          }))]
        : listFiles(vfs);
      const hits = [];
      const scan = (name, body) => {
        body.split('\n').forEach((line, idx) => {
          if (!re.test(line)) return;
          if (list) {
            if (!hits.some((h) => h.file === name)) hits.push({ file: name, line: '', n: 0 });
            return;
          }
          hits.push({ file: name, line, n: idx + 1 });
        });
      };
      const stdinOnly = !paths.length && stdin !== null;
      if (stdinOnly) scan('', String(stdin ?? ''));
      else for (const f of targets) scan(f, vfs.files[f] ?? '');
      if (list) return { stdout: hits.map((h) => h.file).join('\n'), code: hits.length ? 0 : 1, summary: `${hits.length} files` };
      if (count) return { stdout: String(hits.length), code: hits.length ? 0 : 1, summary: `${hits.length} lines` };
      const showFile = !stdinOnly && (head === 'rg' || targets.length > 1 || (paths.length === 1 && pathIsDir(vfs, paths[0])));
      const body = hits.map((h) => `${showFile && h.file ? h.file + ':' : ''}${nums ? h.n + ':' : ''}${h.line}`);
      return { stdout: body.join('\n'), code: hits.length ? 0 : 1, summary: hits.length ? `${hits.length} matches` : 'no matches' };
    }
    case 'sort':
    case 'uniq': {
      const src = flags.some((f) => !f.startsWith('-')) ? flags.filter((f) => !f.startsWith('-')).map((f) => readFile(vfs, f).content).join('\n') : String(stdin ?? '');
      const opts = flags.filter((f) => f.startsWith('-')).join('');
      let lines = src.split('\n');
      if (head === 'sort') {
        lines = lines.sort((a, b) => (opts.includes('r') ? b.localeCompare(a) : a.localeCompare(b)));
        if (opts.includes('u')) lines = [...new Set(lines)];
      } else {
        const collapsed = [];
        let run = 0;
        for (const [i, line] of lines.entries()) {
          if (i && line === lines[i - 1]) {
            run++;
            continue;
          }
          if (collapsed.length && opts.includes('c')) collapsed[collapsed.length - 1] = `${String(run + 1).padStart(7, ' ')} ${collapsed[collapsed.length - 1].replace(/^\s*\d+\s+/, '')}`;
          collapsed.push(line);
          run = 0;
        }
        lines = collapsed;
      }
      return { stdout: lines.join('\n'), summary: 'finished' };
    }
    case 'sed': {
      const expr = flags[flags.indexOf('-e') + 1] ?? flags.find((f) => f.startsWith('s/'));
      const src = String(stdin ?? (flags.filter((f) => !f.startsWith('-') && !f.startsWith('s/') && f !== '-e' && f !== expr)[0] ? readFile(vfs, flags.filter((f) => !f.startsWith('-') && !f.startsWith('s/'))[0]).content : ''));
      if (!expr) return { stdout: src, summary: 'finished' };
      const m = expr.match(/^s\/(.*?)\/(.*?)\/([g]*)$/);
      if (!m) return { error: `sed: unsupported expression: ${expr}`, code: 1 };
      const re = new RegExp(m[1].replace(/\\./g, (s) => s), m[3].includes('g') ? 'g' : '');
      return { stdout: src.split('\n').map((l) => l.replace(re, m[2])).join('\n'), summary: 'finished' };
    }
    case 'awk': {
      const prog = flags.find((f) => f.includes('{')) ?? '{print $1}';
      const fields = [...prog.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]) - 1);
      const src = String(stdin ?? '');
      const rows = src.split('\n').map((line) => (fields.length ? fields.map((i) => line.trim().split(/\s+/)[i] ?? '').join(' ') : line));
      return { stdout: rows.join('\n'), summary: 'finished' };
    }
    case 'find': {
      const nameAt = flags.indexOf('-name');
      const pattern = nameAt >= 0 ? flags[nameAt + 1] : null;
      const re = pattern ? toRegex(pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'), false) : null;
      const baseArg = flags.find((f) => !f.startsWith('-')) ?? '.';
      const base = baseArg === '.' || baseArg === './' ? '' : normalize(baseArg);
      let files = listFiles(vfs).filter((f) => (base ? f === base || f.startsWith(`${base}/`) : true));
      if (re) files = files.filter((f) => re.test(f.split('/').pop()));
      return { stdout: files.map((f) => './' + (base ? f.slice(base.length + 1) : f)).join('\n'), summary: `${files.length} files` };
    }
    case 'touch':
    case 'mkdir': {
      const name = flags.find((f) => !f.startsWith('-'));
      if (!name) return { error: `${head}: missing operand`, code: 1 };
      if (head === 'touch') {
        if (!(normalize(name) in vfs.files)) writeFile(vfs, name, '');
      } else vfs.dirs = (vfs.dirs || new Set()).add(normalize(name));
      return { stdout: '', summary: 'finished' };
    }
    case 'cp':
    case 'mv': {
      const [a, b] = flags.filter((f) => !f.startsWith('-'));
      if (!a || !b) return { error: `${head}: missing operand`, code: 1 };
      const src = readFile(vfs, a);
      if (!src.ok) return { error: `${head}: ${a}: No such file or directory`, code: 1 };
      writeFile(vfs, b, src.content);
      if (head === 'mv') delete vfs.files[normalize(a)];
      return { stdout: '', summary: 'finished' };
    }
    case 'rm': {
      const target = flags.filter((f) => !f.startsWith('-'))[0];
      if (!target) return { error: 'rm: missing operand', code: 1 };
      const key = normalize(target);
      if (!(key in vfs.files)) return { error: `rm: ${key}: No such file or directory`, code: 1 };
      delete vfs.files[key];
      vfs.removed = [...(vfs.removed || []), key];
      return { stdout: '', summary: `removed ${key}` };
    }
    case 'which':
      return { stdout: `/usr/local/bin/${flags[0] ?? ''}`, code: flags[0] === 'claude' ? 0 : 0, summary: 'finished' };
    case 'open':
      return { stdout: '', summary: `opened ${flags[0] ?? ''}` };
    case 'curl':
      return { stdout: '', code: 0, error: 'curl: (7) Failed to connect — network egress is disabled in this sandbox', summary: 'exit 7' };
    case 'git':
      return gitCommand(vfs, flags);
    case 'npm':
    case 'npx':
      return npmCommand(vfs, head, flags);
    default:
      return { stdout: '', summary: 'finished' };
  }
}

const ENV = { SHELL: '/bin/zsh', HOME: '/home/user', USER: 'user', PWD: '/home/user/code/pocketmix', PATH: '/usr/local/bin:/usr/bin:/bin', NODE_ENV: 'development' };

/** Shell variables expand before the command runs, so echo sees the value. */
function expandEnv(text, vfs) {
  void vfs;
  return String(text).replace(/\$\{?(\w+)\}?/g, (m, name) => ENV[name] ?? '');
}

/** Split a command line on unquoted pipes, since `a | b` is the shape agents actually type. */
function splitPipes(cmd) {
  const parts = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '|' && cmd[i + 1] !== '|') {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur.trim());
  return parts.length > 1 ? parts : null;
}

/** Turns a grep/rg pattern into a JS regex, falling back to a literal substring. */
function toRegex(pattern, ignoreCase) {
  try {
    return new RegExp(pattern, ignoreCase ? 'i' : '');
  } catch {
    try {
      return new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\function dateStub() {'), ignoreCase ? 'i' : '');
    } catch {
      return null;
    }
  }
}

/** grep prefixes file names only when it walked a directory rather than one file. */
function pathIsDir(vfs, path) {
  const key = normalize(path);
  if (vfs.files[key] !== undefined) return false;
  return listFiles(vfs).some((f) => f.startsWith(`${key}/`));
}

function dateStub() {
  return 'Aug 30 14:22';
}

function gitCommand(vfs, args) {
  const sub = args[0];
  switch (sub) {
    case 'status': {
      const lines = [`On branch ${vfs.git.branch}`, `Your branch is up to date with '${vfs.git.upstream}'.`, ''];
      const modified = [...vfs.dirty].filter((f) => originalOf(vfs, f) !== undefined && originalOf(vfs, f) !== vfs.files[f]);
      const untracked = [...vfs.dirty].filter((f) => originalOf(vfs, f) === undefined);
      if (modified.length) {
        lines.push('Changes not staged for commit:');
        lines.push('  (use "git add <file>..." to update what will be committed)');
        for (const f of modified) lines.push(`\tmodified:   ${f}`);
        lines.push('');
      }
      if (untracked.length) {
        lines.push('Untracked files:');
        for (const f of untracked) lines.push(`\t${f}`);
        lines.push('');
      }
      if (!modified.length && !untracked.length) lines.push('nothing to commit, working tree clean');
      return { stdout: lines.join('\n'), summary: 'finished' };
    }
    case 'diff': {
      const stat = args.includes('--stat');
      const only = args[1] && !args[1].startsWith('-') ? normalize(args[1]) : null;
      const files = (only ? [only] : [...vfs.dirty]).filter((f) => originalOf(vfs, f) !== undefined && originalOf(vfs, f) !== vfs.files[f]);
      if (!files.length) return { stdout: '', summary: 'no changes' };
      if (stat) {
        const rows = files.map((f) => {
          const d = diffLines(originalOf(vfs, f), vfs.files[f]);
          const bars = '\u2588'.repeat(Math.max(1, Math.min(24, d.added + d.removed)));
          const marks = '+'.repeat(Math.min(d.added, 12)) + '-'.repeat(Math.min(d.removed, 12));
          return f.padEnd(28) + ' | ' + String(d.added + d.removed).padStart(3) + ' ' + marks + ' ' + bars;
        });
        const total = files.length + ' file' + (files.length === 1 ? '' : 's') + ' changed';
        return { stdout: rows.join('\n') + '\n' + ' '.repeat(29) + total, summary: 'finished' };
      }
      const out = [];
      for (const f of files) {
        const d = diffLines(originalOf(vfs, f), vfs.files[f]);
        out.push(`diff --git a/${f} b/${f}`);
        out.push(`index 8a3f1b2..c91e77a 100644`);
        out.push(`--- a/${f}`);
        out.push(`+++ b/${f}`);
        for (const hunk of d.hunks) {
          out.push(`@@ -${hunk.oldStart},${hunk.oldCount ?? 0} +${hunk.newStart},${hunk.newCount ?? 0} @@`);
          for (const op of hunk.lines) out.push(op.type + ' ' + op.text);
        }
        out.push('');
      }
      return { stdout: out.join('\n').trimEnd(), summary: `${files.length} file${files.length === 1 ? '' : 's'} changed` };
    }
    case 'show': {
      const latest = vfs.git.log[0];
      const touched = latest.files ?? [];
      const rows = touched.map((f) => {
        const lines = (vfs.files[f] ?? '').split('\n').length;
        return f.padEnd(28) + ' | ' + String(lines).padStart(3) + ' +++--';
      });
      const head = [
        'commit ' + latest.hash,
        'Author: ' + latest.who,
        'Date:   ' + latest.when,
        '',
        '    ' + latest.subject,
        '',
      ];
      return { stdout: head.concat(rows).join('\n').trimEnd(), summary: 'finished' };
    }
    case 'log': {
      const rows = vfs.git.log.map((c) => `commit ${c.hash} (${vfs.git.branch})\nAuthor: ${c.who}\nDate:   ${c.when}\n\n    ${c.subject}\n`);
      return { stdout: rows.join('\n'), summary: 'finished' };
    }
    case 'branch':
      return { stdout: `* ${vfs.git.branch}`, summary: 'finished' };
    case 'add':
      return { stdout: '', summary: args[1] ? `staged ${args[1]}` : 'staged all' };
    case 'commit':
      return {
        stdout: `[${vfs.git.branch} ${hashFor(vfs)}] ${args.includes('-m') ? args[args.indexOf('-m') + 1].replace(/^["']|["']$/g, '') : 'update'}\n ${vfs.dirty.size} file${vfs.dirty.size === 1 ? '' : 's'} changed`,
        summary: 'committed',
      };
    case 'push':
      return { stdout: `To github.com:twallace/pocketmix.git\n   b1e47ac..${hashFor(vfs)}  ${vfs.git.branch} -> ${vfs.git.branch}`, summary: 'pushed' };
    default:
      return { stdout: `git: '${sub}' is not a git command.`, code: 1, error: `git: '${sub}' is not a git command.` };
  }
}

function hashFor(vfs) {
  const text = [...vfs.dirty].join('|');
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h.toString(16).slice(0, 7).padEnd(7, '0');
}

function originalOf(vfs, path) {
  return vfs.originals ? vfs.originals[path] : undefined;
}

function npmCommand(vfs, bin, args) {
  const run = args[0];
  if (bin === 'npx') {
    if (run === 'eslint') return lint(vfs);
    if (run === 'prettier') return { stdout: 'All matched files use Prettier code style!', summary: 'finished' };
    return { stdout: `${run}: ok`, summary: 'finished' };
  }
  if (run === 'install' || run === 'i') {
    return {
      stdout: `added 1 package in 2s\n\n14 packages are looking for funding\n  run \`npm fund\` for details`,
      summary: 'finished',
      stream: ['⠋ resolving dependencies…', '⠹ fetching packages…', 'added 1 package in 2s'],
    };
  }
  if (run === 'run') {
    const script = args[1];
    if (script === 'lint') return lint(vfs);
    if (script === 'dev') {
      return {
        stdout: `> pocketmix@0.4.2 dev\n> node --watch src/server.js\n\n{"ts":"${new Date().toISOString()}","level":"info","msg":"listening","port":8787}`,
        summary: '⚠ long-running command moved to background (npm run dev)',
        background: 'npm run dev',
        stream: ['> pocketmix@0.4.2 dev', '> node --watch src/server.js', '', '{"ts":"…","level":"info","msg":"listening","port":8787}'],
      };
    }
    return { stdout: `> pocketmix@0.4.2 ${script}\n(no output)`, summary: 'finished' };
  }
  if (run === 'test') return runTests(vfs);
  return { stdout: `unknown script "${run}"`, code: 1, error: `npm error script "${run}" not found` };
}

/**
 * Test specs are functions of the file contents, so a real edit to the source makes
 * tests pass or fail. New test files written by the agent are picked up too.
 */
const TEST_SPECS = {
  'tests/sort.test.js': (vfs) => {
    const src = vfs.files['src/util/sort.js'] || '';
    const readDir = /dir\s*=\s*\(rawDir[^)]*\)\s*\.?toLowerCase?\(/.test(src) || /\.toLowerCase\(\)/.test(src.split('const dir')[1]?.split('\n')[0] || '');
    return [
      { name: 'recent maps to updated_at desc', ok: /updated_at/.test(src) && /recent/.test(src), detail: `{ field: 'updated_at', dir: 'desc' }` },
      { name: 'explicit direction is respected', ok: /split\(':'\)/.test(src), detail: `{ field: 'title', dir: 'asc' }` },
      { name: 'uppercase direction is normalized', ok: readDir, expect: `{ dir: 'asc' }`, actual: `{ dir: 'ASC' }` },
      { name: 'unknown field throws', ok: /unknown sort field/.test(src), detail: '' },
    ];
  },
  'tests/render.test.js': (vfs) => {
    const http = vfs.files['src/http.js'] || '';
    const escapesQuote = /&#0?39;/.test(http) || /&#x27;/i.test(http);
    const render = vfs.files['src/render.js'] || '';
    return [
      { name: 'escapeHtml covers the five dangerous characters', ok: escapesQuote, expect: "' → &#39;", actual: "' passes through unescaped" },
      { name: 'escaping is idempotent-safe for already-escaped text', ok: /&amp;/.test(http), detail: '' },
      { name: 'non-string fields are coerced, not dropped', ok: /String\(value\)/.test(http), detail: '' },
      { name: 'a quote in the byline cannot break out of its attribute', ok: escapesQuote, expect: 'no raw <script> in output', actual: "attribute injection reachable" },
      { name: 'positions are 1-based for humans', ok: /position \+ 1/.test(render), detail: '' },
    ];
  },
  'tests/store.test.js': (vfs) => {
    const store = vfs.files['src/store.js'] || '';
    const slug = vfs.files['src/util/slug.js'] || '';
    return [
      { name: 'sort keys round-trip through the store query builder', ok: /ORDER BY/.test(store), detail: '' },
      { name: 'slug hashing is case insensitive', ok: /toLowerCase\(\)/.test(slug), detail: '' },
    ];
  },
};

/**
 * Test results are derived from the actual test files in the virtual repo: names come from
 * the source, pass/fail from the checks above. Add a test and `npm test` reports one more.
 */
export function runTests(vfs) {
  const files = Object.keys(vfs.files)
    .filter((f) => /^tests\/[\w.-]+\.test\.js$/.test(f))
    .sort();
  const lines = [];
  let pass = 0;
  let fail = 0;
  for (const file of files) {
    const content = vfs.files[file] ?? '';
    const names = [...content.matchAll(/^\s*test\(\s*['"`](.+?)['"`]/gm)].map((m) => m[1]);
    const checks = TEST_SPECS[file] ? TEST_SPECS[file](vfs) : [];
    const specs = names.length
      ? names.map((name) => {
          const found = checks.find((c) => c.name === name);
          return found ? { name, ok: found.ok, expect: found.expect, actual: found.actual } : { name, ok: true };
        })
      : checks;
    lines.push({ kind: 'file', text: `▶ ${file}` });
    for (const spec of specs) {
      const ms = (0.6 + ((spec.name.length * 7) % 40) / 10).toFixed(3);
      if (spec.ok) {
        pass++;
        lines.push({ kind: 'pass', text: `✔ ${spec.name} (${ms} ms)` });
      } else {
        fail++;
        lines.push({ kind: 'fail', text: `✖ ${spec.name} (${ms} ms)` });
        lines.push({
          kind: 'detail',
          text: `  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:\n  + actual - expected\n  \n  + ${spec.actual ?? '{ ok: true }'}\n  - ${spec.expect ?? '{ ok: false }'}\n      at TestContext.<anonymous> (${file}:18:10)`,
        });
      }
    }
    const p = specs.filter((s) => s.ok).length;
    const f = specs.length - p;
    lines.push({ kind: 'file', text: `■ ${file} · pass ${p} · fail ${f}` });
  }
  const tail = `ℹ tests ${pass + fail}\nℹ suites 0\nℹ pass ${pass}\nℹ fail ${fail}\nℹ cancelled 0\nℹ duration_ms ${120 + (pass + fail) * 7}`;
  return {
    stdout: `${lines.map((l) => l.text).join('\n')}\n\n${tail}`,
    code: fail ? 1 : 0,
    summary: fail ? `Exit code 1 · ${fail} of ${pass + fail} failed` : `${pass} test${pass === 1 ? '' : 's'} passed`,
    pass,
    fail,
    stream: lines,
    tail,
  };
}

function lint(vfs) {
  const problems = [];
  for (const file of listFiles(vfs)) {
    if (!/\.(js|ts)$/.test(file) || file.startsWith('node_modules')) continue;
    const src = vfs.files[file];
    src.split('\n').forEach((line, i) => {
      if (/[^\s=!<>]==[^=]/.test(line) && !/==\s*(null|undefined)/.test(line) && !/\/\//.test(line)) {
        problems.push(`${file}:${i + 1}:14  error  Expected '===' and instead saw '=='  eqeqeq`);
      }
    });
  }
  if (!problems.length) return { stdout: '', code: 0, summary: 'no lint problems' };
  return {
    stdout: `${problems.join('\n')}\n\n✖ ${problems.length} problem${problems.length === 1 ? '' : 's'} (1 error${problems.length === 1 ? '' : `s, 0 warnings`})`,
    code: 1,
    summary: `${problems.length} lint error${problems.length === 1 ? '' : 's'}`,
  };
}

/** Truncate to the first `max` lines with a marker, the way the CLI shows long output. */
export function clipOutput(text, max = 14, width = 100) {
  const lines = String(text).split('\n');
  if (lines.length <= max) return { lines, hidden: 0 };
  const head = lines.slice(0, max);
  head.push(`… +${lines.length - max} lines`);
  return { lines: head.map((l) => (strWidth(l) > width ? l.slice(0, width - 1) + '…' : l)), hidden: lines.length - max };
}
