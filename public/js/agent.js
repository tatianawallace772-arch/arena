/**
 * Core Codex — agent.js
 * The coding-agent workspace: sessions sidebar, streaming chat with agent
 * stage traces, multi-file output panel with live code streaming, ZIP export.
 */
(function () {
  'use strict';

  if (!window.CC) return;
  const { $, $$, el, escapeHtml } = CC;

  const SUGGESTIONS = [
    { icon: '✅', title: 'Build a todo app', sub: 'Vanilla JS, localStorage, filters', prompt: 'Build a beautiful todo app in vanilla JavaScript with localStorage persistence and filters.' },
    { icon: '🚀', title: 'Create a SaaS landing page', sub: 'Hero, features, pricing, waitlist', prompt: 'Create a modern SaaS landing page with a hero section, features, pricing tiers and an email waitlist form.' },
    { icon: '🐍', title: 'Write a Python CLI tool', sub: 'Organize files by type, --dry-run', prompt: 'Write a Python CLI tool that organizes files in a folder into subfolders by type, with a dry-run mode.' },
    { icon: '🎮', title: 'Make a snake game', sub: 'Canvas, keyboard controls, score', prompt: 'Make a snake game on HTML canvas with keyboard controls and a best-score display.' },
    { icon: '⚙️', title: 'Build a REST API', sub: 'Zero-dependency Node CRUD server', prompt: 'Build a REST API server in Node.js with CRUD endpoints, validation and proper status codes.' },
    { icon: '🧮', title: 'Explain Big-O', sub: 'Cheatsheet + complexity table', prompt: 'Explain Big-O notation with a cheatsheet table', mode: 'ask' },
  ];

  const Agent = { mount, unmount: null };

  /* ------------------------------- state ---------------------------------- */

  let sessions = [];
  let currentId = null;
  let generating = false;
  let streamCtl = null;
  let cleanupFns = [];
  let filesByPath = {};     // files of latest assistant turn
  let writingPath = null;
  let selectedPath = null;
  let lastFilesMessage = null;

  function loadSessions() {
    sessions = CC.ls.get('cc_sessions', []);
  }
  function persistSessions() {
    try { CC.ls.set('cc_sessions', sessions.slice(0, 40)); } catch { /* full */ }
  }
  function currentSession() {
    return sessions.find((s) => s.id === currentId) || null;
  }
  function newSession(model) {
    const s = { id: 's_' + Date.now().toString(36), title: 'New session', createdAt: new Date().toISOString(), messages: [], model, mode: 'agent' };
    sessions.unshift(s);
    currentId = s.id;
    persistSessions();
    return s;
  }

  /* ------------------------------- mounting -------------------------------- */

  function mount(view) {
    loadSessions();
    const settings = CC.getSettings();

    const shell = el('div', { class: 'agent-shell', id: 'agent-shell' });

    /* Sidebar */
    const side = el('aside', { class: 'agent-side' },
      el('button', { class: 'btn btn-primary btn-sm new-chat', onclick: () => startNewSession() }, '+  New session'),
      el('div', { class: 'side-label', style: 'margin-top:8px' }, 'Sessions'),
      el('div', { class: 'session-list', id: 'session-list' }),
      el('div', { class: 'side-usage', id: 'side-usage' })
    );

    /* Main column */
    const main = el('div', { class: 'agent-main' },
      el('div', { class: 'chat-scroll', id: 'chat-scroll' },
        el('div', { class: 'chat-inner', id: 'chat-inner' })
      ),
      el('div', { class: 'composer-wrap' }, buildComposer())
    );

    /* Files panel */
    const filesPanel = el('aside', { class: 'files-panel', id: 'files-panel' },
      el('div', { class: 'files-head' },
        el('h3', {}, 'Workspace ', el('span', { class: 'files-count', id: 'files-count', text: '0' })),
        el('button', { class: 'btn btn-ghost btn-sm', id: 'dl-zip', onclick: downloadZip }, '⬇ .zip')
      ),
      el('div', { class: 'file-tree', id: 'file-tree' }),
      el('div', { class: 'file-viewer', id: 'file-viewer', style: 'display:none' })
    );

    shell.appendChild(side);
    shell.appendChild(main);
    shell.appendChild(filesPanel);
    view.appendChild(shell);

    // Start with a fresh session if none exists
    if (!sessions.length) {
      newSession(settings.defaultModel || 'glm-5.2');
    } else {
      currentId = sessions[0].id;
    }

    renderSessionList();
    restoreWorkspace(currentSession());
    renderChat();
    renderUsage();
    renderFilesPanel();

    cleanupFns.push(() => {
      if (streamCtl) streamCtl.abort();
    });

    Agent.unmount = () => {
      cleanupFns.forEach((fn) => { try { fn(); } catch { /* noop */ } });
      cleanupFns = [];
      view.innerHTML = '';
      Agent.unmount = null;
    };

    const onPlan = () => renderUsage();
    window.addEventListener('cc:plan', onPlan);
    cleanupFns.push(() => window.removeEventListener('cc:plan', onPlan));
  }

  /* ------------------------------ composer --------------------------------- */

  function buildComposer() {
    const composer = el('div', { class: 'composer' });
    const textarea = el('textarea', {
      id: 'composer-input',
      rows: '1',
      placeholder: 'Describe what to build…  (e.g. “a todo app with filters”)',
      oninput: () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
      },
      onkeydown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submit();
        }
      },
    });

    const modeSwitch = el('div', { class: 'mode-switch', role: 'tablist' },
      el('button', { class: 'active', id: 'mode-agent', role: 'tab', onclick: () => setMode('agent') }, '⚙ Agent'),
      el('button', { id: 'mode-ask', role: 'tab', onclick: () => setMode('ask') }, '💬 Ask')
    );

    const modelSelect = el('select', { class: 'model-select', id: 'model-select', title: 'Model' });

    const sendBtn = el('button', {
      class: 'send-btn', id: 'send-btn', title: 'Generate (Enter)',
      onclick: () => (generating ? stopGeneration() : submit()),
    });
    sendBtn.innerHTML =
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';

    composer.appendChild(textarea);
    composer.appendChild(
      el('div', { class: 'composer-bar' },
        modeSwitch,
        modelSelect,
        el('span', { class: 'composer-hint', id: 'composer-status' }),
        sendBtn
      )
    );

    // Populate models
    CC.api('/api/models').then((data) => {
      const settings = CC.getSettings();
      data.models.forEach((m) => {
        const opt = el('option', { value: m.id, text: m.name + (m.badge === 'newest' ? '  ✦' : m.badge === 'free' ? '  (free)' : '') });
        modelSelect.appendChild(opt);
      });
      const sess = currentSession();
      modelSelect.value = (sess && sess.model) || settings.defaultModel || data.default;
      if (!modelSelect.value) modelSelect.value = data.default;
      modelSelect.addEventListener('change', () => {
        const s = currentSession();
        if (s) { s.model = modelSelect.value; persistSessions(); }
        const st = CC.getSettings();
        st.defaultModel = modelSelect.value;
        CC.saveSettings(st);
      });
    }).catch(() => {
      modelSelect.appendChild(el('option', { value: 'glm-5.2', text: 'GLM-5.2' }));
    });

    return composer;
  }

  function setMode(mode) {
    const s = currentSession();
    if (s) { s.mode = mode; persistSessions(); }
    const agentBtn = $('#mode-agent'), askBtn = $('#mode-ask');
    const input = $('#composer-input');
    if (agentBtn) agentBtn.classList.toggle('active', mode === 'agent');
    if (askBtn) askBtn.classList.toggle('active', mode === 'ask');
    if (input) input.placeholder = mode === 'agent' ? 'Describe what to build…  (e.g. “a todo app with filters”)' : 'Ask a question…  (e.g. “explain async/await”)';
  }

  /* ------------------------------ sessions UI ------------------------------ */

  function renderSessionList() {
    const list = $('#session-list');
    if (!list) return;
    list.innerHTML = '';
    sessions.forEach((s) => {
      const item = el('div', { class: 'session-item' + (s.id === currentId ? ' active' : ''), onclick: () => switchSession(s.id) },
        el('span', { class: 's-title', text: s.title || 'New session' }),
        el('button', {
          class: 's-del', title: 'Delete session', text: '✕',
          onclick: (e) => { e.stopPropagation(); deleteSession(s.id); },
        })
      );
      list.appendChild(item);
    });
  }

  function switchSession(id) {
    if (generating) stopGeneration();
    currentId = id;
    const s = currentSession();
    if (s) {
      const sel = $('#model-select');
      if (sel && s.model) sel.value = s.model;
      setMode(s.mode || 'agent');
      restoreWorkspace(s);
    }
    renderSessionList();
    renderChat();
    renderFilesPanel();
  }

  /** Load the workspace files from a session's latest file-bearing turn. */
  function restoreWorkspace(session) {
    filesByPath = {};
    writingPath = null;
    selectedPath = null;
    if (!session) return;
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const m = session.messages[i];
      if (m.files && m.files.length) {
        m.files.forEach((f) => { filesByPath[f.path] = { ...f, done: true }; });
        selectedPath = m.files[0].path;
        return;
      }
    }
  }

  function deleteSession(id) {
    sessions = sessions.filter((s) => s.id !== id);
    if (currentId === id) {
      currentId = sessions.length ? sessions[0].id : null;
      if (!currentId) newSession(($('#model-select') || {}).value || 'glm-5.2');
    }
    persistSessions();
    renderSessionList();
    renderChat();
    renderFilesPanel();
  }

  function startNewSession() {
    if (generating) stopGeneration();
    const sel = $('#model-select');
    newSession(sel ? sel.value : 'glm-5.2');
    renderSessionList();
    renderChat();
    renderFilesPanel();
  }

  /* ------------------------------- chat UI --------------------------------- */

  function renderChat() {
    const inner = $('#chat-inner');
    if (!inner) return;
    inner.innerHTML = '';
    const s = currentSession();
    if (!s || !s.messages.length) {
      inner.appendChild(buildEmptyState());
      return;
    }
    s.messages.forEach((m) => inner.appendChild(buildMessageEl(m)));
    scrollBottom(true);
  }

  function buildEmptyState() {
    const grid = el('div', { class: 'suggest-grid' });
    SUGGESTIONS.forEach((sg) => {
      grid.appendChild(el('div', {
        class: 'suggest-card', role: 'button', tabindex: '0',
        onclick: () => { const input = $('#composer-input'); input.value = sg.prompt; setMode(sg.mode || 'agent'); input.focus(); },
        onkeydown: (e) => { if (e.key === 'Enter') { const input = $('#composer-input'); input.value = sg.prompt; setMode(sg.mode || 'agent'); } },
      },
        el('span', { class: 's-icon', text: sg.icon }),
        el('span', { class: 's-title', text: sg.title }),
        el('span', { class: 's-sub', text: sg.sub })
      ));
    });

    return el('div', { class: 'agent-empty' },
      el('div', { class: 'orb' }, brandMarkSvg()),
      el('h2', { text: 'What are we building?' }),
      el('p', { text: 'Describe a project and Core Codex will plan it and write the files — or ask a question. No login needed.' }),
      grid
    );
  }

  function brandMarkSvg() {
    const span = el('span', { style: 'font-size:34px;font-weight:900;color:#07080d' });
    span.textContent = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('width', '40');
    svg.setAttribute('height', '40');
    svg.innerHTML = '<path d="M24 20v24M24 20l16 24M40 20v24" stroke="#07080d" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
    span.appendChild(svg);
    return span;
  }

  function buildMessageEl(m) {
    const wrap = el('div', { class: 'msg ' + m.role });

    if (m.role === 'user') {
      wrap.appendChild(el('div', { class: 'msg-avatar', text: 'You' }));
      wrap.appendChild(el('div', { class: 'msg-body' }, el('div', { class: 'bubble', text: m.content })));
      return wrap;
    }

    // Assistant
    wrap.appendChild(el('div', { class: 'msg-avatar' }, brandMarkSvg()));
    const body = el('div', { class: 'msg-body' });
    wrap.appendChild(body);

    const meta = el('div', { class: 'msg-meta' },
      el('span', { class: 'who', text: 'Core Codex' }),
      m.model ? el('span', { class: 'engine-tag', text: m.model }) : null,
      m.engine ? el('span', { class: 'engine-tag', text: m.engine === 'z.ai' ? 'live · z.ai' : 'local engine' }) : null,
      m.at ? el('span', { class: 'when', text: CC.timeAgo(m.at) }) : null
    );
    body.appendChild(meta);

    if (m.notice) {
      body.appendChild(el('div', { class: 'notice-chip' }, el('span', { text: '⚠' }), el('div', { text: m.notice })));
    }

    // Stage trace
    if (m.stages && m.stages.length) {
      const trace = el('div', { class: 'stage-trace', 'data-trace': '' });
      trace.appendChild(el('div', { class: 'stage-trace-header' },
        el('span', { class: 'trace-spinner spinner', style: 'display:none' }),
        el('span', { text: m.traceLabel || 'Agent plan', 'data-trace-label': '' })
      ));
      const stageList = el('div', { class: 'stage-list' });
      trace.appendChild(stageList);
      body.appendChild(trace);
      m.stages.forEach((st) => stageList.appendChild(stageEl(st)));
    }

    // Live pill (only while generating this message)
    if (m.pending) {
      body.appendChild(el('div', { class: 'generating-pill', 'data-pill': '' },
        el('span', { class: 'spinner', style: 'width:12px;height:12px' }),
        el('span', { class: 'dots', text: 'Generating' })
      ));
    }

    const md = el('div', { class: 'md' });
    md.innerHTML = CC.renderMarkdown(m.content || '');
    body.appendChild(md);
    CC.bindCopyButtons(md);

    if (m.error) {
      body.appendChild(el('div', { class: 'msg-error' }, el('span', { text: '✕' }), el('div', { text: m.error })));
    }

    if (m.files && m.files.length) {
      body.appendChild(el('div', { style: 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap' },
        el('span', { class: 'engine-tag', text: `🗂 ${m.files.length} file${m.files.length > 1 ? 's' : ''} in workspace →` })
      ));
    }

    return wrap;
  }

  function stageEl(st) {
    const div = el('div', { class: 'stage ' + (st.status || 'pending') });
    const ico = el('span', { class: 'st-ico' });
    if (st.status === 'active') ico.innerHTML = '<span class="mini-spin"></span>';
    div.appendChild(ico);
    div.appendChild(el('span', { text: st.step }));
    return div;
  }

  function scrollBottom(force) {
    const scroller = $('#chat-scroll');
    if (!scroller) return;
    const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140;
    if (force || nearBottom) scroller.scrollTop = scroller.scrollHeight;
  }

  /* ------------------------------ send / stream ----------------------------- */

  function submit() {
    const input = $('#composer-input');
    if (!input || generating) return;
    const prompt = input.value.trim();
    if (!prompt) return;

    // Quota check (mirrors Z Code-style 5h windows)
    const usage = CC.getUsage();
    const quota = CC.quotaFor(CC.getPlan().id);
    if (usage.count >= quota) {
      CC.upgradeModal(quota);
      return;
    }

    let s = currentSession();
    if (!s) { s = newSession(($('#model-select') || {}).value || 'glm-5.2'); }
    if (s.title === 'New session') {
      s.title = prompt.length > 42 ? prompt.slice(0, 42) + '…' : prompt;
    }

    const userMsg = { role: 'user', content: prompt, at: new Date().toISOString() };
    const asstMsg = {
      role: 'assistant',
      content: '',
      stages: [],
      files: [],
      pending: true,
      at: new Date().toISOString(),
      model: ($('#model-select') || { value: s.model }).value,
      mode: s.mode || 'agent',
      traceLabel: (s.mode || 'agent') === 'ask' ? 'Thinking' : 'Agent plan',
    };
    s.messages.push(userMsg, asstMsg);
    persistSessions();
    renderSessionList();

    // Rerender chat (keeps it simple), then grab the new message elements
    renderChat();
    input.value = '';
    input.style.height = 'auto';
    setGenerating(true);

    // Reset workspace files for the new turn
    filesByPath = {};
    writingPath = null;
    selectedPath = null;
    lastFilesMessage = asstMsg;

    const history = s.messages
      .slice(0, -2)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.role === 'assistant' ? m.content : m.content }));

    const settings = CC.getSettings();
    const made = makeHandler(s, asstMsg);
    streamCtl = CC.streamEvents('/api/agent', {
      prompt,
      model: asstMsg.model,
      mode: asstMsg.mode,
      apiKey: settings.apiKey || '',
      history,
    }, made.handle);

    streamCtl.promise
      .catch((err) => {
        if (err && err.name === 'AbortError') {
          asstMsg.content += '\n\n*(stopped)*';
        } else {
          asstMsg.error = (err && err.message) || 'Something went wrong. Please try again.';
        }
        made.finish(s, asstMsg);
      })
      .then(() => { streamCtl = null; });
  }

  function makeHandler(session, msg) {
    let renderTimer = null;
    let pendingRender = false;

    const getEls = () => {
      const msgs = $$('#chat-inner .msg');
      const node = msgs[msgs.length - 1];
      return {
        root: node,
        md: node ? node.querySelector('.md') : null,
        stageList: node ? node.querySelector('.stage-list') : null,
        pill: node ? node.querySelector('[data-pill]') : null,
        traceSpinner: node ? node.querySelector('.trace-spinner') : null,
      };
    };

    const scheduleMd = () => {
      pendingRender = true;
      if (renderTimer) return;
      renderTimer = setInterval(() => {
        if (!pendingRender) { clearInterval(renderTimer); renderTimer = null; return; }
        pendingRender = false;
        const { md } = getEls();
        if (md) md.innerHTML = CC.renderMarkdown(msg.content || '');
        scrollBottom(false);
      }, 110);
    };
    const flushMd = () => {
      if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
      const { md } = getEls();
      if (md) md.innerHTML = CC.renderMarkdown(msg.content || '');
    };

    return { handle: function handleEvent(evt) { handleEventBody(evt); }, finish };

    function handleEventBody(evt) {
      switch (evt.type) {
        case 'meta':
          msg.engine = evt.engine;
          if (evt.engine === 'z.ai') CC.setEngineChip('live');
          break;
        case 'notice':
          msg.notice = evt.message;
          break;
        case 'stage': {
          msg.stages = msg.stages.filter((x) => x.step !== evt.step);
          msg.stages.push({ step: evt.step, status: evt.status });
          const { stageList, traceSpinner } = getEls();
          if (stageList) {
            stageList.innerHTML = '';
            msg.stages.forEach((st) => stageList.appendChild(stageEl(st)));
          }
          if (traceSpinner) traceSpinner.style.display = evt.status === 'done' ? '' : '';
          scrollBottom(false);
          break;
        }
        case 'file-start':
          filesByPath[evt.path] = { path: evt.path, language: evt.language || 'text', content: '' };
          writingPath = evt.path;
          if (!selectedPath) selectedPath = evt.path;
          msg.files = Object.values(filesByPath);
          renderFilesPanel();
          scrollBottom(false);
          break;
        case 'file-delta': {
          const f = filesByPath[evt.path];
          if (f) { f.content += evt.chunk; }
          updateFileViewer();
          break;
        }
        case 'file-end': {
          const f = filesByPath[evt.path];
          if (f) { f.done = true; }
          writingPath = null;
          renderFilesPanel();
          break;
        }
        case 'delta':
          msg.content += evt.text;
          scheduleMd();
          break;
        case 'usage':
          msg.usage = evt;
          break;
        case 'error':
          msg.error = evt.message;
          break;
        case 'done':
          finish(session, msg);
          break;
        default:
          break;
      }
    };

    function finish(sess, m) {
      if (!m.pending) return;
      m.pending = false;
      flushMd();
      setGenerating(false);
      const pill = $('#chat-inner [data-pill]');
      if (pill) pill.remove();
      renderChat(); // final clean render
      persistSessions();
      CC.bumpUsage();
      renderUsage();
      renderFilesPanel();
    }
  }

  function setGenerating(on) {
    generating = on;
    const btn = $('#send-btn');
    const status = $('#composer-status');
    if (btn) {
      btn.classList.toggle('stop', on);
      btn.title = on ? 'Stop' : 'Generate (Enter)';
      btn.innerHTML = on
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
        : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
    }
    if (status) status.textContent = on ? 'Generating…' : '';
  }

  function stopGeneration() {
    if (streamCtl) { streamCtl.abort(); }
  }

  /* ----------------------------- files panel ------------------------------- */

  function fileIcon(path) {
    const ext = (path.split('.').pop() || '').toLowerCase();
    const map = {
      js: '🟨', mjs: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
      html: '🧱', css: '🎨', json: '🧾', md: '📘', py: '🐍',
      sh: '🖥️', yml: '⚙️', yaml: '⚙️', txt: '📄',
    };
    return map[ext] || '📄';
  }

  function renderFilesPanel() {
    const tree = $('#file-tree');
    const count = $('#files-count');
    const viewer = $('#file-viewer');
    if (!tree) return;
    const files = Object.values(filesByPath);
    if (count) count.textContent = String(files.length);

    tree.innerHTML = '';
    if (!files.length) {
      tree.appendChild(el('div', { class: 'files-empty', text: 'Files generated by the agent appear here — live as they are written.' }));
      if (viewer) viewer.style.display = 'none';
      return;
    }

    files.forEach((f) => {
      tree.appendChild(el('div', {
        class: 'file-item' + (f.path === selectedPath ? ' active' : '') + (f.path === writingPath ? ' writing' : ''),
        onclick: () => { selectedPath = f.path; renderFilesPanel(); },
      },
        el('span', { class: 'fi-icon', text: fileIcon(f.path) }),
        el('span', { class: 'fi-name', text: f.path }),
        el('span', { class: 'fi-size', text: CC.fmtBytes(f.content.length) })
      ));
    });

    updateFileViewer();
    const shellEl = $('#agent-shell');
    if (shellEl) shellEl.classList.toggle('with-files', files.length > 0);
  }

  function updateFileViewer() {
    const viewer = $('#file-viewer');
    if (!viewer || !selectedPath || !filesByPath[selectedPath]) return;
    const f = filesByPath[selectedPath];
    viewer.style.display = '';
    viewer.innerHTML = '';
    viewer.appendChild(el('div', { class: 'file-viewer-head' },
      el('span', { class: 'fv-name', text: f.path }),
      el('button', {
        class: 'copy-btn', text: 'Copy',
        onclick: () => {
          navigator.clipboard.writeText(f.content)
            .then(() => CC.toast('Copied ' + f.path, 'ok'))
            .catch(() => CC.toast('Copy failed — select and copy manually', 'err'));
        },
      })
    ));
    const pre = el('pre', {});
    pre.innerHTML = '<code>' + CC.highlight(f.content, f.language) + (f.path === writingPath ? '<span class="cursor-blink"></span>' : '') + '</code>';
    viewer.appendChild(pre);
    if (f.path === writingPath) pre.scrollTop = pre.scrollHeight;
  }

  function downloadZip() {
    const files = Object.values(filesByPath).filter((f) => f.content);
    if (!files.length) {
      CC.toast('No files to download yet — generate a project first.', 'info');
      return;
    }
    try {
      const zip = CC.makeZip(files.map((f) => ({ name: f.path, content: f.content })));
      CC.downloadBytes(zip, 'core-codex-project.zip');
      CC.toast('Project downloaded (' + files.length + ' files)', 'ok');
    } catch (err) {
      CC.toast('ZIP failed: ' + err.message, 'err');
    }
  }

  /* -------------------------------- usage ---------------------------------- */

  function renderUsage() {
    const box = $('#side-usage');
    if (!box) return;
    const plan = CC.getPlan();
    const usage = CC.getUsage();
    const quota = CC.quotaFor(plan.id);
    const pct = Math.min(100, Math.round((usage.count / quota) * 100));
    const resets = CC.usageResetsAt().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    box.innerHTML = '';
    box.appendChild(el('div', { class: 'usage-row' },
      el('span', {}, 'Plan · ', el('b', { text: (CC.PLANS[plan.id] || CC.PLANS.free).name })),
      el('span', {}, el('b', { text: String(usage.count) }), ` / ${quota}`)
    ));
    box.appendChild(el('div', { class: 'usage-bar' },
      el('div', { class: 'usage-fill' + (pct >= 80 ? ' warn' : ''), style: `width:${pct}%` })
    ));
    box.appendChild(el('div', { class: 'usage-reset', text: `5h window resets ${resets}` }));
    const link = el('a', { class: 'side-plan-link', href: '#/pricing', text: plan.id === 'free' ? 'Upgrade for more prompts →' : 'Manage plan →' });
    box.appendChild(link);
  }

  /* ------------------------------ export ----------------------------------- */

  CC.Agent = Agent;
})();
