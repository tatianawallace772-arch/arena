/* Arena Code Agent — browser client */
'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  sessionId: localStorage.getItem('agent.session') || `sess-${Date.now().toString(36)}`,
  // null = follow the server's INCEPTION_MODEL until the user picks one,
  // so a stale localStorage value can never override the server config.
  model: localStorage.getItem('agent.model') || null,
  approvalMode: localStorage.getItem('agent.approval') || 'auto',
  agentSocket: null,
  connected: false,
  running: false,
  tree: [],
  openFiles: new Map(), // relPath -> { content, dirty, lang }
  activeFile: null,
  editor: null,
  monacoReady: false,
  token: new URLSearchParams(location.search).get('token') || localStorage.getItem('agent.token') || '',
};

localStorage.setItem('agent.session', state.sessionId);
window.AGENT_TOKEN = state.token;

/* ── Utilities ──────────────────────────────────────────────── */
function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = '0.25s';
    setTimeout(() => el.remove(), 260);
  }, 3600);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers['x-agent-token'] = state.token;
  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const wsUrl = (pathname, params = {}) => {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const search = new URLSearchParams(params);
  if (state.token) search.set('token', state.token);
  const qs = search.toString();
  return `${proto}//${location.host}${pathname}${qs ? `?${qs}` : ''}`;
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderMarkdown(text) {
  try {
    const html = marked.parse(text, { breaks: true, gfm: true });
    // Strip scripts/event handlers from model output.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,style').forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((n) => {
      for (const attr of [...n.attributes]) {
        if (/^on/i.test(attr.name) || (attr.name === 'href' && /^javascript:/i.test(attr.value))) {
          n.removeAttribute(attr.name);
        }
      }
      if (n.tagName === 'A') {
        n.setAttribute('target', '_blank');
        n.setAttribute('rel', 'noopener noreferrer');
      }
    });
    return doc.body.innerHTML;
  } catch {
    return `<p>${escapeHtml(text)}</p>`;
  }
}

/* ── Activity rail / sidebar panels ─────────────────────────── */
let activePanel = 'explorer';
$$('.rail-btn[data-panel]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const panel = btn.dataset.panel;
    if (activePanel === panel) {
      // Toggle sidebar collapse
      $('.sidebar').style.display = $('.sidebar').style.display === 'none' ? 'flex' : 'none';
      return;
    }
    activePanel = panel;
    $$('.rail-btn[data-panel]').forEach((b) => b.classList.toggle('active', b === btn));
    $$('.panel').forEach((p) => (p.hidden = p.id !== `panel-${panel}`));
    if (panel === 'git') refreshGit();
  });
});

/* ── File tree ──────────────────────────────────────────────── */
const FILE_ICONS = {
  js: '🟨', mjs: '🟨', cjs: '🟨', ts: '🟦', tsx: '🟦', jsx: '🟨',
  json: '⬜', md: '📘', py: '🐍', rb: '💎', go: '🩵', rs: '🦀',
  html: '🧡', css: '🎨', scss: '🎨', sh: '🖥', yml: '⚙️', yaml: '⚙️',
  png: '🖼', jpg: '🖼', svg: '🖼', lock: '🔒', env: '🔑', toml: '⚙️',
};
const fileIcon = (name) => {
  if (name.startsWith('.')) return '⚙️';
  const ext = name.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📄';
};

