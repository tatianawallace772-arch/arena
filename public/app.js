/* ========================= Kimi AI Test Playground ========================= */
'use strict';

/* ------------------------------- DOM refs ------------------------------- */
const $ = (id) => document.getElementById(id);

const els = {
  sidebar: $('sidebar'), openSidebar: $('openSidebar'), closeSidebar: $('closeSidebar'),
  apiKey: $('apiKey'), toggleKeyVis: $('toggleKeyVis'), testKeyBtn: $('testKeyBtn'), keyStatus: $('keyStatus'),
  connMode: $('connMode'), baseUrl: $('baseUrl'),
  model: $('model'), modelHint: $('modelHint'), headerModel: $('headerModel'),
  systemPrompt: $('systemPrompt'),
  temperature: $('temperature'), tempVal: $('tempVal'),
  maxTokens: $('maxTokens'),
  topP: $('topP'), topPVal: $('topPVal'),
  streamToggle: $('streamToggle'),
  quickTests: $('quickTests'),
  clearChat: $('clearChat'),
  messages: $('messages'), emptyState: $('emptyState'),
  composer: $('composer'), sendBtn: $('sendBtn'), stopBtn: $('stopBtn'),
  composerHint: $('composerHint'), statusDot: $('statusDot'),
};

/* ------------------------------ Constants ------------------------------ */

const LS_KEY = 'kimi_test_lab_settings_v1';
const FALLBACK_MODELS = ['kimi-k2-0905-preview', 'kimi-k2-0711-preview', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'];

/* ------------------------------- State ------------------------------- */

const state = {
  messages: [],        // {role: 'user'|'assistant', content}
  busy: false,
  abort: null,
  activeMode: null,    // 'direct' | 'proxy' — resolved at runtime
};

/* --------------------------- Settings persistence --------------------------- */

function saveSettings() {
  localStorage.setItem(LS_KEY, JSON.stringify({
    apiKey: els.apiKey.value.trim(),
    connMode: els.connMode.value,
    baseUrl: els.baseUrl.value.trim(),
    model: els.model.value,
    systemPrompt: els.systemPrompt.value,
    temperature: els.temperature.value,
    maxTokens: els.maxTokens.value,
    topP: els.topP.value,
    stream: els.streamToggle.checked,
  }));
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (s.apiKey) els.apiKey.value = s.apiKey;
    if (s.connMode) els.connMode.value = s.connMode;
    if (s.baseUrl) els.baseUrl.value = s.baseUrl;
    if (s.systemPrompt != null) els.systemPrompt.value = s.systemPrompt;
    if (s.temperature != null) els.temperature.value = s.temperature;
    if (s.maxTokens != null) els.maxTokens.value = s.maxTokens;
    if (s.topP != null) els.topP.value = s.topP;
    if (s.stream === false) els.streamToggle.checked = false;
    return s;
  } catch { return {}; }
}

/* --------------------------- API connection layer --------------------------- */

function directUrl(path) {
  const base = els.baseUrl.value.trim().replace(/\/+$/, '') || 'https://api.moonshot.ai/v1';
  return base + path;
}

/** Perform a GET against the Moonshot API in one specific mode. */
function tryModelsRequest(mode) {
  const key = els.apiKey.value.trim();
  const url = mode === 'direct' ? directUrl('/models') : '/api/models';
  return fetch(url, { headers: { Authorization: `Bearer ${key}` } }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data?.error?.message || `HTTP ${res.status}`), { apiError: true });
    return data;
  });
}

/** Resolve which mode actually works, honoring the user's preference. */
async function resolveMode({ force = false } = {}) {
  const pref = els.connMode.value;
  if (!force && state.activeMode) return state.activeMode;
  if (pref === 'direct') return (state.activeMode = 'direct');
  if (pref === 'proxy') return (state.activeMode = 'proxy');
  // auto: probe direct once per session (a CORS/network failure falls through)
  try {
    await tryModelsRequest('direct');
    state.activeMode = 'direct';
  } catch (err) {
    if (err.apiError) {
      // We DID reach Moonshot — the key/model is just bad. Direct works.
      state.activeMode = 'direct';
    } else {
      state.activeMode = 'proxy';
    }
  }
  return state.activeMode;
}

/** GET /models through the resolved mode. Throws with a friendly message. */
async function fetchModelsData() {
  const key = els.apiKey.value.trim();
  if (!key) throw new Error('No API key set');
  const mode = await resolveMode();
  try {
    return await tryModelsRequest(mode);
  } catch (err) {
    if (err.apiError || mode === 'proxy') throw err;
    // direct failed at network level mid-session — retry via proxy
    state.activeMode = 'proxy';
    return tryModelsRequest('proxy');
  }
}

/* ------------------------------- Models ------------------------------- */

function setModelOptions(models, preferred) {
  els.model.innerHTML = '';
  for (const id of models) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    els.model.appendChild(opt);
  }
  if (preferred && models.includes(preferred)) els.model.value = preferred;
  els.headerModel.textContent = els.model.value || 'no model selected';
  els.modelHint.textContent = `${models.length} model${models.length === 1 ? '' : 's'} available`;
}

