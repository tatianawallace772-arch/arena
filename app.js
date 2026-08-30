/* ============================================================
   Fish Audio Playground — client-side test harness
   Talks to https://api.fish.audio from the browser.

   Because api.fish.audio does not send CORS headers, the app
   supports several transports and auto-detects a working one:

     1. proxy  — same-origin /api/* handled by server.js (best)
     2. direct — browser -> api.fish.audio (works only if they
                 ever enable CORS)
     3. relay  — browser -> public CORS relay -> api.fish.audio

   The API key lives in localStorage (and optionally config.js,
   which is gitignored). It is never part of the repository.
   ============================================================ */
(() => {
  'use strict';

  const API_BASE = 'https://api.fish.audio';
  const LS = {
    apiKey: 'fap:apiKey',
    transport: 'fap:transport',
    relay: 'fap:relay',
    corsproxyKey: 'fap:corsproxyKey',
    customRelay: 'fap:customRelay',
    model: 'fap:model',
    format: 'fap:format',
    bitrate: 'fap:bitrate',
    latency: 'fap:latency',
    speed: 'fap:speed',
    volume: 'fap:volume',
    temp: 'fap:temp',
    topp: 'fap:topp',
    text: 'fap:text',
    voice: 'fap:voice',
  };

  const RELAY_PRESETS = {
    corsproxy: 'https://corsproxy.io/?url={url}',
    corslol: 'https://api.cors.lol/?url={url}',
  };

  const ERROR_HINTS = {
    400: 'Bad request — check the selected voice id and parameters.',
    401: 'Invalid or missing API key — paste a key from fish.audio/app/api-keys.',
    402: 'Out of credits — top up your Fish Audio balance.',
    429: 'Rate limited — wait a moment and try again.',
    503: 'Fish Audio is overloaded — try again in a few seconds.',
  };

  /* ---------------------------------------------------------- state */
  const state = {
    apiKey: '',
    transport: 'auto',        // auto | proxy | direct | relay
    relay: 'corsproxy',       // corsproxy | corslol | custom
    corsproxyKey: '',
    customRelay: '',
    activeTransport: null,    // resolved descriptor after probing
    probing: false,
    voices: [],
    voicePage: 1,
    voiceTotal: 0,
    selectedVoice: null,      // { id, title }
    history: [],
    log: [],
    generating: false,
  };

  const $ = (id) => document.getElementById(id);
  const els = {};
  ['apiKey', 'toggleKey', 'transportSelect', 'relaySelect', 'corsproxyKey', 'customRelay',
   'corsproxyKeyField', 'customRelayField', 'relayFields', 'testConnBtn', 'connResult',
   'connTransport', 'connHttp', 'connLatency', 'connCredit', 'connMessage', 'connDot',
   'transportBadge', 'creditBadge', 'voiceSearch', 'voiceLang', 'voiceSelf', 'voiceGrid',
   'voicePrev', 'voiceNext', 'voicePageInfo', 'voiceRefresh', 'selectedVoiceBadge',
   'ttsText', 'charCount', 'sampleBtn', 'clearBtn', 'modelSelect', 'formatSelect',
   'bitrateSelect', 'bitrateField', 'latencySelect', 'speedRange', 'speedVal',
   'volumeRange', 'volumeVal', 'tempRange', 'tempVal', 'toppRange', 'toppVal',
   'generateBtn', 'genTimer', 'playerBox', 'audioPlayer', 'playerMeta', 'downloadBtn',
   'errorBox', 'historyList', 'historyCount', 'logTable', 'logCount', 'clearLogBtn',
   'toasts', 'tagRow', 'labCard', 'labCtxState', 'labSource', 'labToneControls',
  'labToneType', 'labFreq', 'labFreqVal', 'labPlay', 'labStop', 'labLoop',
  'labRate', 'labRateVal', 'labFilterType', 'labCutoff', 'labCutoffVal',
  'labQ', 'labQVal', 'labPan', 'labPanVal', 'labGain', 'labGainVal',
  'labOverview', 'labScope', 'scopeOsc', 'scopeSpec', 'openLabBtn']
    .forEach((id) => { els[id] = $(id); });

  /* ------------------------------------------------------- helpers */
  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  function toast(msg, kind = 'info', ms = 4200) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    els.toasts.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, ms - 300);
    setTimeout(() => el.remove(), ms);
  }

  function fmtBytes(n) {
    if (n > 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n > 1024) return (n / 1024).toFixed(0) + ' KB';
    return n + ' B';
  }

  function addLog(entry) {
    state.log.unshift({ ts: new Date(), ...entry });
    if (state.log.length > 60) state.log.pop();
    els.logCount.textContent = state.log.length;
    renderLog();
  }

  function renderLog() {
    const rows = state.log.map((l) => {
      const cls = `s${String(l.status)[0]}`;
      return `<div class="log-row">
        <span>${l.ts.toLocaleTimeString()}</span>
        <span>${l.method}</span>
        <span class="log-path" title="${l.path}">${l.path}</span>
        <span class="log-status ${cls}">${l.status}</span>
        <span class="log-transport">${l.transport}</span>
        <span class="log-note">${l.note || l.ms + ' ms'}</span>
      </div>`;
    });
    els.logTable.innerHTML =
      `<div class="log-row head"><span>time</span><span>method</span><span>path</span><span>status</span><span>transport</span><span>note</span></div>`
      + (rows.join('') || '<div class="voice-empty" style="grid-column:auto">No requests yet.</div>');
  }

  /* --------------------------------------------------- transports */
  function relayTemplate() {
    if (state.relay === 'custom') return (state.customRelay || '').trim();
    let tpl = RELAY_PRESETS[state.relay] || RELAY_PRESETS.corsproxy;
    if (state.relay === 'corsproxy' && state.corsproxyKey.trim()) {
      tpl = `https://corsproxy.io/?key=${encodeURIComponent(state.corsproxyKey.trim())}&url={url}`;
    }
    return tpl;
  }

  function candidateList() {
    const list = [];
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      list.push({ id: 'proxy', label: 'proxy(/api)', build: (p) => '/api' + p });
    }
    list.push({ id: 'direct', label: 'direct', build: (p) => API_BASE + p });
    const tpl = relayTemplate();
    if (tpl) {
      list.push({ id: 'relay', label: 'relay:' + state.relay, build: (p) => tpl.replace('{url}', encodeURIComponent(API_BASE + p)) });
    }
    return list;
  }

  // A transport is considered reachable when we get a *Fish-shaped*
  // JSON answer back ({items,total} on success, {message,status} on error).
  // Anything else (relay error pages, static-server 404 HTML, proxies
  // that cannot reach fish.audio) is treated as unavailable.
  async function probeCandidate(c) {
    const t0 = performance.now();
    try {
      const headers = {};
      if (state.apiKey) headers['Authorization'] = 'Bearer ' + state.apiKey;
      const res = await fetch(c.build('/model?page_size=1'), { headers });
      const ms = Math.round(performance.now() - t0);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) return null;
      const body = await res.json().catch(() => null);
      if (!body || typeof body !== 'object') return null;
      const fishy = ('items' in body) || ('total' in body) || ('message' in body) || ('status' in body);
      if (!fishy) return null;
      return { candidate: c, res, ms, body };
    } catch {
      return null;
    }
  }

  async function detectTransport(force = false) {
    if (state.activeTransport && !force) return state.activeTransport;
    let candidates = [];
    if (state.transport === 'proxy') candidates = candidateList().filter((c) => c.id === 'proxy');
    else if (state.transport === 'direct') candidates = candidateList().filter((c) => c.id === 'direct');
    else if (state.transport === 'relay') candidates = candidateList().filter((c) => c.id === 'relay');
    else {
      candidates = candidateList();
      // In auto mode also try the relay preset not currently selected.
      const other = Object.keys(RELAY_PRESETS).find((r) => r !== state.relay);
      if (other) {
        const prev = state.relay;
        state.relay = other;
        const extra = candidateList().filter((c) => c.id === 'relay');
        state.relay = prev;
        candidates = candidates.concat(extra.filter((e) => !candidates.some((c) => c.label === e.label)));
      }
    }

    state.probing = true;
    setTransportBadge('probing…', 'warn');
    let lastFail = null;
    for (const c of candidates) {
      const r = await probeCandidate(c);
      if (r) {
        state.activeTransport = c;
        state.probing = false;
        setTransportBadge(c.label, 'ok');
        addLog({ method: 'GET', path: '/model (probe)', status: r.res.status, transport: c.label, note: 'transport detected · ' + r.ms + ' ms' });
        return c;
      }
      lastFail = c;
    }
    state.probing = false;
    state.activeTransport = null;
    setTransportBadge('none', 'bad');
    addLog({
      method: 'GET', path: '/model (probe)', status: '✕', transport: 'all',
      note: `no transport reachable (tried: ${candidates.map((c) => c.label).join(', ') || 'none'}${lastFail ? '' : ''})`,
    });
    return null;
  }

  function setTransportBadge(label, kind) {
    els.transportBadge.textContent = 'transport: ' + label;
    els.transportBadge.className = 'badge ' + (kind === 'ok' ? 'badge-ok' : kind === 'warn' ? 'badge-warn' : kind === 'bad' ? 'badge-bad' : 'badge-muted');
  }

  function setCreditBadge(text, kind = 'muted') {
    els.creditBadge.textContent = 'credits: ' + text;
    els.creditBadge.className = 'badge ' + (kind === 'ok' ? 'badge-ok' : kind === 'bad' ? 'badge-bad' : 'badge-muted');
  }

  // Core fetch: resolves with a Response, throws ApiError with
  // .network=true when the transport itself fails.
  async function apiFetch(path, { method = 'GET', headers = {}, body } = {}) {
    let c = state.activeTransport;
    if (!c || state.transport !== 'auto' && c.id !== state.transport) {
      c = await detectTransport(true);
    }
    if (!c) {
      const err = new Error('No transport could reach api.fish.audio. Open Connection and try a relay or run server.js locally.');
      err.network = true;
      throw err;
    }
    if (state.apiKey) headers['Authorization'] = 'Bearer ' + state.apiKey;

    const url = c.build(path);
    const t0 = performance.now();
    let res;
    try {
      res = await fetch(url, { method, headers, body });
    } catch (e) {
      addLog({ method, path, status: '✕', transport: c.label, note: 'network error' });
      state.activeTransport = null;
      const err = new Error('Browser could not reach the API through ' + c.label + ' (' + e.message + '). Retrying with another transport…');
      err.network = true;
      throw err;
    }
    const ms = Math.round(performance.now() - t0);
    addLog({ method, path, status: res.status, transport: c.label, note: ms + ' ms' });
    return res;
  }

  /* --------------------------------------------------- api layer */
  async function fetchCredit() {
    const res = await apiFetch('/wallet/api/credit');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.message || 'credit check failed'), { status: res.status, body });
    return body;
  }

  async function fetchVoices({ page, search, lang, self }) {
    const params = new URLSearchParams({ page_size: '24', page_number: String(page), sort_by: 'score' });
    if (search) params.set('title', search);
    if (lang) params.set('language', lang);
    if (self) params.set('self', 'true');
    const res = await apiFetch('/model?' + params.toString());
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.message || 'voice list failed'), { status: res.status, body });
    return body;
  }

  async function synthesize(opts) {
    const body = {
      text: opts.text,
      format: opts.format,
      normalize: true,
      chunk_length: 300,
      prosody: { speed: opts.speed, volume: opts.volume, normalize_loudness: true },
      temperature: opts.temperature,
      top_p: opts.topP,
      latency: opts.latency,
    };
    if (opts.referenceId) body.reference_id = opts.referenceId;
    if (opts.format === 'mp3') body.mp3_bitrate = Number(opts.bitrate);

    const headers = {
      'Content-Type': 'application/json',
      'model': opts.model,
    };
    const res = await apiFetch('/v1/tts', { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw Object.assign(new Error(errBody.message || ('TTS failed with HTTP ' + res.status)), { status: res.status, body: errBody });
    }
    const blob = await res.blob();
    if (!blob.size) throw new Error('The API returned an empty audio file — try again.');
    return blob;
  }

  /* --------------------------------------------------- ui: voices */
  function coverHtml(v) {
    const c = v.cover_image || '';
    let url = null;
    if (c.startsWith('http')) url = c;
    else if (c.startsWith('//')) url = 'https:' + c;
    else if (c.startsWith('/')) url = 'https://fish.audio' + c;
    const letter = ((v.title || '?').match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase();
    if (url) {
      return `<img class="voice-cover" src="${escapeHtml(url)}" alt="" loading="lazy"
               onerror="this.outerHTML='<div class=\\'voice-cover-fallback\\'>${letter}</div>'">`;
    }
    return `<div class="voice-cover-fallback">${letter}</div>`;
  }

  function renderVoices() {
    const self = state.selectedVoice;
    const cards = state.voices.map((v) => {
      const sel = self && self.id === v._id;
      const tags = (v.tags || []).slice(0, 3).map((t) => `<span>${escapeHtml(t)}</span>`).join('');
      const langs = (v.languages || []).slice(0, 2).filter((l) => l).map((l) => `<span>${escapeHtml(l)}</span>`).join('');
      return `<div class="voice-card ${sel ? 'selected' : ''}" data-id="${v._id}" role="button" tabindex="0" title="${escapeHtml(v.title || '')}">
        <span class="pick-check">✓</span>
        ${coverHtml(v)}
        <div class="voice-title">${escapeHtml(v.title || 'Untitled')}</div>
        <div class="voice-tags">${tags}${langs}</div>
        <div class="voice-id"><span title="${v._id}">${v._id.slice(0, 10)}…</span><button data-copy="${v._id}" title="Copy full id">copy</button></div>
      </div>`;
    });
    const defSel = self ? '' : 'selected';
    els.voiceGrid.innerHTML =
      `<div class="voice-card ${defSel}" data-id="" role="button" tabindex="0" title="Use the model's default speaker">
        <span class="pick-check">✓</span>
        <div class="voice-cover-fallback">🐬</div>
        <div class="voice-title">Default speaker</div>
        <div class="voice-tags"><span>no reference_id</span></div>
        <div class="voice-id"><span>—</span></div>
      </div>` + (cards.join('') || '<div class="voice-empty">No voices matched. Try another search.</div>');

    els.voicePageInfo.textContent = `page ${state.voicePage} · ${state.voiceTotal ?? '?'} total`;
    els.voicePrev.disabled = state.voicePage <= 1;
    els.voiceNext.disabled = state.voicePage * 24 >= (state.voiceTotal || 0);
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function loadVoices() {
    els.voiceGrid.innerHTML = '<div class="voice-empty">Loading voices…</div>';
    try {
      const body = await fetchVoices({
        page: state.voicePage,
        search: els.voiceSearch.value.trim(),
        lang: els.voiceLang.value,
        self: els.voiceSelf.checked,
      });
      state.voices = body.items || [];
      state.voiceTotal = body.total ?? state.voices.length;
      renderVoices();
    } catch (e) {
      if (e.network) {
        const retried = await retryWithNewTransport(() => loadVoices());
        if (!retried) {
          els.voiceGrid.innerHTML =
            `<div class="voice-empty">${escapeHtml(e.message || 'Failed to load voices.')}
            <br><br>Run <code>node server.js</code> locally or configure a CORS relay in the Connection panel.</div>`;
        }
      } else {
        els.voiceGrid.innerHTML = `<div class="voice-empty">${escapeHtml(e.message || 'Failed to load voices.')}</div>`;
      }
    }
  }

  // Re-probe transports and retry the failed call if a *different*
  // transport now works. Returns true when the call was retried.
  let retryDepth = 0;
  async function retryWithNewTransport(fn) {
    if (state.probing || retryDepth >= 2) return false;
    const before = state.activeTransport ? state.activeTransport.label : null;
    state.activeTransport = null;
    const c = await detectTransport(true);
    if (c && c.label !== before) {
      toast('Retrying over ' + c.label + '…', 'warn');
      retryDepth++;
      try { await fn(); } finally { retryDepth--; }
      return true;
    }
    return false;
  }

  /* --------------------------------------------------- ui: studio */
  function insertAtCursor(textarea, text) {
    const s = textarea.selectionStart ?? textarea.value.length;
    const e = textarea.selectionEnd ?? s;
    const before = textarea.value.slice(0, s);
    const after = textarea.value.slice(e);
    const glue = before && !/\s$/.test(before) ? ' ' : '';
    textarea.value = before + glue + text + after;
    const pos = (before + glue + text).length;
    textarea.setSelectionRange(pos, pos);
    textarea.focus();
    onTextChange();
  }

  function onTextChange() {
    els.charCount.textContent = els.ttsText.value.length + ' chars';
    store.set(LS.text, els.ttsText.value);
  }

  function updateBitrateVisibility() {
    els.bitrateField.style.display = els.formatSelect.value === 'mp3' ? '' : 'none';
  }

  function showError(title, detail) {
    els.errorBox.hidden = false;
    els.errorBox.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(detail || '')}`;
  }

  async function generate() {
    if (state.generating) return;
    const text = els.ttsText.value.trim();
    if (!text) { toast('Type some text first.', 'warn'); els.ttsText.focus(); return; }
    if (!state.apiKey) { toast('Paste your Fish Audio API key in Connection.', 'warn'); els.apiKey.focus(); return; }

    hideError();
    state.generating = true;
    els.generateBtn.disabled = true;
    els.generateBtn.querySelector('.btn-label').textContent = 'Generating…';
    els.generateBtn.querySelector('.eq').hidden = false;
    const t0 = performance.now();
    const timer = setInterval(() => { els.genTimer.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's'; }, 100);

    const opts = {
      text,
      referenceId: state.selectedVoice ? state.selectedVoice.id : '',
      model: els.modelSelect.value,
      format: els.formatSelect.value,
      bitrate: els.bitrateSelect.value,
      speed: parseFloat(els.speedRange.value),
      volume: parseInt(els.volumeRange.value, 10),
      temperature: parseFloat(els.tempRange.value),
      topP: parseFloat(els.toppRange.value),
      latency: els.latencySelect.value,
    };

    try {
      const blob = await synthesize(opts);
      const mime = { mp3: 'audio/mpeg', opus: 'audio/ogg', wav: 'audio/wav' }[opts.format] || 'audio/mpeg';
      const typed = blob.type ? blob : new Blob([blob], { type: mime });
      const url = URL.createObjectURL(typed);
      const entry = {
        id: Date.now(),
        ts: new Date(),
        text,
        voiceTitle: state.selectedVoice ? state.selectedVoice.title : 'default speaker',
        voiceId: opts.referenceId,
        model: opts.model,
        format: opts.format,
        bytes: typed.size,
        duration: null,
        url,
      };
      state.history.unshift(entry);
      if (state.history.length > 12) {
        const dropped = state.history.pop();
        URL.revokeObjectURL(dropped.url);
      }
      renderHistory();
      playEntry(entry);
      renderLabSourceOptions('clip:' + entry.id);
      toast('Speech generated · ' + fmtBytes(entry.bytes), 'ok');
      refreshCredit().catch(() => {});
    } catch (e) {
      if (e.network) {
        // Allow the recursive retry to actually run (state.generating
        // is reset in this finally-block only after the catch returns).
        state.generating = false;
        const retried = await retryWithNewTransport(() => generate());
        if (!retried) {
          showError('Network error — the browser could not reach api.fish.audio',
            (e.message || '') + '\n\nOptions: run `node server.js` locally and reload, pick a CORS relay in the Connection panel, or check your network.');
          toast('No route to Fish Audio.', 'bad');
        }
      } else {
        const hint = ERROR_HINTS[e.status] || '';
        showError('Generation failed — ' + (e.status ? 'HTTP ' + e.status : 'error'), (e.message || '') + (hint ? '\n' + hint : ''));
        toast('Generation failed' + (e.status ? ' (HTTP ' + e.status + ')' : ''), 'bad');
      }
    } finally {
      clearInterval(timer);
      els.genTimer.textContent = '';
      state.generating = false;
      els.generateBtn.disabled = false;
      els.generateBtn.querySelector('.btn-label').textContent = 'Generate speech';
      els.generateBtn.querySelector('.eq').hidden = true;
    }
  }

  function hideError() { els.errorBox.hidden = true; els.errorBox.innerHTML = ''; }

  function playEntry(entry) {
    els.playerBox.hidden = false;
    els.audioPlayer.src = entry.url;
    els.playerMeta.textContent =
      `${entry.voiceTitle} · ${entry.model} · ${entry.format} · ${fmtBytes(entry.bytes)}` +
      (entry.duration ? ` · ${entry.duration.toFixed(1)}s` : '');
    els.audioPlayer.play().catch(() => {});
    els.downloadBtn.onclick = () => downloadEntry(entry);
    els.audioPlayer.onloadedmetadata = () => {
      if (isFinite(els.audioPlayer.duration)) {
        entry.duration = els.audioPlayer.duration;
        els.playerMeta.textContent =
          `${entry.voiceTitle} · ${entry.model} · ${entry.format} · ${fmtBytes(entry.bytes)} · ${entry.duration.toFixed(1)}s`;
        renderHistory();
      }
    };
  }

  function downloadEntry(entry) {
    const a = document.createElement('a');
    a.href = entry.url;
    a.download = `fish-audio-${entry.ts.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${entry.format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function renderHistory() {
    els.historyCount.textContent = state.history.length;
    els.historyList.innerHTML = state.history.map((h) => `
      <div class="history-item">
        <button class="h-play" data-play="${h.id}" title="Play">▶</button>
        <div class="h-main">
          <div class="h-text" title="${escapeHtml(h.text)}">${escapeHtml(h.text)}</div>
          <div class="h-meta">${h.ts.toLocaleTimeString()} · ${escapeHtml(h.voiceTitle)} · ${h.model} · ${h.format} · ${fmtBytes(h.bytes)}${h.duration ? ' · ' + h.duration.toFixed(1) + 's' : ''}</div>
        </div>
        <div class="h-actions">
          <button class="btn btn-ghost btn-sm" data-dl="${h.id}">⬇ Save</button>
          <button class="btn btn-ghost btn-sm" data-lab="${h.id}" title="Open in Sound Lab">🎛</button>
        </div>
      </div>`).join('') || '<div class="voice-empty">Nothing generated yet.</div>';
  }

  /* ----------------------------------------------- ui: connection */
  async function testConnection() {
    els.testConnBtn.disabled = true;
    els.testConnBtn.textContent = 'Testing…';
    els.connDot.className = 'dot warn';
    els.connResult.hidden = false;
    els.connTransport.textContent = '…';
    els.connHttp.textContent = '…';
    els.connLatency.textContent = '…';
    els.connCredit.textContent = '…';
    els.connMessage.textContent = '…';

    const c = await detectTransport(true);
    if (!c) {
      els.connDot.className = 'dot bad';
      els.connTransport.textContent = 'none';
      els.connHttp.textContent = '—';
      els.connLatency.textContent = '—';
      els.connCredit.textContent = '—';
      els.connMessage.textContent = 'No route to api.fish.audio. Run server.js locally (node server.js) or configure a CORS relay.';
      setTransportBadge('none', 'bad');
      toast('No working transport found.', 'bad');
      els.testConnBtn.disabled = false;
      els.testConnBtn.textContent = 'Test connection';
      return;
    }

    els.connTransport.textContent = c.label;
    // measure one more call through the winning transport
    const t0 = performance.now();
    try {
      const res = await apiFetch('/model?page_size=1');
      const ms = Math.round(performance.now() - t0);
      els.connHttp.textContent = res.status + ' ' + (res.ok ? 'OK' : 'API error');
      els.connLatency.textContent = ms + ' ms';
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        els.connMessage.textContent = b.message || 'API returned an error.';
        els.connDot.className = res.status === 401 ? 'dot bad' : 'dot warn';
      } else {
        els.connMessage.textContent = 'Voice library reachable.';
        els.connDot.className = 'dot ok';
      }
    } catch (e) {
      els.connHttp.textContent = 'network ✕';
      els.connMessage.textContent = e.message;
      els.connDot.className = 'dot bad';
    }

    try {
      const credit = await fetchCredit();
      els.connCredit.textContent = credit.credit ?? '—';
      setCreditBadge(String(credit.credit ?? '—'), 'ok');
    } catch (e) {
      els.connCredit.textContent = e.status ? 'HTTP ' + e.status : '✕';
      setCreditBadge('?', 'bad');
    }

    els.testConnBtn.disabled = false;
    els.testConnBtn.textContent = 'Test connection';
  }

  async function refreshCredit() {
    try {
      const credit = await fetchCredit();
      setCreditBadge(String(credit.credit ?? '—'), 'ok');
    } catch { /* silent */ }
  }

  /* --------------------------------------------------- sound lab */
  // A small Web Audio API playground. Everything runs locally in the
  // browser — no API calls, no credits. The graph:
  //   source (buffer | oscillator) → biquad filter → stereo panner
  //   → gain → limiter → analyser → destination
  const Lab = {
    ctx: null, filter: null, panner: null, gain: null, limiter: null, analyser: null,
    source: null, buffer: null, buffers: new Map(),
    mode: 'tone',            // 'tone' | 'clip'
    entryId: null,
    playing: false, manualStop: false,
    startCtxTime: 0, startOffset: 0, prevRate: 1,
    overviewCache: null, overviewKey: '',
    raf: 0, scopeMode: 'osc',
  };

  function labCtx() {
    if (!Lab.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { toast('This browser has no Web Audio support.', 'bad'); return null; }
      Lab.ctx = new AC();
      Lab.filter = Lab.ctx.createBiquadFilter();
      Lab.filter.type = 'lowpass';
      Lab.filter.frequency.value = Number(els.labCutoff.value);
      Lab.filter.Q.value = Number(els.labQ.value);
      Lab.panner = Lab.ctx.createStereoPanner ? Lab.ctx.createStereoPanner() : Lab.ctx.createGain();
      Lab.gain = Lab.ctx.createGain();
      Lab.gain.gain.value = Number(els.labGain.value);
      // Near-transparent safety limiter so filter resonance / gain boosts
      // can't blast your ears.
      Lab.limiter = Lab.ctx.createDynamicsCompressor();
      Lab.limiter.threshold.value = -2;
      Lab.limiter.knee.value = 0;
      Lab.limiter.ratio.value = 20;
      Lab.limiter.attack.value = 0.003;
      Lab.limiter.release.value = 0.25;
      Lab.analyser = Lab.ctx.createAnalyser();
      Lab.analyser.fftSize = 2048;
      Lab.analyser.smoothingTimeConstant = 0.72;
      Lab.filter.connect(Lab.panner);
      Lab.panner.connect(Lab.gain);
      Lab.gain.connect(Lab.limiter);
      Lab.limiter.connect(Lab.analyser);
      Lab.analyser.connect(Lab.ctx.destination);
      Lab.ctx.addEventListener?.('statechange', setLabCtxBadge);
    }
    return Lab.ctx;
  }

  function setLabCtxBadge() {
    const b = els.labCtxState;
    if (!Lab.ctx) { b.textContent = 'context: idle'; b.className = 'badge badge-muted'; return; }
    const s = Lab.ctx.state;
    b.textContent = 'context: ' + s;
    b.className = 'badge ' + (s === 'running' ? 'badge-ok' : 'badge-warn');
  }

  function renderLabSourceOptions(selectValue) {
    const sel = els.labSource;
    const wanted = selectValue || sel.value || 'tone';
    const opts = ['<option value="tone">🎹 Test tone (oscillator)</option>'].concat(
      state.history.map((h) => {
        const label = `🐟 ${h.ts.toLocaleTimeString()} · ${(h.text || '').slice(0, 30)}`;
        return `<option value="clip:${h.id}">${escapeHtml(label)}</option>`;
      })
    );
    sel.innerHTML = opts.join('');
    sel.value = [...sel.options].some((o) => o.value === wanted) ? wanted : 'tone';
    labSourceChanged();
  }

  function labSourceChanged() {
    labStop();
    const v = els.labSource.value;
    if (v === 'tone') {
      Lab.mode = 'tone';
      Lab.entryId = null;
      Lab.buffer = null;
      els.labToneControls.hidden = false;
      els.labLoop.disabled = true;
    } else {
      Lab.mode = 'clip';
      Lab.entryId = Number(v.slice(5));
      Lab.buffer = Lab.buffers.get(Lab.entryId) || null;
      els.labToneControls.hidden = true;
      els.labLoop.disabled = false;
      labLoadClip(Lab.entryId);
    }
    Lab.overviewKey = '';
    drawLabOverview();
  }

  async function labLoadClip(id) {
    const entry = state.history.find((h) => h.id === id);
    if (!entry) return;
    if (!Lab.buffers.has(id)) {
      try {
        const ab = await (await fetch(entry.url)).arrayBuffer();
        const ctx = labCtx();
        if (!ctx) return;
        const buf = await ctx.decodeAudioData(ab);
        Lab.buffers.set(id, buf);
        // keep the cache in step with history (max 12 clips)
        if (Lab.buffers.size > 12) {
          const live = new Set(state.history.map((h) => String(h.id)));
          for (const k of [...Lab.buffers.keys()]) {
            if (!live.has(String(k))) { Lab.buffers.delete(k); break; }
          }
        }
      } catch (e) {
        toast('Could not decode that clip in the browser: ' + (e.message || e), 'bad');
        return;
      }
    }
    if (Lab.entryId !== id) return; // selection moved on meanwhile
    Lab.buffer = Lab.buffers.get(id) || null;
    drawLabOverview();
  }

  function connectSource(node) {
    node.connect(els.labFilterType.value === 'bypass' ? Lab.panner : Lab.filter);
  }

  function currentLabPos() {
    if (!Lab.buffer) return 0;
    const rate = Lab.prevRate || 1;
    let pos = Lab.startOffset + (Lab.ctx.currentTime - Lab.startCtxTime) * rate;
    if (els.labLoop.checked) pos %= Lab.buffer.duration || 1;
    return Math.max(0, Math.min(pos, Lab.buffer.duration || 0));
  }

  async function labPlay() {
    const ctx = labCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* ignore */ } }
    setLabCtxBadge();
    labStop();

    if (Lab.mode === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = els.labToneType.value;
      osc.frequency.value = Number(els.labFreq.value);
      osc.detune.value = 1200 * Math.log2(Number(els.labRate.value));
      connectSource(osc);
      osc.start();
      Lab.source = osc;
      Lab.playing = true;
    } else {
      if (!Lab.buffer) {
        await labLoadClip(Lab.entryId);
        if (!Lab.buffer) { toast('No clip loaded — generate speech first.', 'warn'); return; }
      }
      const src = ctx.createBufferSource();
      src.buffer = Lab.buffer;
      src.playbackRate.value = Number(els.labRate.value);
      src.loop = els.labLoop.checked;
      Lab.prevRate = Number(els.labRate.value);
      Lab.startCtxTime = ctx.currentTime;
      Lab.startOffset = 0;
      src.onended = () => { if (!Lab.manualStop) labStopDone(); };
      connectSource(src);
      src.start();
      Lab.source = src;
      Lab.playing = true;
    }
    els.labPlay.textContent = '↻ Restart';
    startLabRaf();
  }

  function labStop() {
    if (Lab.source) {
      Lab.manualStop = true;
      try { Lab.source.onended = null; } catch { /* ignore */ }
      try { Lab.source.stop(); } catch { /* ignore */ }
      try { Lab.source.disconnect(); } catch { /* ignore */ }
      Lab.source = null;
      Lab.manualStop = false;
    }
    if (Lab.playing) labStopDone();
  }

  function labStopDone() {
    Lab.playing = false;
    cancelAnimationFrame(Lab.raf);
    els.labPlay.textContent = '▶ Play';
    drawLabOverview();
    drawScope();
  }

  function startLabRaf() {
    cancelAnimationFrame(Lab.raf);
    const loop = () => {
      if (!Lab.playing) return;
      drawLabOverview();
      drawScope();
      Lab.raf = requestAnimationFrame(loop);
    };
    Lab.raf = requestAnimationFrame(loop);
  }

  /* ----- canvases ----- */
  function fitCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    const w = Math.max(10, Math.round(r.width * dpr));
    const h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    return g;
  }

  function fmtHz(v) { return v >= 1000 ? (v / 1000).toFixed(2) + ' kHz' : Math.round(v) + ' Hz'; }

  function drawLabOverview() {
    const cv = els.labOverview;
    if (!cv) return;
    const g = fitCanvas(cv);
    const w = cv.width, h = cv.height, mid = h / 2;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(138, 164, 184, 0.18)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(w, mid); g.stroke();

    if (Lab.mode === 'tone' || !Lab.buffer) {
      g.fillStyle = 'rgba(138, 164, 184, 0.55)';
      g.font = `${Math.round(12 * (window.devicePixelRatio || 1))}px ui-monospace, monospace`;
      g.textAlign = 'center';
      g.fillText('continuous oscillator — watch the live scope below', w / 2, mid + 4);
      return;
    }

    // cached full-waveform render, rebuilt per clip / per resize
    const key = Lab.entryId + ':' + w + 'x' + h;
    if (Lab.overviewKey !== key || !Lab.overviewCache) {
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const og = off.getContext('2d');
      const data = Lab.buffer.getChannelData(0);
      const step = Math.max(1, Math.floor(data.length / w));
      og.strokeStyle = 'rgba(103, 232, 249, 0.85)';
      og.lineWidth = 1;
      og.beginPath();
      for (let x = 0; x < w; x++) {
        const s0 = x * step;
        const s1 = Math.min(data.length, s0 + step);
        let min = 1, max = -1;
        for (let i = s0; i < s1; i++) {
          const v = data[i];
          if (v < min) min = v;
          if (v > max) max = v;
        }
        if (min > max) { min = 0; max = 0; }
        og.moveTo(x + 0.5, mid + min * (mid - 3));
        og.lineTo(x + 0.5, mid + max * (mid - 3));
      }
      og.stroke();
      Lab.overviewCache = off;
      Lab.overviewKey = key;
    }
    g.drawImage(Lab.overviewCache, 0, 0);

    const dur = Lab.buffer.duration || 1;
    const pos = Lab.playing ? currentLabPos() % dur : 0;
    const x = Math.round((pos / dur) * w);
    g.fillStyle = '#22d3ee';
    g.fillRect(x - 1, 0, 2.5, h);
    g.fillStyle = 'rgba(4, 33, 43, 0.9)';
    g.fillRect(x - 1, 0, 2.5, 10);
  }

  function drawScope() {
    const cv = els.labScope;
    if (!cv) return;
    const g = fitCanvas(cv);
    const w = cv.width, h = cv.height, mid = h / 2;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(138, 164, 184, 0.15)';
    g.beginPath(); g.moveTo(0, mid); g.lineTo(w, mid); g.stroke();

    if (!Lab.analyser) {
      g.fillStyle = 'rgba(138, 164, 184, 0.4)';
      g.font = `${Math.round(11 * (window.devicePixelRatio || 1))}px ui-monospace, monospace`;
      g.textAlign = 'center';
      g.fillText('press Play to start the audio context', w / 2, mid + 4);
      return;
    }

    const n = Lab.analyser.frequencyBinCount;
    if (Lab.scopeMode === 'osc') {
      const arr = new Uint8Array(n);
      Lab.analyser.getByteTimeDomainData(arr);
      g.strokeStyle = '#34d399';
      g.lineWidth = Math.max(1.5, (window.devicePixelRatio || 1) * 1.25);
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * w;
        const y = mid + ((arr[i] - 128) / 128) * (mid - 4);
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    } else {
      const arr = new Uint8Array(n);
      Lab.analyser.getByteFrequencyData(arr);
      const bars = Math.min(96, Math.floor(w / (5 * (window.devicePixelRatio || 1))));
      const bw = w / bars;
      const topBin = Math.floor(n * 0.72);
      const grad = g.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, 'rgba(8, 145, 178, 0.85)');
      grad.addColorStop(1, 'rgba(52, 211, 153, 0.95)');
      g.fillStyle = grad;
      for (let b = 0; b < bars; b++) {
        // logarithmic bin grouping so low frequencies get space too
        const i0 = Math.floor(2 * Math.pow(topBin / 2, b / bars));
        const i1 = Math.max(i0 + 1, Math.floor(2 * Math.pow(topBin / 2, (b + 1) / bars)));
        let v = 0;
        for (let i = i0; i < i1 && i < n; i++) v = Math.max(v, arr[i]);
        const bh = (v / 255) * (h - 6);
        g.fillRect(b * bw + 1, h - bh, Math.max(1, bw - 2), bh);
      }
    }
  }

  function openLabFor(entryId) {
    renderLabSourceOptions('clip:' + entryId);
    els.labCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('Clip loaded into the Sound Lab — press Play.', 'ok', 2600);
  }

  /* ---------------------------------------------------- wiring */
  function applyRelayFields() {
    const r = els.relaySelect.value;
    els.corsproxyKeyField.style.display = r === 'corsproxy' ? '' : 'none';
    els.customRelayField.style.display = r === 'custom' ? '' : 'none';
    els.relayFields.style.display = els.transportSelect.value === 'auto' || els.transportSelect.value === 'relay' ? '' : 'none';
  }

  function bindEvents() {
    // connection
    els.apiKey.addEventListener('input', () => {
      state.apiKey = els.apiKey.value.trim();
      store.set(LS.apiKey, state.apiKey);
      state.activeTransport = null; // re-probe with (maybe) new key
    });
    els.toggleKey.addEventListener('click', () => {
      els.apiKey.type = els.apiKey.type === 'password' ? 'text' : 'password';
    });
    els.transportSelect.addEventListener('change', () => {
      state.transport = els.transportSelect.value;
      store.set(LS.transport, state.transport);
      state.activeTransport = null;
      applyRelayFields();
      setTransportBadge('idle', 'muted');
    });
    els.relaySelect.addEventListener('change', () => {
      state.relay = els.relaySelect.value;
      store.set(LS.relay, state.relay);
      state.activeTransport = null;
      applyRelayFields();
    });
    els.corsproxyKey.addEventListener('input', () => {
      state.corsproxyKey = els.corsproxyKey.value;
      store.set(LS.corsproxyKey, state.corsproxyKey);
      state.activeTransport = null;
    });
    els.customRelay.addEventListener('input', () => {
      state.customRelay = els.customRelay.value;
      store.set(LS.customRelay, state.customRelay);
      state.activeTransport = null;
    });
    els.testConnBtn.addEventListener('click', testConnection);

    // voices
    let searchTimer;
    els.voiceSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.voicePage = 1; loadVoices(); }, 450);
    });
    els.voiceLang.addEventListener('change', () => { state.voicePage = 1; loadVoices(); });
    els.voiceSelf.addEventListener('change', () => { state.voicePage = 1; loadVoices(); });
    els.voicePrev.addEventListener('click', () => { if (state.voicePage > 1) { state.voicePage--; loadVoices(); } });
    els.voiceNext.addEventListener('click', () => { state.voicePage++; loadVoices(); });
    els.voiceRefresh.addEventListener('click', () => loadVoices());
    els.voiceGrid.addEventListener('click', (ev) => {
      const copyBtn = ev.target.closest('[data-copy]');
      if (copyBtn) {
        navigator.clipboard.writeText(copyBtn.dataset.copy).then(() => toast('Voice id copied.', 'ok', 1800));
        ev.stopPropagation();
        return;
      }
      const card = ev.target.closest('.voice-card');
      if (!card) return;
      const id = card.dataset.id;
      if (!id) {
        state.selectedVoice = null;
        els.selectedVoiceBadge.textContent = 'voice: default';
      } else {
        const v = state.voices.find((x) => x._id === id);
        state.selectedVoice = { id, title: v ? v.title : id };
        els.selectedVoiceBadge.textContent = 'voice: ' + (v ? v.title.slice(0, 26) : id.slice(0, 12));
      }
      store.set(LS.voice, JSON.stringify(state.selectedVoice));
      renderVoices();
    });

    // studio
    els.tagRow.addEventListener('click', (ev) => {
      const chip = ev.target.closest('.chip');
      if (!chip) return;
      let tag = chip.dataset.tag;
      if (els.modelSelect.value === 's1') tag = tag.replace(/^\[(.+)\]$/, '($1)'); // legacy syntax
      insertAtCursor(els.ttsText, tag);
    });
    els.ttsText.addEventListener('input', onTextChange);
    els.sampleBtn.addEventListener('click', () => {
      els.ttsText.value = 'Hello! This is a test of Fish Audio speech synthesis, running entirely in the browser. [chuckling] Not bad for a few kilobytes of plain JavaScript, right?';
      onTextChange();
    });
    els.clearBtn.addEventListener('click', () => { els.ttsText.value = ''; onTextChange(); });
    els.modelSelect.addEventListener('change', () => store.set(LS.model, els.modelSelect.value));
    els.formatSelect.addEventListener('change', () => { store.set(LS.format, els.formatSelect.value); updateBitrateVisibility(); });
    els.bitrateSelect.addEventListener('change', () => store.set(LS.bitrate, els.bitrateSelect.value));
    els.latencySelect.addEventListener('change', () => store.set(LS.latency, els.latencySelect.value));
    els.speedRange.addEventListener('input', () => { els.speedVal.textContent = Number(els.speedRange.value).toFixed(2) + '×'; store.set(LS.speed, els.speedRange.value); });
    els.volumeRange.addEventListener('input', () => { els.volumeVal.textContent = els.volumeRange.value + ' dB'; store.set(LS.volume, els.volumeRange.value); });
    els.tempRange.addEventListener('input', () => { els.tempVal.textContent = els.tempRange.value; store.set(LS.temp, els.tempRange.value); });
    els.toppRange.addEventListener('input', () => { els.toppVal.textContent = els.toppRange.value; store.set(LS.topp, els.toppRange.value); });
    els.generateBtn.addEventListener('click', generate);
    document.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); generate(); }
    });

    // history / log
    els.historyList.addEventListener('click', (ev) => {
      const play = ev.target.closest('[data-play]');
      const dl = ev.target.closest('[data-dl]');
      const lab = ev.target.closest('[data-lab]');
      if (play) {
        const entry = state.history.find((h) => String(h.id) === play.dataset.play);
        if (entry) playEntry(entry);
      } else if (dl) {
        const entry = state.history.find((h) => String(h.id) === dl.dataset.dl);
        if (entry) downloadEntry(entry);
      } else if (lab) {
        openLabFor(Number(lab.dataset.lab));
      }
    });
    els.clearLogBtn.addEventListener('click', () => { state.log = []; renderLog(); els.logCount.textContent = '0'; });

    // sound lab
    els.labSource.addEventListener('change', labSourceChanged);
    els.labPlay.addEventListener('click', labPlay);
    els.labStop.addEventListener('click', labStop);
    els.labLoop.addEventListener('change', () => { if (Lab.source && Lab.mode === 'clip') Lab.source.loop = els.labLoop.checked; });
    els.labToneType.addEventListener('change', () => { if (Lab.source && Lab.mode === 'tone') Lab.source.type = els.labToneType.value; });
    els.labFreq.addEventListener('input', () => {
      els.labFreqVal.textContent = fmtHz(Number(els.labFreq.value));
      if (Lab.source && Lab.mode === 'tone' && Lab.ctx) {
        Lab.source.frequency.setTargetAtTime(Number(els.labFreq.value), Lab.ctx.currentTime, 0.02);
      }
    });
    els.labRate.addEventListener('input', () => {
      const v = Number(els.labRate.value);
      els.labRateVal.textContent = v.toFixed(2) + '×';
      if (Lab.ctx && Lab.playing) {
        if (Lab.mode === 'clip' && Lab.source) {
          // keep the playhead continuous when the rate changes mid-play
          const pos = currentLabPos();
          Lab.startOffset = pos;
          Lab.startCtxTime = Lab.ctx.currentTime;
          Lab.prevRate = v;
          Lab.source.playbackRate.setTargetAtTime(v, Lab.ctx.currentTime, 0.02);
        } else if (Lab.mode === 'tone' && Lab.source) {
          Lab.source.detune.setTargetAtTime(1200 * Math.log2(v), Lab.ctx.currentTime, 0.02);
        }
      }
    });
    els.labFilterType.addEventListener('change', () => {
      const t = els.labFilterType.value;
      if (t !== 'bypass' && Lab.filter) Lab.filter.type = t;
      if (Lab.source) {
        try { Lab.source.disconnect(); } catch { /* ignore */ }
        connectSource(Lab.source);
      }
    });
    els.labCutoff.addEventListener('input', () => {
      const v = Number(els.labCutoff.value);
      els.labCutoffVal.textContent = fmtHz(v);
      if (Lab.ctx) Lab.filter.frequency.setTargetAtTime(v, Lab.ctx.currentTime, 0.02);
    });
    els.labQ.addEventListener('input', () => {
      const v = Number(els.labQ.value);
      els.labQVal.textContent = v.toFixed(1);
      if (Lab.ctx) Lab.filter.Q.setTargetAtTime(v, Lab.ctx.currentTime, 0.02);
    });
    els.labPan.addEventListener('input', () => {
      const v = Number(els.labPan.value);
      els.labPanVal.textContent = v === 0 ? 'C' : (v < 0 ? 'L' + Math.round(-v * 100) : 'R' + Math.round(v * 100));
      if (Lab.ctx && Lab.panner && Lab.panner.pan) Lab.panner.pan.setTargetAtTime(v, Lab.ctx.currentTime, 0.02);
    });
    els.labGain.addEventListener('input', () => {
      const v = Number(els.labGain.value);
      els.labGainVal.textContent = v.toFixed(2);
      if (Lab.ctx) Lab.gain.gain.setTargetAtTime(v, Lab.ctx.currentTime, 0.02);
    });
    els.scopeOsc.addEventListener('click', () => {
      Lab.scopeMode = 'osc';
      els.scopeOsc.classList.add('active');
      els.scopeSpec.classList.remove('active');
      drawScope();
    });
    els.scopeSpec.addEventListener('click', () => {
      Lab.scopeMode = 'spec';
      els.scopeSpec.classList.add('active');
      els.scopeOsc.classList.remove('active');
      drawScope();
    });
    els.openLabBtn.addEventListener('click', () => {
      if (state.history.length) openLabFor(state.history[0].id);
      else {
        els.labCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast('Generate speech first — or try the test tone.', 'warn');
      }
    });
    window.addEventListener('resize', () => {
      Lab.overviewKey = '';
      drawLabOverview();
      drawScope();
    });

    // tabs
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
        $('panel-history').hidden = tab.dataset.tab !== 'history';
        $('panel-log').hidden = tab.dataset.tab !== 'log';
      });
    });
  }

  /* ------------------------------------------------------ boot */
  function restore() {
    // config.js (gitignored) can ship a key for local testing;
    // localStorage always wins so the user can override it.
    const cfg = (typeof window !== 'undefined' && window.FISH_CONFIG) || {};
    const cfgKey = (cfg.apiKey || '').trim();
    const savedKey = store.get(LS.apiKey, '');
    state.apiKey = savedKey || cfgKey;
    if (!savedKey && cfgKey) store.set(LS.apiKey, cfgKey);

    state.transport = store.get(LS.transport, 'auto');
    state.relay = store.get(LS.relay, 'corsproxy');
    state.corsproxyKey = store.get(LS.corsproxyKey, '');
    state.customRelay = store.get(LS.customRelay, '');

    els.apiKey.value = state.apiKey;
    els.transportSelect.value = state.transport;
    els.relaySelect.value = state.relay;
    els.corsproxyKey.value = state.corsproxyKey;
    els.customRelay.value = state.customRelay;
    applyRelayFields();

    const model = store.get(LS.model, 's2.1-pro');
    if ([...els.modelSelect.options].some((o) => o.value === model)) els.modelSelect.value = model;
    const format = store.get(LS.format, 'mp3');
    if ([...els.formatSelect.options].some((o) => o.value === format)) els.formatSelect.value = format;
    const bitrate = store.get(LS.bitrate, '128');
    if ([...els.bitrateSelect.options].some((o) => o.value === bitrate)) els.bitrateSelect.value = bitrate;
    const latency = store.get(LS.latency, 'normal');
    if ([...els.latencySelect.options].some((o) => o.value === latency)) els.latencySelect.value = latency;
    updateBitrateVisibility();

    els.speedRange.value = store.get(LS.speed, '1');
    els.speedVal.textContent = Number(els.speedRange.value).toFixed(2) + '×';
    els.volumeRange.value = store.get(LS.volume, '0');
    els.volumeVal.textContent = els.volumeRange.value + ' dB';
    els.tempRange.value = store.get(LS.temp, '0.7');
    els.tempVal.textContent = els.tempRange.value;
    els.toppRange.value = store.get(LS.topp, '0.7');
    els.toppVal.textContent = els.toppRange.value;

    els.ttsText.value = store.get(LS.text, 'Hello! This is a test of Fish Audio speech synthesis, running entirely in the browser.');
    onTextChange();

    try {
      const v = JSON.parse(store.get(LS.voice, 'null'));
      if (v && v.id) {
        state.selectedVoice = v;
        els.selectedVoiceBadge.textContent = 'voice: ' + (v.title || v.id).slice(0, 26);
      }
    } catch { /* ignore */ }
  }

  async function boot() {
    bindEvents();
    restore();
    renderHistory();
    renderLog();
    renderLabSourceOptions();
    setLabCtxBadge();
    // first paint of the lab canvases once layout has settled
    requestAnimationFrame(() => { drawLabOverview(); drawScope(); });

    if (!state.apiKey) {
      setTransportBadge('no key', 'warn');
      els.connDot.className = 'dot warn';
      return;
    }

    // Auto-detect transport + load first page of voices.
    const c = await detectTransport(true);
    if (c) {
      await loadVoices();
      refreshCredit().catch(() => {});
    } else {
      els.voiceGrid.innerHTML =
        `<div class="voice-empty">
           Could not reach api.fish.audio from this browser.<br><br>
           • Run <code>node server.js</code> and open
           <code>http://localhost:8080</code> for the same-origin proxy, or<br>
           • pick a <strong>CORS relay</strong> in Connection (left), or<br>
           • deploy your own relay (see README) and paste its URL.
         </div>`;
    }
  }

  boot();
})();