async function loadTree() {
  try {
    const data = await api('/api/files?depth=6');
    state.tree = data.entries;
    renderTree();
  } catch (err) {
    $('#fileTree').innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

function renderTree() {
  const container = $('#fileTree');
  if (!state.tree.length) {
    container.innerHTML = '<div class="empty">Empty workspace</div>';
    return;
  }
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (const entry of state.tree) {
    const depth = entry.path.split('/').length - 1;
    const row = document.createElement('div');
    row.className = 'tree-row' + (state.activeFile === entry.path ? ' active' : '');
    row.style.paddingLeft = `${6 + depth * 12}px`;
    row.title = entry.path;

    const isDir = entry.type === 'dir';
    row.innerHTML = `
      <span class="twisty">${isDir ? '▾' : ''}</span>
      <span class="ico">${isDir ? '📁' : fileIcon(entry.name)}</span>
      <span class="name">${escapeHtml(entry.name)}</span>
      ${state.openFiles.get(entry.path)?.dirty ? '<span class="dirty">●</span>' : ''}
    `;
    row.addEventListener('click', () => {
      if (isDir) return;
      openFile(entry.path);
    });
    fragment.appendChild(row);
  }
  container.appendChild(fragment);
}

$('#btnRefreshTree').addEventListener('click', loadTree);

$('#btnNewFile').addEventListener('click', async () => {
  const p = prompt('New file path (relative to workspace):');
  if (!p) return;
  try {
    await api('/api/file', { method: 'POST', body: JSON.stringify({ path: p, content: '' }) });
    await loadTree();
    openFile(p);
    toast(`Created ${p}`, 'ok');
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#btnNewFolder').addEventListener('click', async () => {
  const p = prompt('New folder path:');
  if (!p) return;
  try {
    await api('/api/file', { method: 'POST', body: JSON.stringify({ path: p, type: 'dir' }) });
    await loadTree();
    toast(`Created ${p}/`, 'ok');
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ── Search panel ───────────────────────────────────────────── */
$('#searchInput').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const q = e.target.value.trim();
  if (!q) return;
  const box = $('#searchResults');
  box.innerHTML = '<div class="empty">Searching…</div>';
  try {
    const { hits } = await api(`/api/search?q=${encodeURIComponent(q)}`);
    if (!hits.length) {
      box.innerHTML = '<div class="empty">No matches</div>';
      return;
    }
    const grouped = new Map();
    for (const hit of hits) {
      if (!grouped.has(hit.path)) grouped.set(hit.path, []);
      grouped.get(hit.path).push(hit);
    }
    box.innerHTML = '';
    for (const [file, fileHits] of grouped) {
      const head = document.createElement('div');
      head.className = 'sr-file';
      head.textContent = file;
      head.title = file;
      box.appendChild(head);
      for (const hit of fileHits) {
        const row = document.createElement('div');
        row.className = 'sr-hit';
        row.textContent = `${hit.line}: ${hit.text}`;
        row.addEventListener('click', () => openFile(file, hit.line));
        box.appendChild(row);
      }
    }
  } catch (err) {
    box.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
});

/* ── Monaco editor ──────────────────────────────────────────── */
function loadMonaco() {
  if (state.monacoReady || window.__monacoLoading) return;
  window.__monacoLoading = true;
  const script = document.createElement('script');
  script.src = '/vendor/monaco/vs/loader.js';
  script.onload = () => {
    window.require.config({
      paths: { vs: '/vendor/monaco/vs' },
      'vs/nls': { availableLanguages: { '*': 'en' } },
    });
    window.require(['vs/editor/editor.main'], () => {
      monaco.editor.defineTheme('arena-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '5e6a82', fontStyle: 'italic' },
          { token: 'string', foreground: '3ddc97' },
          { token: 'keyword', foreground: '7c6cff' },
          { token: 'number', foreground: 'f5a524' },
          { token: 'type', foreground: '4da3ff' },
        ],
        colors: {
          'editor.background': '#0b0d12',
          'editor.lineHighlightBackground': '#12161f',
          'editorLineNumber.foreground': '#3a4356',
          'editorLineNumber.activeForeground': '#909bb1',
          'editor.selectionBackground': '#2a3350',
          'editorCursor.foreground': '#7c6cff',
          'editorWidget.background': '#151923',
          'editorWidget.border': '#232a38',
        },
      });

      state.editor = monaco.editor.create($('#monacoContainer'), {
        value: '',
        language: 'plaintext',
        theme: 'arena-dark',
        automaticLayout: true,
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: true, maxColumn: 70, renderCharacters: false },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        renderLineHighlight: 'all',
        padding: { top: 10 },
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        tabSize: 2,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      });

      state.editor.onDidChangeModelContent(() => {
        const entry = state.openFiles.get(state.activeFile);
        if (!entry) return;
        const value = state.editor.getValue();
        if (value !== entry.content) {
          entry.dirty = true;
          $('#btnSaveFile').disabled = false;
          renderTabs();
          renderTree();
        }
      });

      state.editor.onDidChangeCursorPosition((e) => {
        $('#editorPos').textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
      });

      state.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveActiveFile);

      state.monacoReady = true;
      if (state.activeFile) openFile(state.activeFile, null, { force: true });
    });
  };
  script.onerror = () => toast('Editor failed to load — plain textarea fallback active', 'error');
  document.head.appendChild(script);
}

function renderTabs() {
  const container = $('#editorTabs');
  container.innerHTML = '';
  for (const [file, entry] of state.openFiles) {
    const tab = document.createElement('div');
    tab.className = 'tab' + (file === state.activeFile ? ' active' : '');
    tab.title = file;
    tab.innerHTML = `
      <span>${escapeHtml(file.split('/').pop())}</span>
      ${entry.dirty ? '<span class="dirty-dot"></span>' : '<span class="close">×</span>'}
    `;
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('close')) {
        closeFile(file);
      } else {
        openFile(file);
      }
    });
    container.appendChild(tab);
  }
  // Terminal tab lives separately; add a hint when no tabs
  if (!state.openFiles.size) {
    container.innerHTML = '<div class="tab" style="cursor:default;color:#4c5670">Explorer</div>';
  }
}