async function fetchModels() {
  const key = els.apiKey.value.trim();
  if (!key) { setModelOptions(FALLBACK_MODELS); return; }
  try {
    const data = await fetchModelsData();
    const ids = (data.data || []).map((m) => m.id).sort();
    setModelOptions(ids.length ? ids : FALLBACK_MODELS);
  } catch (err) {
    setModelOptions(FALLBACK_MODELS);
    els.modelHint.textContent = `Model list unavailable (${err.message}) — using defaults`;
  }
}

/* --------------------------- Connection test --------------------------- */

async function testConnection() {
  const key = els.apiKey.value.trim();
  els.keyStatus.className = 'hint';
  if (!key) {
    els.keyStatus.textContent = '⚠️ Enter your API key first.';
    els.keyStatus.classList.add('err');
    return;
  }
  els.testKeyBtn.disabled = true;
  els.testKeyBtn.textContent = 'Testing…';
  els.statusDot.className = 'status-dot busy';
  try {
    const mode = await resolveMode({ force: true });
    const data = await fetchModelsData();
    const n = (data.data || []).length;
    els.keyStatus.textContent = `✅ Connected via ${mode} — ${n} models available.`;
    els.keyStatus.classList.add('ok');
    els.statusDot.className = 'status-dot ok';
    const ids = (data.data || []).map((m) => m.id).sort();
    if (ids.length) setModelOptions(ids, els.model.value);
  } catch (err) {
    els.keyStatus.textContent = `❌ ${friendlyError(err)}`;
    els.keyStatus.classList.add('err');
    els.statusDot.className = 'status-dot err';
  } finally {
    els.testKeyBtn.disabled = false;
    els.testKeyBtn.textContent = 'Test connection';
    saveSettings();
  }
}

function friendlyError(err) {
  const m = err.message || String(err);
  if (/Failed to fetch|NetworkError|load failed/i.test(m)) {
    return `Network/CORS failure — the browser could not reach ${els.baseUrl.value}. Try "Proxy" connection mode in Settings.`;
  }
  if (/Could not reach the Moonshot API/i.test(m)) {
    return `The server proxy could not reach Moonshot (it may be blocked from this host). Try "Direct" connection mode in Settings.`;
  }
  return m;
}

/* ------------------------------ Chat render ------------------------------ */

function hideEmptyState() { if (els.emptyState) els.emptyState.style.display = 'none'; }

function addMessage(role, content, { error = false } = {}) {
  const div = document.createElement('div');
  div.className = `msg ${role}${error ? ' error' : ''}`;
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = role === 'user' ? 'You' : error ? 'Error' : `Kimi · ${els.model.value}`;
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = content;
  div.append(who, body);
  els.messages.appendChild(div);
  els.messages.scrollTop = els.messages.scrollHeight;
  return { div, body };
}

function addStats(msgEl, { ms, promptTokens, completionTokens, firstTokenMs }) {
  const stats = document.createElement('div');
  stats.className = 'stats';
  const parts = [];
  if (firstTokenMs != null) parts.push(`first token: <span class="good">${(firstTokenMs / 1000).toFixed(2)}s</span>`);
  if (ms != null) parts.push(`total: ${(ms / 1000).toFixed(2)}s`);
  if (promptTokens != null) parts.push(`prompt: ${promptTokens} tok`);
  if (completionTokens != null) parts.push(`completion: ${completionTokens} tok`);
  stats.innerHTML = parts.join(' &nbsp;·&nbsp; ');
  msgEl.appendChild(stats);
}

/* ------------------------------- Send flow ------------------------------- */

async function send() {
  const text = els.composer.value.trim();
  if (!text || state.busy) return;

  const key = els.apiKey.value.trim();
  if (!key) {
    els.sidebar.classList.remove('hidden');
    els.apiKey.focus();
    els.keyStatus.textContent = '⚠️ Paste your Moonshot API key to start.';
    els.keyStatus.classList.add('err');
    return;
  }

  hideEmptyState();
  els.composer.value = '';
  autosize();

  state.messages.push({ role: 'user', content: text });
  addMessage('user', text);

  await complete(state.messages);
  saveSettings();
}

function chatEndpoint() {
  return state.activeMode === 'direct' ? directUrl('/chat/completions') : '/api/chat';
}

