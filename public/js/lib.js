/**
 * Core Codex — lib.js
 * Shared utilities: API client, SSE reader, markdown renderer, syntax
 * highlighter, ZIP writer, toasts, modals. Pure functions (markdown,
 * highlight, zip, luhn) are also usable from Node for testing.
 */
(function () {
  'use strict';

  const CC = {};

  /* ============================== DOM helpers ============================== */

  CC.$ = (sel, root) => (root || document).querySelector(sel);
  CC.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  CC.el = function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v; // trusted templates only
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, String(v));
      }
    }
    for (const child of children.flat()) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  };

  CC.escapeHtml = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  CC.fmtMoney = (cents) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  CC.fmtBytes = (n) => {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  };

  CC.timeAgo = (iso) => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };

  CC.debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  /* ============================== API client =============================== */

  CC.api = async function api(path, opts) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts && opts.body && typeof opts.body === 'object' ? JSON.stringify(opts.body) : opts && opts.body,
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  /**
   * POST an SSE request and dispatch parsed JSON events.
   * Returns { promise, abort }.
   */
  CC.streamEvents = function streamEvents(path, body, handlers) {
    const ctl = new AbortController();
    const promise = (async () => {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `Stream failed (${res.status})`;
        try { const j = await res.json(); msg = j.error || msg; } catch { /* keep */ }
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            let evt;
            try { evt = JSON.parse(raw); } catch { continue; }
            try { handlers(evt); } catch (err) { console.error('handler error', err); }
          }
        }
      }
    })();
    return { promise, abort: () => ctl.abort() };
  };

  /* ============================ Markdown renderer ========================== */
  /* Renders a safe subset: headings, hr, lists, tables, blockquotes, bold,
     italic, strike, inline code, links (http/https/# only), fenced code. */

  const inline = (raw) => {
    let s = CC.escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, (_, code) => `<code class="inline">${code}</code>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    s = s.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|#[^)\s]*)\)/g,
      (_, text, href) => `<a href="${href}"${href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
    );
    return s;
  };

  CC.renderMarkdown = function renderMarkdown(src) {
    if (!src) return '';

    // Pull out fenced code blocks first.
    const codeBlocks = [];
    let text = String(src).replace(/```([\w+#.-]*)[ \t]*\n([\s\S]*?)(?:```|$)/g, (_, lang, code) => {
      codeBlocks.push({ lang: (lang || '').toLowerCase(), code: code.replace(/\n$/, '') });
      return `\u0000CODE${codeBlocks.length - 1}\u0000`;
    });

    const lines = text.split('\n');
    const out = [];
    let list = null;      // 'ul' | 'ol'
    let para = [];
    let table = [];

    const flushPara = () => {
      if (para.length) {
        out.push(`<p>${inline(para.join(' '))}</p>`);
        para = [];
      }
    };
    const flushList = () => {
      if (list) { out.push(`</${list}>`); list = null; }
    };
    const flushTable = () => {
      if (!table.length) return;
      const rows = table.map((r) => {
        const cells = r.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        const tag = 'cell';
        return { cells, tag };
      });
      if (rows.length >= 2 && /^[-: ]+$/.test(rows[1].cells.join(''))) {
        const head = rows[0];
        const body = rows.slice(2);
        out.push('<table><thead><tr>' + head.cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
        for (const r of body) out.push('<tr>' + r.cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
        out.push('</tbody></table>');
      } else {
        out.push('<table><tbody>');
        for (const r of rows) out.push('<tr>' + r.cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
        out.push('</tbody></table>');
      }
      table = [];
    };

    for (const rawLine of lines) {
      const line = rawLine;

      if (/^\s*\|.*\|\s*$/.test(line)) { flushPara(); flushList(); table.push(line.trim()); continue; }
      flushTable();

      const codeRef = line.trim().match(/^\u0000CODE(\d+)\u0000$/);
      if (codeRef) {
        flushPara(); flushList();
        const block = codeBlocks[Number(codeRef[1])] || { code: '', lang: '' };
        out.push(CC.codeBlockHtml(block.code, block.lang));
        continue;
      }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushPara(); flushList(); const l = h[1].length; out.push(`<h${l}>${inline(h[2])}</h${l}>`); continue; }

      if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); continue; }

      const bq = line.match(/^>\s?(.*)$/);
      if (bq) { flushPara(); flushList(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); continue; }

      const ul = line.match(/^\s*[-*+]\s+(.*)$/);
      if (ul) {
        flushPara();
        if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; }
        out.push(`<li>${inline(ul[1])}</li>`);
        continue;
      }

      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ol) {
        flushPara();
        if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; }
        out.push(`<li>${inline(ol[1])}</li>`);
        continue;
      }

      if (!line.trim()) { flushPara(); flushList(); continue; }

      para.push(line.trim());
    }
    flushTable(); flushPara(); flushList();

    return out.join('\n');
  };

  /* ============================ Syntax highlighter ========================= */
  /* Single-pass tokenizer per language: comments & strings win, then keywords
     and numbers. Everything is HTML-escaped on output (XSS-safe). */

  const KW = {
    javascript:
      'const|let|var|function|return|if|else|for|while|do|of|in|new|class|extends|super|import|export|from|default|async|await|try|catch|finally|throw|switch|case|break|continue|typeof|instanceof|delete|this|null|undefined|true|false|yield|static|get|set',
    typescript:
      'const|let|var|function|return|if|else|for|while|do|of|in|new|class|extends|implements|interface|type|enum|import|export|from|default|async|await|try|catch|finally|throw|switch|case|break|continue|typeof|instanceof|this|null|undefined|true|false|as|readonly|public|private|protected|abstract|satisfies',
    python:
      'def|return|if|elif|else|for|while|break|continue|import|from|as|class|try|except|finally|raise|with|lambda|pass|None|True|False|and|or|not|in|is|global|nonlocal|assert|yield|async|await|match|case',
    bash: 'if|then|else|elif|fi|for|while|do|done|case|esac|function|return|export|local|echo|cd|sudo|npm|npx|node|python|pip|git|curl|docker|mkdir|rm|cp|mv|cat|ls',
    json: 'true|false|null',
    css: '',
    html: '',
  };
  KW.js = KW.javascript;
  KW.ts = KW.typescript;
  KW.py = KW.python;
  KW.jsx = KW.typescript;
  KW.tsx = KW.typescript;
  KW.sh = KW.bash;
  KW.shell = KW.bash;

  function langRules(lang) {
    const kw = KW[lang] || KW.javascript;

    if (lang === 'html' || lang === 'xml' || lang === 'svg') {
      return [
        { re: '&lt;!--[\\s\\S]*?--&gt;', kind: 'cm', pre: true },
        { re: '&quot;[^&]*?&quot;|&#39;[^&]*?&#39;', kind: 'str', pre: true },
        { re: '&lt;/?[a-zA-Z][\\w-]*', kind: 'tag', pre: true },
        { re: '[a-zA-Z-]+(?==)', kind: 'attr', pre: true },
      ];
    }

    if (lang === 'css') {
      return [
        { re: '/\\*[\\s\\S]*?\\*/', kind: 'cm' },
        { re: '"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'', kind: 'str' },
        { re: '[.#]?[a-zA-Z_-][\\w-]*(?=[^{};]*\\{)', kind: 'fn' },
        { re: '(?<=[:\\s])-[a-z-]+(?=:)', kind: 'attr' },
        { re: '#[0-9a-fA-F]{3,8}\\b|\\b\\d+(?:\\.\\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg)?\\b', kind: 'num' },
      ];
    }

    // C-family / script languages
    const rules = [];
    if (lang === 'python') {
      rules.push({ re: '#.*$', kind: 'cm' });
      rules.push({ re: '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'', kind: 'str' });
    } else if (lang === 'json') {
      // no comments
    } else {
      rules.push({ re: '//.*$', kind: 'cm' });
      rules.push({ re: '/\\*[\\s\\S]*?\\*/', kind: 'cm' });
    }
    rules.push({ re: '"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`', kind: 'str' });
    if (kw) rules.push({ re: `\\b(?:${kw})\\b`, kind: 'kw' });
    rules.push({ re: '\\b\\d+(?:\\.\\d+)?\\b', kind: 'num' });
    rules.push({ re: '[a-zA-Z_$][\\w$]*(?=\\s*\\()', kind: 'fn' });
    return rules;
  }

  const ruleCache = {};

  CC.highlight = function highlight(code, lang) {
    const language = String(lang || '').toLowerCase();
    if (!language || language === 'text' || language === 'txt' || language === 'plain') {
      return CC.escapeHtml(code);
    }

    let compiled = ruleCache[language];
    if (!compiled) {
      const rules = langRules(language);
      const sources = rules.map((r) => `(${r.re})`);
      const re = new RegExp(sources.join('|'), 'gm');
      compiled = ruleCache[language] = { re, kinds: rules.map((r) => r.kind), pre: rules.map((r) => !!r.pre) };
    }

    // HTML-mode rules match against escaped text; others against raw text.
    const isPre = compiled.pre.includes(true);
    const input = isPre ? CC.escapeHtml(code) : code;
    // In pre mode the input is already escaped — never double-escape.
    const emitToken = isPre ? (s) => s : CC.escapeHtml;
    const emitPlain = isPre ? (s) => s : CC.escapeHtml;

    let result = '';
    let last = 0;
    compiled.re.lastIndex = 0;
    let m;
    while ((m = compiled.re.exec(input)) !== null) {
      if (m.index > last) result += emitPlain(input.slice(last, m.index));
      let kind = null;
      for (let g = 1; g < m.length; g++) {
        if (m[g] !== undefined) { kind = compiled.kinds[g - 1]; break; }
      }
      result += kind ? `<span class="tk-${kind}">${emitToken(m[0])}</span>` : emitToken(m[0]);
      last = m.index + m[0].length;
      if (m[0].length === 0) compiled.re.lastIndex++;
    }
    result += emitPlain(input.slice(last));
    return result;
  };

  CC.codeBlockHtml = function codeBlockHtml(code, lang) {
    const safeLang = CC.escapeHtml(lang || 'code');
    const body = CC.highlight(code, lang);
    return (
      `<div class="code-block" data-code>` +
      `<div class="code-head"><span class="code-lang">${safeLang}</span>` +
      `<button class="copy-btn" type="button">Copy</button></div>` +
      `<pre><code>${body}</code></pre></div>`
    );
  };

  // Wire copy buttons for all code blocks under a root (event delegation).
  CC.bindCopyButtons = function bindCopyButtons(root) {
    if (!root) return;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;
      const block = btn.closest('.code-block, .code-head');
      const code = btn.closest('.code-block').querySelector('code');
      const text = code ? code.textContent : '';
      navigator.clipboard
        .writeText(text)
        .then(() => {
          btn.classList.add('copied');
          btn.textContent = 'Copied ✓';
          setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 1600);
        })
        .catch(() => {
          btn.textContent = 'Press ⌘C';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
        });
    });
  };

  /* =============================== ZIP writer ============================== */
  /* Minimal ZIP (store method, no compression) — used for "Download project". */

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  CC.makeZip = function makeZip(files) {
    // files: [{ name: string, content: string }]
    const encoder = new TextEncoder();
    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

    const locals = [];
    const centrals = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = encoder.encode(file.content);
      const crc = crc32(dataBytes);

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true); // UTF-8 names
      lv.setUint16(8, 0, true);      // store
      lv.setUint16(10, dosTime, true);
      lv.setUint16(12, dosDate, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, dataBytes.length, true);
      lv.setUint32(22, dataBytes.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      locals.push(local, dataBytes);

      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, dataBytes.length, true);
      cv.setUint32(24, dataBytes.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centrals.push(central);

      offset += local.length + dataBytes.length;
    }

    const centralSize = centrals.reduce((s, c) => s + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const parts = [...locals, ...centrals, eocd];
    let total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { out.set(p, pos); pos += p.length; }
    return out;
  };

  CC.downloadBytes = function downloadBytes(bytes, filename, type) {
    const blob = new Blob([bytes], { type: type || 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  /* ================================ Toasts ================================= */

  CC.toast = function toast(message, kind) {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    const icons = { ok: '✓', err: '✕', info: 'ℹ' };
    const t = CC.el('div', { class: `toast ${kind || ''}`, role: 'status' },
      CC.el('span', { class: 't-ico', text: icons[kind] || icons.info }),
      CC.el('div', { text: message })
    );
    stack.appendChild(t);
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 350);
    }, 4200);
  };

  /* ================================ Modals ================================= */

  let activeModal = null;

  CC.openModal = function openModal(build) {
    const backdrop = document.getElementById('modal-root');
    backdrop.innerHTML = '';
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';

    const modal = CC.el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
    build(modal, close);
    backdrop.appendChild(modal);
    activeModal = { backdrop, modal };

    function close() {
      backdrop.hidden = true;
      backdrop.innerHTML = '';
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      activeModal = null;
    }

    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    backdrop.onclick = (e) => { if (e.target === backdrop) close(); };

    return close;
  };

  CC.closeModal = function closeModal() {
    const backdrop = document.getElementById('modal-root');
    if (backdrop) { backdrop.hidden = true; backdrop.innerHTML = ''; }
    document.body.style.overflow = '';
    activeModal = null;
  };

  /* ============================ Client state =============================== */

  const LS = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* noop */ }
    },
  };

  CC.ls = LS;

  // settings: { apiKey, defaultModel }
  CC.getSettings = () => LS.get('cc_settings', { apiKey: '', defaultModel: 'glm-5.2' });
  CC.saveSettings = (s) => LS.set('cc_settings', s);

  // plan: { id, orderId, cycle, since }
  CC.getPlan = () => LS.get('cc_plan', { id: 'free' });
  CC.setPlan = (p) => LS.set('cc_plan', p);

  CC.PLANS = {
    free: { name: 'Free', quota5h: 20 },
    lite: { name: 'Lite', quota5h: 80 },
    pro: { name: 'Pro', quota5h: 400 },
    max: { name: 'Max', quota5h: 1600 },
  };

  CC.quotaFor = (planId) => (CC.PLANS[planId] || CC.PLANS.free).quota5h;

  // usage: { windowStart, count }  — rolling 5h window
  CC.getUsage = function getUsage() {
    const u = LS.get('cc_usage', null);
    const now = Date.now();
    if (!u || !u.windowStart || now - u.windowStart > 5 * 3600 * 1000) {
      return { windowStart: now, count: 0 };
    }
    return u;
  };
  CC.bumpUsage = function bumpUsage() {
    const u = CC.getUsage();
    const next = { windowStart: u.windowStart, count: u.count + 1 };
    LS.set('cc_usage', next);
    return next;
  };
  CC.usageResetsAt = () => new Date(CC.getUsage().windowStart + 5 * 3600 * 1000);

  CC.maskKey = (key) => {
    if (!key) return '';
    if (key.length <= 10) return key.slice(0, 3) + '••••';
    return key.slice(0, 6) + '••••••••' + key.slice(-4);
  };

  /* ============================== Export ================================== */

  if (typeof window !== 'undefined') window.CC = CC;
  if (typeof module !== 'undefined' && module.exports) module.exports = CC;
})();