async function openFile(relPath, line = null, { force = false } = {}) {
  try {
    let entry = state.openFiles.get(relPath);
    if (!entry || force) {
      const data = await api(`/api/file?path=${encodeURIComponent(relPath)}`);
      entry = { content: data.content, dirty: false, lang: data.language };
      state.openFiles.set(relPath, entry);
    }
    state.activeFile = relPath;
    $('#editorEmpty').hidden = true;
    $('#editorPath').textContent = relPath;
    $('#editorLang').textContent = entry.lang || '';
    $('#btnSaveFile').disabled = !entry.dirty;

    if (state.monacoReady) {
      const model = state.editor.getModel();
      if (model) model.dispose();
      state.editor.setModel(
        monaco.editor.createModel(entry.content, entry.lang || 'plaintext')
      );
      if (line) {
        state.editor.revealLineInCenter(line);
        state.editor.setPosition({ lineNumber: line, column: 1 });
        state.editor.focus();
      }
    }
    renderTabs();
    renderTree();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function closeFile(relPath) {
  const entry = state.openFiles.get(relPath);
  if (entry?.dirty && !confirm(`Discard unsaved changes to ${relPath}?`)) return;
  state.openFiles.delete(relPath);
  if (state.activeFile === relPath) {
    state.activeFile = [...state.openFiles.keys()].pop() || null;
    if (state.activeFile) openFile(state.activeFile);
    else {
      $('#editorEmpty').hidden = false;
      $('#editorPath').textContent = '—';
      $('#editorLang').textContent = '';
      $('#btnSaveFile').disabled = true;
      if (state.monacoReady) state.editor.setModel(null);
    }
  }
  renderTabs();
  renderTree();
}

async function saveActiveFile() {
  const file = state.activeFile;
  const entry = state.openFiles.get(file);
  if (!file || !entry) return;
  const content = state.monacoReady ? state.editor.getValue() : entry.content;
  try {
    await api('/api/file', { method: 'PUT', body: JSON.stringify({ path: file, content }) });
    entry.content = content;
    entry.dirty = false;
    $('#btnSaveFile').disabled = true;
    renderTabs();
    renderTree();
    toast(`Saved ${file}`, 'ok');
    refreshGit();
  } catch (err) {
    toast(err.message, 'error');
  }
}

$('#btnSaveFile').addEventListener('click', saveActiveFile);
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveActiveFile();
  }
});

