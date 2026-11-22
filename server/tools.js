'use strict';

const path = require('path');
const ws = require('./workspace');
const git = require('./git');
const { runCommand } = require('./exec');
const config = require('./config');

/**
 * Tool definitions in OpenAI / Inception Labs function-calling format.
 * `risky: true` means the UI asks for approval when approval mode is on.
 */
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description:
        'List files and directories in the workspace as a tree. Use this to orient yourself before reading files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: "Directory relative to the workspace root. Use '.' for the root." },
          depth: { type: 'integer', description: 'How many levels deep to recurse (0-5). Default 2.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read a text file from the workspace. Returns numbered content. Use start_line/end_line for large files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to the workspace root.' },
          start_line: { type: 'integer', description: 'First line to return (1-based).' },
          end_line: { type: 'integer', description: 'Last line to return (inclusive).' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Create or completely overwrite a file with new content. Prefer edit_file for small changes to existing files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to the workspace root.' },
          content: { type: 'string', description: 'The complete new file content.' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Replace an exact string in an existing file. old_text must appear exactly once. Use this for surgical edits.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to the workspace root.' },
          old_text: { type: 'string', description: 'Exact text to find (include surrounding context to be unique).' },
          new_text: { type: 'string', description: 'Replacement text. Empty string deletes the match.' },
          replace_all: { type: 'boolean', description: 'Replace every occurrence instead of requiring exactly one.' },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Create a new file. Fails if the file already exists.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to the workspace root.' },
          content: { type: 'string', description: 'Initial file content.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_path',
      description: 'Delete a file or directory (recursively) from the workspace.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Path to delete.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rename_path',
      description: 'Rename or move a file or directory within the workspace.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Current path.' },
          to: { type: 'string', description: 'New path.' },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mkdir',
      description: 'Create a directory (including parents).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Directory path to create.' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search',
      description:
        'Search file contents with a plain text or regex query (like grep). Returns matching lines with file paths and line numbers.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text or regex to search for.' },
          pattern: { type: 'string', description: "Optional glob filter, e.g. '**/*.js'." },
          regex: { type: 'boolean', description: 'Treat query as a regular expression.' },
          case_sensitive: { type: 'boolean', description: 'Match case. Default false.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_files',
      description: "Find files by name glob, e.g. '**/*.ts' or 'server/*.js'.",
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern.' },
          limit: { type: 'integer', description: 'Max results (default 200).' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description:
        'Run a shell command in the workspace and return stdout, stderr and the exit code. Use for builds, tests, package installs and any CLI tool. Prefer non-interactive flags.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to run.' },
          cwd: { type: 'string', description: 'Working directory relative to the workspace root.' },
          timeout_ms: { type: 'integer', description: 'Timeout in milliseconds (default 120000).' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Show the current git branch, ahead/behind counts, and changed files.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Show the diff of uncommitted changes, optionally for a single file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Limit the diff to this file.' },
          staged: { type: 'boolean', description: 'Show staged changes instead of unstaged.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_log',
      description: 'Show recent commits.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer', description: 'Number of commits (default 15).' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_stage',
      description: 'Stage files for commit. Use "." to stage everything.',
      parameters: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' }, description: 'File paths to stage.' },
        },
        required: ['paths'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Commit staged changes with a message.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message.' },
          all: { type: 'boolean', description: 'Stage all tracked changes first (git commit -a).' },
        },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_branch',
      description: 'List branches, create one, or switch to one.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'create', 'checkout'], description: 'Operation.' },
          name: { type: 'string', description: 'Branch name for create/checkout.' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description:
        'Call this when the task is complete or you are blocked and need user input. Provide a concise summary of what you did and any next steps.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Summary of the outcome for the user.' },
          status: { type: 'string', enum: ['completed', 'blocked', 'needs_input'], description: 'Outcome.' },
        },
        required: ['summary'],
      },
    },
  },
];

const RISKY = new Set([
  'write_file',
  'edit_file',
  'create_file',
  'delete_path',
  'rename_path',
  'mkdir',
  'run_command',
  'git_stage',
  'git_commit',
  'git_branch',
]);