async function complete(history) {
  state.busy = true;
  setBusyUI(true);
  els.statusDot.className = 'status-dot busy';

  const system = els.systemPrompt.value.trim();
  const payload = {
    model: els.model.value,
    messages: system ? [{ role: 'system', content: system }, ...history] : history,
    temperature: parseFloat(els.temperature.value),
    top_p: parseFloat(els.topP.value),
    max_tokens: parseInt(els.maxTokens.value, 10) || 1024,
    stream: els.streamToggle.checked,
  };

  const { div, body } = addMessage('assistant', '');
  body.classList.add('cursor-blink');

  state.abort = new AbortController();
  const t0 = performance.now();
  let firstTokenMs = null;
  let content = '';
  let usage = null;

  const doFetch = () =>
    fetch(chatEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${els.apiKey.value.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: state.abort.signal,
    });

  try {
    await resolveMode();
    let res;
    try {
      res = await doFetch();
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      // network-level failure: if we were direct, retry via proxy before giving up
      if (state.activeMode === 'direct') {
        state.activeMode = 'proxy';
        res = await doFetch();
      } else {
        throw err;
      }
    }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { msg = (await res.json())?.error?.message || msg; } catch { /* keep */ }
      throw new Error(msg);
    }

    if (payload.stream && res.headers.get('content-type')?.includes('text/event-stream')) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              if (firstTokenMs === null) firstTokenMs = performance.now() - t0;
              content += delta;
              body.textContent = content;
              els.messages.scrollTop = els.messages.scrollHeight;
            }
            if (json.usage) usage = json.usage;
          } catch { /* ignore partial json */ }
        }
      }
    } else {
      const json = await res.json();
      content = json.choices?.[0]?.message?.content || '(empty response)';
      usage = json.usage;
      body.textContent = content;
    }

    if (!content) content = '(empty response)';
    body.textContent = content;
    body.classList.remove('cursor-blink');
    const ms = performance.now() - t0;
    addStats(div, {
      ms,
      firstTokenMs,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
    });
    state.messages.push({ role: 'assistant', content });
    els.statusDot.className = 'status-dot ok';
    els.composerHint.textContent = usage
      ? `${usage.prompt_tokens || '?'} in / ${usage.completion_tokens || '?'} out tokens · ${(ms / 1000).toFixed(2)}s · via ${state.activeMode}`
      : `${(ms / 1000).toFixed(2)}s · via ${state.activeMode}`;
  } catch (err) {
    body.classList.remove('cursor-blink');
    if (err.name === 'AbortError') {
      if (content) {
        body.textContent = content + '\n\n— stopped —';
        state.messages.push({ role: 'assistant', content: content + ' (stopped)' });
      } else {
        div.remove();
      }
      els.composerHint.textContent = 'Generation stopped';
    } else {
      div.classList.add('error');
      div.querySelector('.who').textContent = 'Error';
      body.textContent = friendlyError(err);
      els.composerHint.textContent = 'Request failed — check the key/model/mode in Settings';
    }
    els.statusDot.className = 'status-dot err';
  } finally {
    state.busy = false;
    state.abort = null;
    setBusyUI(false);
  }
}

function setBusyUI(busy) {
  els.sendBtn.classList.toggle('hidden', busy);
  els.stopBtn.classList.toggle('hidden', !busy);
  els.sendBtn.disabled = busy;
}

/* ------------------------------- UI wiring ------------------------------- */

function autosize() {
  els.composer.style.height = 'auto';
  els.composer.style.height = Math.min(els.composer.scrollHeight, 180) + 'px';
}

els.composer.addEventListener('input', autosize);
els.composer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
els.sendBtn.addEventListener('click', send);
els.stopBtn.addEventListener('click', () => state.abort?.abort());

els.openSidebar.addEventListener('click', () => els.sidebar.classList.remove('hidden'));
els.closeSidebar.addEventListener('click', () => { els.sidebar.classList.add('hidden'); saveSettings(); });
els.toggleKeyVis.addEventListener('click', () => {
  els.apiKey.type = els.apiKey.type === 'password' ? 'text' : 'password';
});
els.testKeyBtn.addEventListener('click', testConnection);
els.apiKey.addEventListener('change', () => { state.activeMode = null; saveSettings(); fetchModels(); });
els.connMode.addEventListener('change', () => { state.activeMode = null; saveSettings(); });
els.baseUrl.addEventListener('change', () => { state.activeMode = null; saveSettings(); });

els.model.addEventListener('change', () => {
  els.headerModel.textContent = els.model.value;
  saveSettings();
});
els.systemPrompt.addEventListener('change', saveSettings);
els.maxTokens.addEventListener('change', saveSettings);
els.streamToggle.addEventListener('change', saveSettings);
[els.temperature, els.topP].forEach((el) =>
  el.addEventListener('input', () => {
    els.tempVal.textContent = els.temperature.value;
    els.topPVal.textContent = parseFloat(els.topP.value).toFixed(2);
    saveSettings();
  })
);

els.quickTests.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  els.composer.value = chip.dataset.prompt;
  autosize();
  send();
});

els.clearChat.addEventListener('click', () => {
  state.messages = [];
  els.messages.querySelectorAll('.msg').forEach((m) => m.remove());
  els.emptyState.style.display = '';
  els.composerHint.textContent = '';
});

/* --------------------------------- Boot --------------------------------- */

(function boot() {
  const saved = loadSettings();
  els.tempVal.textContent = els.temperature.value;
  els.topPVal.textContent = parseFloat(els.topP.value).toFixed(2);
  setModelOptions(FALLBACK_MODELS, saved.model);
  if (els.apiKey.value) fetchModels();
  if (!els.apiKey.value) els.sidebar.classList.remove('hidden');
  autosize();
})();