/* ── Git panel ──────────────────────────────────────────────── */
async function refreshGit() {
  try {
    const status = await api('/api/git/status');
    if (!status.isRepo) {
      $('#gitBranch').textContent = 'no repo';
      $('#gitBranchRow').innerHTML = '<span>Not a git repository</span> <button class="btn xs" id="btnInitGit">Init</button>';
      $('#gitChangesList').innerHTML = '';
      $('#btnInitGit')?.addEventListener('click', async () => {
        try {
          await api('/api/git/init', { method: 'POST' });
          toast('Initialized git repository', 'ok');
          refreshGit();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
      return;
    }

    $('#gitBranch').textContent = status.branch;
    const badge = $('#gitChanges');
    if (status.files.length) {
      badge.hidden = false;
      badge.textContent = status.files.length;
    } else {
      badge.hidden = true;
    }

    $('#gitBranchRow').innerHTML = `
      <span>⎇ ${escapeHtml(status.branch)}</span>
      ${status.ahead ? `<span style="color:var(--green)">↑${status.ahead}</span>` : ''}
      ${status.behind ? `<span style="color:var(--amber)">↓${status.behind}</span>` : ''}
      <span style="margin-left:auto;color:var(--text-faint)">${status.clean ? 'clean' : `${status.files.length} changed`}</span>
    `;

    const list = $('#gitChangesList');
    list.innerHTML = '';
    for (const file of status.files) {
      const row = document.createElement('div');
      row.className = 'git-file';
      const code = file.index !== ' ' && file.index !== '?' ? file.index : file.worktree;
      row.innerHTML = `<span class="code ${code}">${escapeHtml(code)}</span><span class="fpath">${escapeHtml(file.path)}</span>`;
      row.title = `${file.path} — ${file.status}`;
      row.addEventListener('click', async () => {
        try {
          const { diff } = await api(`/api/git/diff?path=${encodeURIComponent(file.path)}`);
          if (diff) {
            addAgentBlock(`<pre style="margin:0">${escapeHtml(diff)}</pre>`, 'git-diff');
          } else {
            openFile(file.path);
          }
        } catch {
          openFile(file.path);
        }
      });
      list.appendChild(row);
    }

    const log = await api('/api/git/log?limit=12');
    $('#gitLog').innerHTML = log.commits.length
      ? log.commits
          .map(
            (c) =>
              `<div class="git-log-item"><span class="h">${escapeHtml(c.short)}</span> ${escapeHtml(
                c.subject
              )}<br><span style="color:var(--text-faint)">${escapeHtml(c.author)} · ${new Date(
                c.date
              ).toLocaleDateString()}</span></div>`
          )
          .join('')
      : '<div class="empty" style="padding:8px 0">No commits yet</div>';
  } catch {
    /* silent — git refresh is best effort */
  }
}

$('#btnGitRefresh').addEventListener('click', refreshGit);

$('#btnStageAll').addEventListener('click', async () => {
  try {
    await api('/api/git/stage', { method: 'POST', body: JSON.stringify({ paths: ['.'] }) });
    toast('Staged all changes', 'ok');
    refreshGit();
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#btnCommit').addEventListener('click', async () => {
  const message = $('#commitMessage').value.trim();
  if (!message) return toast('Enter a commit message first', 'error');
  try {
    const out = await api('/api/git/commit', {
      method: 'POST',
      body: JSON.stringify({ message, all: true }),
    });
    $('#commitMessage').value = '';
    toast('Committed', 'ok');
    refreshGit();
    if (out.stdout) addAgentBlock(`<pre style="margin:0">${escapeHtml(out.stdout)}</pre>`);
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('#gitChip').addEventListener('click', () => {
  $$('.rail-btn[data-panel]').find((b) => b.dataset.panel === 'git')?.click();
});

/* ── Terminal ───────────────────────────────────────────────── */
const termState = { term: null, fit: null, socket: null, started: false };

function initTerminal() {
  if (termState.term) return;
  const Terminal = window.Terminal;
  // The UMD bundles attach their constructors to globalThis with the same name
  // as the module (window.FitAddon.FitAddon), so accept both shapes.
  const FitAddon = (window.FitAddon && (window.FitAddon.FitAddon || window.FitAddon)) || null;
  if (!Terminal || !FitAddon) {
    toast('Terminal library failed to load', 'error');
    return;
  }
  const term = new Terminal({
    fontSize: 12.5,
    lineHeight: 1.35,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    cursorBlink: true,
    cursorStyle: 'bar',
    theme: {
      background: '#0b0d12',
      foreground: '#dfe4ee',
      cursor: '#7c6cff',
      black: '#0b0d12',
      red: '#ff5c72',
      green: '#3ddc97',
      yellow: '#f5a524',
      blue: '#4da3ff',
      magenta: '#7c6cff',
      cyan: '#39d0d8',
      white: '#dfe4ee',
      brightBlack: '#5e6a82',
      brightRed: '#ff7d8e',
      brightGreen: '#5ee8ad',
      brightYellow: '#ffbe4d',
      brightBlue: '#6fb8ff',
      brightMagenta: '#9b8dff',
      brightCyan: '#5fe0e7',
      brightWhite: '#ffffff',
    },
    allowProposedApi: true,
    scrollback: 5000,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  if (window.WebLinksAddon) {
    const Links = window.WebLinksAddon.WebLinksAddon || window.WebLinksAddon;
    try {
      term.loadAddon(new Links());
    } catch {
      /* optional addon */
    }
  }
  term.open($('#terminalHost'));
  setTimeout(() => fit.fit(), 30);
  termState.term = term;
  termState.fit = fit;

  term.writeln('\x1b[38;5;99m◆ Arena terminal\x1b[0m \x1b[90m— real Linux shell, full TTY\x1b[0m');
  term.write('\x1b[90m  starting…\x1b[0m\r\n');

  term.onData((data) => {
    if (termState.socket?.readyState === WebSocket.OPEN) {
      termState.socket.send(JSON.stringify({ type: 'input', data }));
    }
  });

  window.addEventListener('resize', () => {
    fit.fit();
    if (termState.socket?.readyState === WebSocket.OPEN) {
      termState.socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    }
  });
  new ResizeObserver(() => fit.fit()).observe($('#terminalHost'));
}

function connectTerminal() {
  if (termState.socket?.readyState === WebSocket.OPEN) return;
  initTerminal();
  const term = termState.term;
  const socket = new WebSocket(
    wsUrl('/ws/terminal', { cols: term.cols || 100, rows: term.rows || 30 })
  );
  termState.socket = socket;
  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'start', cols: term.cols, rows: term.rows }));
  };
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'data') term.write(msg.data);
    else if (msg.type === 'exit') {
      term.write(`\r\n\x1b[90m[shell exited with code ${msg.exitCode}]\x1b[0m\r\n`);
      termState.started = false;
    } else if (msg.type === 'started') {
      termState.started = true;
    }
  };
  socket.onclose = () => {
    termState.started = false;
    setTimeout(() => {
      if (!$('#terminalPane').classList.contains('hidden-pane')) connectTerminal();
    }, 1200);
  };
}

$('#btnClearTerm').addEventListener('click', () => {
  termState.term?.clear();
  termState.term?.write('\x1b[2J\x1b[3J\x1b[H');
});
$('#btnRestartTerm').addEventListener('click', () => {
  termState.socket?.send(JSON.stringify({ type: 'kill' }));
  termState.socket?.close();
  termState.socket = null;
  termState.term?.reset();
  setTimeout(() => {
    connectTerminal();
  }, 200);
});
function showTerminal(show) {
  $('#terminalPane').classList.toggle('hidden-pane', !show);
  $('#btnShowTerm').hidden = show;
  $('#btnToggleTerm').hidden = !show;
  if (show) {
    setTimeout(() => {
      termState.fit?.fit();
      if (termState.socket?.readyState === WebSocket.OPEN) {
        termState.socket.send(
          JSON.stringify({ type: 'resize', cols: termState.term.cols, rows: termState.term.rows })
        );
      } else {
        connectTerminal();
      }
    }, 60);
  }
}
$('#btnToggleTerm').addEventListener('click', () => showTerminal(false));
$('#btnShowTerm').addEventListener('click', () => showTerminal(true));
// bring terminal back via layout button
$('#btnLayout').addEventListener('click', () => {
  showTerminal($('#terminalPane').classList.contains('hidden-pane'));
});

/* ── Splitter (drag terminal height) ────────────────────────── */
{
  let dragging = false;
  const splitter = $('#hSplitter');
  splitter.addEventListener('mousedown', (e) => {
    dragging = true;
    e.preventDefault();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const area = $('#workArea').getBoundingClientRect();
    const height = Math.min(Math.max(90, area.bottom - e.clientY), area.height - 140);
    $('#terminalPane').style.flexBasis = `${height}px`;
    termState.fit?.fit();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
}

/* ── Chat / agent ───────────────────────────────────────────── */
const messagesEl = $('#messages');
let currentBubble = null;
let currentText = '';
let thinkingEl = null;

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearWelcome() {
  messagesEl.querySelector('.welcome')?.remove();
}

function addUserMessage(text) {
  clearWelcome();
  const wrap = document.createElement('div');
  wrap.className = 'msg user';
  wrap.innerHTML = `
    <div class="avatar">${escapeHtml(initials())}</div>
    <div class="bubble"></div>
  `;
  wrap.querySelector('.bubble').textContent = text;
  messagesEl.appendChild(wrap);
  scrollToBottom();
}

function initials() {
  return 'Y';
}

function addAgentMessage() {
  clearWelcome();
  const wrap = document.createElement('div');
  wrap.className = 'msg agent';
  wrap.innerHTML = `
    <div class="avatar">◆</div>
    <div class="bubble"><div class="content"></div><div class="extras"></div></div>
  `;
  messagesEl.appendChild(wrap);
  currentBubble = wrap.querySelector('.content');
  currentBubble.dataset.raw = '';
  currentText = '';
  scrollToBottom();
  return currentBubble;
}

function addAgentBlock(html) {
  clearWelcome();
  const wrap = document.createElement('div');
  wrap.className = 'msg agent';
  wrap.innerHTML = `<div class="avatar">◆</div><div class="bubble"><div class="content">${html}</div></div>`;
  messagesEl.appendChild(wrap);
  scrollToBottom();
}

function showThinking(text = 'Thinking…') {
  if (!thinkingEl) {
    thinkingEl = document.createElement('div');
    thinkingEl.className = 'thinking';
    messagesEl.appendChild(thinkingEl);
  }
  thinkingEl.innerHTML = `<div class="spinner"></div><span>${escapeHtml(text)}</span>`;
  scrollToBottom();
}

function hideThinking() {
  thinkingEl?.remove();
  thinkingEl = null;
}

function renderStreaming() {
  if (!currentBubble) return;
  currentBubble.innerHTML = renderMarkdown(currentText) + '<span class="cursor-blink"></span>';
  scrollToBottom();
}

function toolCard(callId, tool, args) {
  hideThinking();
  clearWelcome();
  const card = document.createElement('div');
  card.className = 'toolcard';
  card.dataset.callId = callId;
  const argSummary = summarizeArgs(tool, args);
  card.innerHTML = `
    <div class="toolcard-head">
      <span class="dot pending"></span>
      <span class="tname">${escapeHtml(tool)}</span>
      <span class="targs">${escapeHtml(argSummary)}</span>
      <span class="chev" style="color:var(--text-faint);font-size:9px">▾</span>
    </div>
    <div class="toolcard-body" hidden></div>
  `;
  card.querySelector('.toolcard-head').addEventListener('click', () => {
    const body = card.querySelector('.toolcard-body');
    body.hidden = !body.hidden;
  });
  messagesEl.appendChild(card);
  scrollToBottom();

  // End the current text bubble so later text starts fresh.
  currentBubble = null;
  currentText = '';
  return card;
}

function summarizeArgs(tool, args) {
  if (args == null) return '';
  if (typeof args === 'string') return args.slice(0, 90);
  const priority = ['path', 'from', 'to', 'command', 'pattern', 'query', 'message', 'summary', 'name'];
  for (const key of priority) {
    if (args[key] != null) return String(args[key]).slice(0, 110);
  }
  try {
    return JSON.stringify(args).slice(0, 110);
  } catch {
    return '';
  }
}

function toolResult(callId, ok, output) {
  const card = messagesEl.querySelector(`.toolcard[data-call-id="${CSS.escape(callId)}"]`);
  if (!card) return;
  const dot = card.querySelector('.dot');
  dot.classList.remove('pending');
  dot.classList.add(ok ? 'ok' : 'err');
  const body = card.querySelector('.toolcard-body');
  body.textContent = output || '(no output)';
  // Auto-expand failures so the user sees what broke.
  if (!ok) body.hidden = false;
  if (ok && output && output.length < 400) body.hidden = false;
  scrollToBottom();
  if (ok) {
    loadTree();
    refreshGit();
    // If the agent edited the file that's open, refresh it if not dirty.
    const activeEntry = state.openFiles.get(state.activeFile);
    if (activeEntry && !activeEntry.dirty) {
      api(`/api/file?path=${encodeURIComponent(state.activeFile)}`)
        .then((data) => {
          if (data.content !== activeEntry.content) {
            activeEntry.content = data.content;
            if (state.monacoReady && state.editor) state.editor.setValue(data.content);
          }
        })
        .catch(() => {});
    }
  }
}

function approvalCard({ approvalId, tool, args }) {
  hideThinking();
  clearWelcome();
  const card = document.createElement('div');
  card.className = 'approval';
  const pretty = typeof args === 'string' ? args : JSON.stringify(args, null, 2);
  card.innerHTML = `
    <div class="approval-title">Approval needed: ${escapeHtml(tool)}</div>
    <pre>${escapeHtml(pretty || '')}</pre>
    <div class="approval-actions">
      <button class="btn primary sm" data-act="approve">Run it</button>
      <button class="btn sm" data-act="deny">Skip</button>
    </div>
  `;
  card.addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    send({ type: 'approval', approvalId, approved: act === 'approve' });
    card.querySelector('.approval-actions').innerHTML = `<span style="font-size:12px;color:var(--text-dim)">${
      act === 'approve' ? 'Approved' : 'Skipped'
    }</span>`;
  });
  messagesEl.appendChild(card);
  scrollToBottom();
}

/* ── Agent socket ───────────────────────────────────────────── */
function setConnection(mode) {
  const el = $('#connStatus');
  el.className = `conn ${mode}`;
  el.innerHTML = `<i></i> ${mode === 'online' ? 'connected' : mode === 'offline' ? 'disconnected' : 'connecting'}`;
}

function connectAgent() {
  if (state.agentSocket?.readyState === WebSocket.OPEN) return;
  setConnection('connecting');
  const qs = new URLSearchParams({ session: state.sessionId });
  if (state.model) qs.set('model', state.model);
  if (state.token) qs.set('token', state.token);
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${proto}//${location.host}/ws/agent?${qs}`);
  state.agentSocket = socket;

  socket.onopen = () => {
    state.connected = true;
    setConnection('online');
  };
  socket.onclose = () => {
    state.connected = false;
    setRunning(false);
    setConnection('offline');
    setTimeout(connectAgent, 2000);
  };
  socket.onerror = () => setConnection('offline');
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'ready') {
      if (!state.model) {
        state.model = msg.session.model;
        const select = $('#modelSelect');
        if (select && [...select.options].some((o) => o.value === state.model)) {
          select.value = state.model;
        }
      }
      if (msg.session.messages?.length && !state.historyRendered) {
        state.historyRendered = true;
        replayHistory(msg.session.messages);
      }
    } else if (msg.type === 'agent_event') {
      handleAgentEvent(msg.event);
    }
  };
}

function replayHistory(messages) {
  messagesEl.innerHTML = '';
  currentBubble = null;
  currentText = '';
  for (const m of messages) {
    if (m.role === 'user') {
      addUserMessage(m.content);
    } else if (m.role === 'assistant' && m.content) {
      addAgentBlock(renderMarkdown(m.content));
    }
  }
}

function send(payload) {
  if (state.agentSocket?.readyState !== WebSocket.OPEN) {
    toast('Not connected to the agent — reconnecting…', 'error');
    connectAgent();
    return false;
  }
  state.agentSocket.send(JSON.stringify(payload));
  return true;
}

function handleAgentEvent(evt) {
  switch (evt.type) {
    case 'turn_start':
      setRunning(true);
      break;

    case 'text_delta': {
      hideThinking();
      if (!currentBubble) {
        addAgentMessage();
      }
      currentText += evt.text;
      // Coalesce renders for smooth streaming.
      if (!handleAgentEvent._raf) {
        handleAgentEvent._raf = requestAnimationFrame(() => {
          handleAgentEvent._raf = null;
          renderStreaming();
        });
      }
      break;
    }

    case 'thinking':
      if (!currentBubble || !currentText) showThinking(evt.text);
      break;

    case 'tool_call':
      if (currentBubble && currentText) {
        currentBubble.innerHTML = renderMarkdown(currentText);
        currentBubble = null;
        currentText = '';
      }
      toolCard(evt.callId, evt.tool, evt.args);
      break;

    case 'tool_result':
      toolResult(evt.callId, evt.ok, evt.output);
      break;

    case 'approval_request':
      approvalCard(evt);
      break;

    case 'usage':
      updateUsage(evt.usage);
      break;

    case 'finish':
      // The agent signalled completion; show its summary as the final answer.
      break;

    case 'error':
      hideThinking();
      addAgentBlock(`<p style="color:var(--red)">⚠ ${escapeHtml(evt.message)}</p>`);
      toast(evt.message, 'error');
      setRunning(false);
      break;

    case 'turn_end':
      hideThinking();
      if (currentBubble && currentText) {
        currentBubble.innerHTML = renderMarkdown(currentText);
      }
      currentBubble = null;
      currentText = '';
      setRunning(false);
      loadTree();
      refreshGit();
      break;

    case 'reset':
      currentBubble = null;
      currentText = '';
      state.historyRendered = false;
      loadWelcome();
      toast('Conversation reset', 'ok');
      break;
  }
}

function updateUsage(usage) {
  if (!usage) return;
  const total = usage.total_tokens ?? (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
  $('#usageInfo').textContent = total ? `${total.toLocaleString()} tokens` : '';
}

function setRunning(running) {
  state.running = running;
  $('#btnSend').disabled = running;
  $('#btnAbort').hidden = !running;
  $('#promptInput').disabled = running;
  if (!running) $('#promptInput').focus();
}

/* ── Composer actions ───────────────────────────────────────── */
const promptInput = $('#promptInput');

function autoGrow() {
  promptInput.style.height = 'auto';
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
}
promptInput.addEventListener('input', autoGrow);
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitPrompt();
  }
});
$('#btnSend').addEventListener('click', submitPrompt);
$('#btnAbort').addEventListener('click', () => {
  send({ type: 'abort' });
  toast('Stopping…');
});

