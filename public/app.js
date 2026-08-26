/* arena front-end — talks only to this origin, never to the providers directly. */
(() => {
  'use strict';

  const el = (id) => document.getElementById(id);
  const log = el('log');
  const input = el('input');
  const form = el('composer');
  const sendBtn = el('send');
  const pill = el('pill');
  const meta = el('meta');
  const streamChk = el('stream');

  let config = null;
  let mode = 'stealth';
  const history = { stealth: [], pickle: [] };
  let busy = false;

  const currentMode = () => (config ? config.modes.find((m) => m.id === mode) : null);
  const modeName = () => (currentMode() ? currentMode().name : mode);

  function setEmpty(text) {
    log.innerHTML = '';
    if (!text) return;
    const div = document.createElement('div');
    div.className = 'empty';
    div.innerHTML = text;
    log.appendChild(div);
  }

  function addMsg(kind, who) {
    const empty = log.querySelector('.empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = `msg ${kind}`;
    const label = document.createElement('span');
    label.className = 'who';
    label.textContent = who;
    const body = document.createElement('span');
    body.className = 'body';
    div.append(label, body);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return body;
  }

  function renderMeta() {
    if (!config) return;
    meta.innerHTML = '';
    for (const m of config.modes) {
      const chip = document.createElement('span');
      chip.className = 'chip' + (m.keyConfigured ? '' : ' missing');
      chip.innerHTML = `<b>${m.name}</b> · ${m.baseUrl} · ${m.model} · ${
        m.keyConfigured ? `${m.keyVar} ${m.keyMasked}` : `${m.keyVar} NOT SET`
      }`;
      meta.appendChild(chip);
    }
  }

  function setMode(next) {
    mode = next;
    document.body.dataset.mode = next;
    for (const btn of document.querySelectorAll('.sw')) {
      btn.setAttribute('aria-selected', String(btn.dataset.mode === next));
    }
    const m = currentMode();
    pill.textContent = m && !m.keyConfigured ? `${m.keyVar} missing` : mode === 'stealth' ? 'openrouter' : 'opencode zen';
    pill.className = 'pill' + (m && m.keyConfigured ? ' ok' : ' bad');
    input.placeholder = m
      ? `Ask ${m.name} something…  (Enter to send, Shift+Enter for a newline)`
      : 'Ask something…';
    replay();
  }

  function replay() {
    setEmpty(null);
    const msgs = history[mode];
    if (!msgs.length) {
      const m = currentMode();
      setEmpty(
        m && !m.keyConfigured
          ? `<b>${m.name}</b> has no API key on the server.<br/>Set <code>${m.keyVar}</code> in <code>.env</code> (see <code>.env.example</code>) and restart the server.`
          : `Nothing yet. Pick a backend above and send a message.`
      );
      return;
    }
    for (const msg of msgs) {
      const body = addMsg(msg.role === 'user' ? 'user' : msg.error ? 'err' : 'bot', msg.who);
      body.textContent = msg.text;
    }
  }

  function pushHistory(role, who, text, error = false) {
    history[mode].push({ role, who, text, error });
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config', { headers: { accept: 'application/json' } });
      config = await res.json();
    } catch (err) {
      pill.textContent = 'config unreachable';
      pill.className = 'pill bad';
      return;
    }
    renderMeta();
    setMode(mode);
  }

  /** Parse an SSE byte stream into `data:` payloads. */
  function sseReader(response, onData, onDone) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const pump = () =>
      reader.read().then(({ done, value }) => {
        if (done) {
          if (buffer.trim()) onData(buffer);
          onDone();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of frame.split('\n')) {
            if (line.startsWith('data:')) onData(line.slice(5).trim());
          }
        }
        pump();
      });

    pump().catch(onDone);
  }

  function deltaOf(chunk) {
    if (!chunk || typeof chunk !== 'object') return '';
    const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : null;
    if (!choice) return '';
    if (choice.delta && typeof choice.delta.content === 'string') return choice.delta.content;
    if (typeof choice.text === 'string') return choice.text;
    return '';
  }

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;

    const m = currentMode();
    if (m && !m.keyConfigured) {
      addMsg('err', 'error').textContent = `${m.name} is not configured on the server: set ${m.keyVar} in .env and restart.`;
      pushHistory('assistant', 'error', `${m.name} is not configured on the server: set ${m.keyVar} in .env and restart.`, true);
      return;
    }

    busy = true;
    sendBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto';

    pushHistory('user', 'you', text);
    addMsg('user', 'you').textContent = text;

    const body = addMsg('bot', modeName());
    body.classList.add('cursor');
    let acc = '';
    const stream = streamChk.checked;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, stream, messages: history[mode].filter((h) => !h.error).map(({ role, text: t }) => ({ role, content: t })) })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const detail = (payload.error && (payload.error.message || JSON.stringify(payload.error))) || `HTTP ${res.status}`;
        body.classList.remove('cursor');
        body.textContent = detail;
        body.parentElement.className = 'msg err';
        body.parentElement.querySelector('.who').textContent = 'error';
        pushHistory('assistant', 'error', detail, true);
        return;
      }

      if (!stream) {
        const payload = await res.json();
        const msg = payload.completion && payload.completion.choices && payload.completion.choices[0] && payload.completion.choices[0].message;
        acc = (msg && msg.content) || JSON.stringify(payload.completion);
        body.textContent = acc;
        pushHistory('assistant', modeName(), acc);
        return;
      }

      await new Promise((resolve) => {
        sseReader(
          res,
          (data) => {
            if (!data || data === '[DONE]') return;
            let chunk;
            try {
              chunk = JSON.parse(data);
            } catch {
              return;
            }
            if (chunk.error) {
              acc += `\n[upstream error] ${chunk.error.message || JSON.stringify(chunk.error)}`;
              body.textContent = acc;
              return;
            }
            const piece = deltaOf(chunk);
            if (piece) {
              acc += piece;
              body.textContent = acc;
              log.scrollTop = log.scrollHeight;
            }
          },
          resolve
        );
      });

      body.classList.remove('cursor');
      if (!acc) {
        body.textContent = '(empty response)';
        pushHistory('assistant', 'error', '(empty response)', true);
      } else {
        pushHistory('assistant', modeName(), acc);
      }
    } catch (err) {
      body.classList.remove('cursor');
      body.textContent = `request failed: ${err.message}`;
      body.parentElement.className = 'msg err';
      body.parentElement.querySelector('.who').textContent = 'error';
      pushHistory('assistant', 'error', `request failed: ${err.message}`, true);
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  async function ping() {
    pill.textContent = 'pinging…';
    pill.className = 'pill';
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      const m = data.providers[mode];
      if (!m) throw new Error('no provider data');
      pill.textContent = m.ok ? `${modeName()} · ${m.models ?? '?'} models` : m.detail || `HTTP ${m.status || 'error'}`;
      pill.className = 'pill ' + (m.ok ? 'ok' : 'bad');
    } catch (err) {
      pill.textContent = `ping failed: ${err.message}`;
      pill.className = 'pill bad';
    }
  }

  for (const btn of document.querySelectorAll('.sw')) {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  }

  el('health').addEventListener('click', ping);

  el('clear').addEventListener('click', () => {
    history[mode] = [];
    replay();
    input.focus();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  });

  loadConfig();
})();