/** Number lines for model-friendly file reads. */
function numberLines(content, startLine = 1) {
  return content
    .split('\n')
    .map((line, i) => `${String(startLine + i).padStart(5)}| ${line}`)
    .join('\n');
}

function clip(text, max = 12_000) {
  if (typeof text !== 'string') return text;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… [truncated ${text.length - max} characters]`;
}

const handlers = {
  async list_dir({ path: p = '.', depth = 2 }) {
    const entries = await ws.list(p, { maxDepth: Math.min(5, Math.max(0, Number(depth) || 0)) });
    if (!entries.length) return { output: '(empty directory)' };
    const lines = entries.map((e) => {
      const indent = '  '.repeat(e.path.split('/').length - 1);
      if (e.type === 'dir') return `${indent}${e.name}/${e.skipped ? '  (skipped)' : ''}`;
      return `${indent}${e.name}${e.size ? `  (${e.size}b)` : ''}`;
    });
    return { output: lines.join('\n'), count: entries.length };
  },

  async read_file({ path: p, start_line, end_line }) {
    const file = await ws.readFile(p, { startLine: start_line, endLine: end_line });
    const start = start_line || 1;
    return {
      output: numberLines(file.content, start),
      path: file.path,
      lines: file.lines,
      truncated: file.truncated,
    };
  },

  async write_file({ path: p, content }) {
    if (typeof content !== 'string') throw new Error('content must be a string');
    const res = await ws.writeFile(p, content);
    return { output: `Wrote ${res.bytes} bytes to ${res.path}`, ...res, changed: true };
  },

  async edit_file({ path: p, old_text, new_text = '', replace_all = false }) {
    if (typeof old_text !== 'string' || !old_text.length) {
      throw new Error('old_text must be a non-empty string');
    }
    const file = await ws.readFile(p);
    const occurrences = file.content.split(old_text).length - 1;
    if (occurrences === 0) {
      return {
        output: `ERROR: old_text was not found in ${p}. Read the file again and copy the exact text, including whitespace and indentation.`,
        error: true,
      };
    }
    if (occurrences > 1 && !replace_all) {
      return {
        output: `ERROR: old_text appears ${occurrences} times in ${p}. Include more surrounding context to make it unique, or set replace_all.`,
        error: true,
      };
    }
    const updated = replace_all
      ? file.content.split(old_text).join(new_text)
      : file.content.replace(old_text, () => new_text);
    const res = await ws.writeFile(p, updated);
    return {
      output: `Edited ${res.path} (${occurrences} replacement${occurrences > 1 ? 's' : ''})`,
      ...res,
      changed: true,
    };
  },

  async create_file({ path: p, content = '' }) {
    const res = await ws.createFile(p, content);
    return { output: `Created ${res.path}`, ...res, changed: true };
  },

  async delete_path({ path: p }) {
    const res = await ws.deletePath(p);
    return { output: `Deleted ${res.path}`, ...res, changed: true };
  },

  async rename_path({ from, to }) {
    const res = await ws.renamePath(from, to);
    return { output: `Moved ${res.from} → ${res.to}`, ...res, changed: true };
  },

  async mkdir({ path: p }) {
    const res = await ws.mkdir(p);
    return { output: `Created directory ${res.path}`, ...res };
  },

  async search({ query, pattern, regex = false, case_sensitive = false }) {
    const hits = await ws.search({ query, pattern, regex, caseSensitive: case_sensitive });
    if (!hits.length) return { output: 'No matches found.' };
    return {
      output: hits.map((h) => `${h.path}:${h.line}: ${h.text}`).join('\n'),
      count: hits.length,
    };
  },

  async find_files({ pattern = '**/*', limit = 200 }) {
    const files = await ws.findFiles({ pattern, limit: Math.min(1000, Number(limit) || 200) });
    return { output: files.length ? files.join('\n') : 'No files matched.', count: files.length };
  },

  async run_command({ command, cwd = '.', timeout_ms }) {
    if (!command || !command.trim()) throw new Error('command is required');
    const absCwd = ws.resolveSafe(cwd);
    const res = await runCommand(command, {
      cwd: absCwd,
      timeoutMs: Math.min(600_000, Number(timeout_ms) || config.limits.commandTimeoutMs),
    });
    const parts = [`$ ${command}`];
    if (res.stdout) parts.push(res.stdout);
    if (res.stderr) parts.push(`[stderr]\n${res.stderr}`);
    parts.push(`[exit code: ${res.exitCode}${res.timedOut ? ', timed out' : ''}]`);
    return {
      output: clip(parts.join('\n')),
      exitCode: res.exitCode,
      timedOut: res.timedOut,
      changed: true,
    };
  },

  async git_status() {
    const st = await git.status();
    if (!st.isRepo) return { output: 'This directory is not a git repository yet.' };
    const lines = [`branch: ${st.branch}${st.ahead ? ` (ahead ${st.ahead})` : ''}${st.behind ? ` (behind ${st.behind})` : ''}`];
    if (st.clean) lines.push('working tree clean');
    else for (const f of st.files) lines.push(`${f.index}${f.worktree} ${f.path}`);
    return { output: lines.join('\n'), ...st };
  },

  async git_diff({ path: p, staged = false }) {
    const res = await git.diff(p, { staged });
    return { output: res.diff ? clip(res.diff) : 'No changes.' };
  },

  async git_log({ limit = 15 }) {
    const commits = await git.log({ limit: Math.min(100, Number(limit) || 15) });
    if (!commits.length) return { output: 'No commits yet.' };
    return {
      output: commits
        .map((c) => `${c.short} ${new Date(c.date).toISOString().slice(0, 10)} ${c.author}: ${c.subject}`)
        .join('\n'),
    };
  },

  async git_stage({ paths = [] }) {
    const list = Array.isArray(paths) ? paths : [paths];
    if (!list.length) throw new Error('paths is required');
    const res = await git.stage(list);
    return { output: res.ok ? `Staged: ${list.join(', ')}` : `Failed to stage:\n${res.stderr}`, changed: true };
  },

  async git_commit({ message, all = false }) {
    const res = await git.commit({ message, all });
    const out = [res.stdout, res.stderr].filter(Boolean).join('\n');
    return { output: res.ok ? `Committed.\n${out}` : `Commit failed:\n${out}`, changed: true, ok: res.ok };
  },

  async git_branch({ action = 'list', name }) {
    if (action === 'list') {
      const list = await git.branches();
      return { output: list.map((b) => `${b.current ? '* ' : '  '}${b.name}`).join('\n') || 'No branches.' };
    }
    if (action === 'create' || action === 'checkout') {
      const res = await git.checkout(name, { create: action === 'create' });
      return { output: res.ok ? `On branch ${name}` : `Failed:\n${res.stderr}`, changed: true, ok: res.ok };
    }
    throw new Error(`Unknown branch action: ${action}`);
  },

  async finish({ summary, status = 'completed' }) {
    return { output: summary, finish: true, status, summary };
  },
};

/**
 * Execute a tool call. Returns a result object; never throws for tool errors —
 * the message is handed back to the model so it can self-correct.
 */
async function execute(name, rawArgs) {
  const handler = handlers[name];
  if (!handler) {
    return { ok: false, output: `Unknown tool: ${name}` };
  }
  let args = {};
  if (typeof rawArgs === 'string') {
    try {
      args = rawArgs.trim() ? JSON.parse(rawArgs) : {};
    } catch (err) {
      return { ok: false, output: `Invalid JSON arguments for ${name}: ${err.message}` };
    }
  } else if (rawArgs && typeof rawArgs === 'object') {
    args = rawArgs;
  }

  try {
    const result = await handler(args);
    return { ok: result.error !== true, ...result };
  } catch (err) {
    const hint =
      err.code === 'OUTSIDE_WORKSPACE'
        ? ' All paths must stay inside the workspace root.'
        : '';
    return { ok: false, output: `Error: ${err.message}.${hint}`, code: err.code || 'ERROR' };
  }
}

module.exports = { TOOLS, RISKY, execute, handlers, clip };