function submitPrompt() {
  const text = promptInput.value.trim();
  if (!text || state.running) return;
  promptInput.value = '';
  autoGrow();
  addUserMessage(text);
  addAgentMessage();
  showThinking('Thinking…');
  const ok = send({
    type: 'chat',
    message: text,
    ...(state.model ? { model: state.model } : {}),
    approvalMode: state.approvalMode,
  });
  if (!ok) {
    hideThinking();
    return;
  }
  setRunning(true);
}

$$('.suggestion').forEach((btn) => {
  btn.addEventListener('click', () => {
    promptInput.value = btn.textContent;
    autoGrow();
    submitPrompt();
  });
});

function populateModels({ models, current }) {
  const select = $('#modelSelect');
  const ids = models.map((m) => m.id);
  // Keep the user's pick if the API still offers it; otherwise fall back to
  // the server's configured model.
  if (!state.model || !ids.includes(state.model)) {
    state.model = ids.includes(current) ? current : ids[0] || current;
  }
  select.innerHTML = models
    .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.id)}</option>`)
    .join('');
  select.value = state.model;
  select.title = `Model: ${state.model}`;
}

$('#modelSelect').addEventListener('change', (e) => {
  state.model = e.target.value;
  localStorage.setItem('agent.model', state.model);
  send({ type: 'set_model', model: state.model });
  toast(`Model set to ${state.model}`);
});

$('#approvalToggle').addEventListener('change', (e) => {
  state.approvalMode = e.target.checked ? 'ask' : 'auto';
  localStorage.setItem('agent.approval', state.approvalMode);
  send({ type: 'set_approval_mode', approvalMode: state.approvalMode });
  toast(state.approvalMode === 'ask' ? 'Approvals required for edits & commands' : 'Auto-approve enabled');
});

$('#btnResetSession').addEventListener('click', () => {
  if (!confirm('Start a new conversation? The current transcript will be cleared.')) return;
  currentBubble = null;
  currentText = '';
  $('#usageInfo').textContent = '';
  state.historyRendered = false;
  if (!send({ type: 'reset' })) loadWelcome();
});

function loadWelcome() {
  messagesEl.innerHTML = `
    <div class="welcome">
      <div class="welcome-mark">◆</div>
      <h2>Your personal AI coding agent</h2>
      <p>Powered by Inception Labs Mercury. It reads your files, edits code, runs commands in a real Linux terminal, and commits with git.</p>
      <div class="suggestions">
        <button class="suggestion">Explain the structure of this project</button>
        <button class="suggestion">Add a README with setup instructions</button>
        <button class="suggestion">Find and fix any bugs in the server</button>
        <button class="suggestion">Set up a test suite and run it</button>
      </div>
    </div>`;
  $$('.suggestion').forEach((btn) => {
    btn.addEventListener('click', () => {
      promptInput.value = btn.textContent;
      submitPrompt();
    });
  });
}

/* ── Boot ───────────────────────────────────────────────────── */
async function boot() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('token')) localStorage.setItem('agent.token', params.get('token'));

    const health = await api('/api/health');
    if (!health.hasApiKey) {
      addAgentBlock(
        `<p style="color:var(--amber)">⚠ No Inception Labs API key configured.</p>
         <p>Add <code>INCEPTION_API_KEY</code> to your <code>.env</code> file and restart the server.</p>`
      );
    }
    if (health.workspace) {
      document.querySelector('.brand-name').title = `Workspace: ${health.workspace}`;
    }
  } catch (err) {
    toast(`Server unreachable: ${err.message}`, 'error');
  }

  try {
    const data = await api('/api/models');
    populateModels(data);
    if (data.source === 'fallback') {
      console.warn('Using fallback model list:', data.error);
    }
  } catch (err) {
    populateModels({ models: [{ id: state.model || 'mercury-3' }], current: state.model || 'mercury-3' });
  }

  $('#approvalToggle').checked = state.approvalMode === 'ask';
  connectAgent();
  connectTerminal();
  loadTree();
  refreshGit();
  loadMonaco();
  setTimeout(autoGrow, 50);
}

boot();

// Small surface for debugging and automated UI tests.
window.__arena = {
  state,
  renderMarkdown,
  escapeHtml,
  api,
  openFile,
  refreshGit,
  loadTree,
};

window.addEventListener('beforeunload', () => {
  termState.socket?.close();
});
