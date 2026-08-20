/**
 * Core Codex — app.js
 * Hash router, landing page (hero + live terminal, steps, features, models),
 * settings modal (BYO z.ai API key), upgrade modal, engine/plan header state.
 */
(function () {
  'use strict';

  if (!window.CC) return;
  const { $, $$, el } = CC;

  /* ================================ Router ================================= */

  let unmountCurrent = null;

  function route() {
    const hash = location.hash || '#/';
    const [pathPart, queryPart] = hash.replace(/^#/, '').split('?');
    const path = pathPart.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(queryPart || '');

    if (unmountCurrent) { try { unmountCurrent(); } catch { /* noop */ } unmountCurrent = null; }
    const view = document.getElementById('view');
    view.innerHTML = '';
    window.scrollTo(0, 0);

    $$('#main-nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === path));

    if (path === '/agent') {
      CC.Agent.mount(view);
      unmountCurrent = CC.Agent.unmount;
      document.querySelector('.site-footer').style.display = 'none';
    } else {
      document.querySelector('.site-footer').style.display = '';
      if (path === '/pricing') CC.Pricing.mount(view);
      else if (path === '/checkout') CC.Checkout.mount(view, params);
      else mountLanding(view);
    }
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', init);

  /* ============================== Header state ============================= */

  CC.setEngineChip = function setEngineChip(mode, text) {
    const chip = $('#engine-chip');
    if (!chip) return;
    chip.classList.remove('live', 'offline');
    const label = $('#engine-chip-text');
    if (mode === 'live') { chip.classList.add('live'); label.textContent = text || 'z.ai · live'; }
    else if (mode === 'offline') { chip.classList.add('offline'); label.textContent = text || 'z.ai · offline'; }
    else label.textContent = text || 'Local Engine';
  };

  function syncHeader() {
    const plan = CC.getPlan();
    const badge = $('#plan-badge');
    if (badge) {
      const info = CC.PLANS[plan.id] || CC.PLANS.free;
      badge.textContent = info.name;
      badge.classList.toggle('paid', plan.id !== 'free');
      badge.title = plan.orderId ? `Active · order ${plan.orderId}` : 'Current plan';
    }
    const settings = CC.getSettings();
    if (settings.apiKey) CC.setEngineChip('offline', 'z.ai key saved');
    else CC.setEngineChip('local');
  }

  /* ============================== Landing page ============================= */

  function mountLanding(view) {
    const wrap = el('div', { class: 'container' });

    /* Hero */
    const hero = el('section', { class: 'hero' },
      el('span', { class: 'hero-badge' }, el('span', { class: 'pulse' }), 'Now running GLM-5.3 — the latest z.ai flagship'),
      el('h1', {}, el('span', { class: 'gradient-text', text: 'Core Codex' })),
      el('p', { class: 'hero-sub', text: 'The AI coding agent that plans, writes and ships real projects. Powered by the latest GLM models — with your own API key or straight out of the box.' }),
      el('div', { class: 'hero-ctas' },
        el('a', { class: 'btn btn-primary btn-lg', href: '#/agent', text: 'Start building free' }),
        el('a', { class: 'btn btn-ghost btn-lg', href: '#/pricing', text: 'View pricing' })
      ),
      el('div', { class: 'hero-meta' },
        el('span', { text: '✓ No login' }), el('span', { text: '✓ No credit card to start' }),
        el('span', { text: '✓ Streaming generation' }), el('span', { text: '✓ Multi-file projects' })
      )
    );
    wrap.appendChild(hero);

    /* Terminal */
    wrap.appendChild(el('div', { class: 'terminal-wrap' }, el('div', { class: 'terminal' },
      el('div', { class: 'terminal-bar' },
        el('span', { class: 'dot r' }), el('span', { class: 'dot y' }), el('span', { class: 'dot g' }),
        el('span', { class: 'title', text: 'core-codex — agent session' })
      ),
      el('div', { class: 'terminal-body', id: 'hero-terminal' })
    )));

    /* Stats */
    wrap.appendChild(el('div', { class: 'hero-stats' },
      stat('7', 'GLM models incl. GLM-5.3'),
      stat('20–1,600', 'prompts / 5h by plan'),
      stat('0', 'logins required'),
      stat('256K', 'context window')
    ));
    function stat(num, lbl) {
      return el('div', {}, el('div', { class: 'num gradient-text', text: num }), el('div', { class: 'lbl', text: lbl }));
    }

    /* Steps */
    const steps = el('section', { class: 'section' },
      el('div', { class: 'section-head' },
        el('span', { class: 'eyebrow', style: 'justify-content:center', text: 'How it works' }),
        el('h2', { text: 'From idea to code in three moves' })),
      el('div', { class: 'steps-grid' },
        step(1, 'Describe it', 'Type what you want — “a todo app”, “a REST API”, “explain Big-O”. Plain English in.'),
        step(2, 'Watch it work', 'Core Codex streams its plan, then writes every file live — syntax-highlighted, in a real workspace.'),
        step(3, 'Ship it', 'Browse, copy or download the whole project as a .zip. Iteration is one message away.')
      )
    );
    function step(n, title, desc) {
      return el('div', { class: 'step-card' }, el('div', { class: 'step-num', text: '0' + n }), el('h3', { text: title }), el('p', { text: desc }));
    }
    wrap.appendChild(steps);

    /* Features */
    wrap.appendChild(el('section', { class: 'section' },
      el('div', { class: 'section-head' },
        el('span', { class: 'eyebrow', style: 'justify-content:center', text: 'Why Core Codex' }),
        el('h2', { text: 'Everything a coding agent should be' })),
      el('div', { class: 'features-grid' },
        feat('🧠', 'Latest z.ai models', 'GLM-5.3, GLM-5.2, GLM-5-Turbo and more — the same lineup behind Z Code.'),
        feat('📁', 'Multi-file projects', 'Not snippets — complete projects with a live file tree, per-file viewer and .zip export.'),
        feat('🔑', 'Bring your own key', 'Paste a z.ai API key and generation routes through the live API. Without one, the built-in engine keeps you working.'),
        feat('⚡', 'Streaming everything', 'Plans, code and explanations stream token-by-token with honest loading states.'),
        feat('🔒', 'Secure by default', 'Strict CSP, XSS-safe rendering, server-side payment validation — your card number is never stored.'),
        feat('🙅', 'No login, ever', 'Plans, sessions and keys stay in your browser. Nothing to sign up for, nothing to leak.')
      )
    ));
    function feat(icon, title, desc) {
      return el('div', { class: 'feature-card' }, el('div', { class: 'feature-icon', text: icon }), el('h3', { text: title }), el('p', { text: desc }));
    }

    /* Models */
    const modelsSection = el('section', { class: 'section' },
      el('div', { class: 'section-head' },
        el('span', { class: 'eyebrow', style: 'justify-content:center', text: 'Models' }),
        el('h2', { text: 'The z.ai lineup, latest first' }),
        el('p', { text: 'Every plan uses the same models — bigger tiers just add quota.' })));
    const modelsGrid = el('div', { class: 'models-grid' });
    modelsSection.appendChild(modelsGrid);
    wrap.appendChild(modelsSection);

    CC.api('/api/models').then((data) => {
      const badges = { newest: 'badge-new', flagship: 'badge-flag', fast: 'badge-fast', free: 'badge-free', balanced: 'badge-balanced', edge: 'badge-edge' };
      data.models.forEach((m) => {
        modelsGrid.appendChild(el('div', { class: 'model-card' },
          el('div', { class: 'row' },
            el('h3', { text: m.name }),
            el('span', { class: 'badge ' + (badges[m.badge] || 'badge-balanced'), text: m.badge || '' })),
          el('div', { class: 'model-tagline', text: m.tagline }),
          el('p', { class: 'model-desc', text: m.description }),
          el('div', { class: 'model-strengths' }, m.strengths.map((s) => el('span', { text: s }))),
          el('div', { class: 'model-specs' },
            el('span', {}, 'context ', el('b', { text: m.context })),
            m.pricing ? el('span', {}, 'API ', el('b', { text: `$${m.pricing.input}/$${m.pricing.output} per M` })) : el('span', {}, 'API ', el('b', { text: 'plan only' }))
          )
        ));
      });
    }).catch(() => {
      modelsGrid.appendChild(el('p', { class: 'notice-chip', text: 'Model catalog unavailable — the agent still works.' }));
    });

    /* Pricing preview */
    wrap.appendChild(el('section', { class: 'section', style: 'text-align:center' },
      el('div', { class: 'section-head' },
        el('span', { class: 'eyebrow', style: 'justify-content:center', text: 'Pricing' }),
        el('h2', { text: 'Plans that mirror the GLM Coding Plan' }),
        el('p', { text: 'Explorer (free), Lite $18/mo, Pro $72/mo, Max $160/mo — 30% off annually.' })),
      el('a', { class: 'btn btn-primary btn-lg', href: '#/pricing', text: 'Compare plans' })
    ));

    view.appendChild(wrap);

    /* Terminal typing animation */
    const term = document.getElementById('hero-terminal');
    if (term) startTerminal(term);
  }

  const TERMINAL_SCRIPT = [
    { cls: 't-prompt', text: 'you @ core-codex › ' },
    { cls: 't-you', text: 'build a todo app with filters' },
    { cls: '', text: '\n' },
    { cls: 't-dim', text: 'core codex · glm-5.3 · agent mode\n' },
    { cls: 't-agent', text: '✓ Understanding requirements\n' },
    { cls: 't-agent', text: '✓ Choosing a dependency-free architecture\n' },
    { cls: 't-agent', text: '✓ Writing index.html\n' },
    { cls: 't-agent', text: '✓ Writing styles.css\n' },
    { cls: 't-agent', text: '✓ Writing app.js — localStorage persistence\n' },
    { cls: 't-ok', text: '✓ Done · 3 files · project ready to download (.zip)\n' },
    { cls: 't-dim', text: 'tokens: 2,140 · 4.2s · local engine\n\n' },
  ];

  let termTimers = [];
  function startTerminal(node) {
    termTimers.forEach(clearTimeout);
    termTimers = [];
    let delay = 600;
    node.innerHTML = '';

    TERMINAL_SCRIPT.forEach((line, li) => {
      const span = el('span', { class: line.cls });
      node.appendChild(span);
      const typing = li === 1; // only the user prompt types char-by-char
      for (let i = 0; i < line.text.length; i++) {
        const ch = line.text[i];
        delay += typing ? 34 + Math.random() * 40 : 5;
        termTimers.push(setTimeout(() => { span.textContent += ch; }, delay));
      }
    });

    // blinking cursor at the end, then loop (only while the terminal is on-screen)
    const cursor = el('span', { class: 'cursor-blink' });
    termTimers.push(setTimeout(() => node.appendChild(cursor), delay + 100));
    termTimers.push(setTimeout(() => {
      if (document.body.contains(node)) startTerminal(node);
    }, delay + 4200));
  }

  /* ============================ Settings modal ============================= */

  function openSettings() {
    let keyStatus = null;

    CC.openModal((box, close) => {
      const settings = CC.getSettings();

      box.appendChild(el('div', { class: 'modal-head' },
        el('h3', { text: 'Settings' }),
        el('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close, html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' })
      ));
      box.appendChild(el('p', { class: 'modal-sub', text: 'No account needed — everything is stored in this browser only.' }));

      /* API key */
      const keyInput = el('input', {
        type: 'password', id: 'set-key', placeholder: 'Paste your z.ai API key',
        value: settings.apiKey || '', spellcheck: 'false',
      });
      const showBtn = el('button', {
        class: 'btn btn-ghost btn-sm', text: 'Show', type: 'button',
        onclick: () => {
          const showing = keyInput.type === 'text';
          keyInput.type = showing ? 'password' : 'text';
          showBtn.textContent = showing ? 'Show' : 'Hide';
        },
      });
      const validateBtn = el('button', {
        class: 'btn btn-outline btn-sm', text: 'Validate', type: 'button',
        onclick: async () => {
          validateBtn.disabled = true;
          validateBtn.textContent = 'Checking…';
          setStatus('info', 'Validating against z.ai…');
          try {
            const res = await CC.api('/api/keys/validate', { method: 'POST', body: { apiKey: keyInput.value.trim() } });
            if (!res.valid) setStatus('err', res.reason || 'That key doesn\'t look right.');
            else if (res.live) setStatus('ok', res.detail);
            else setStatus('warn', res.detail);
          } catch (err) {
            setStatus('err', err.message);
          } finally {
            validateBtn.disabled = false;
            validateBtn.textContent = 'Validate';
          }
        },
      });
      const row = el('div', { class: 'settings-row' }, keyInput, showBtn, validateBtn);

      keyStatus = el('div', { class: 'key-status', style: 'display:none' });
      function setStatus(kind, msg) {
        keyStatus.style.display = '';
        keyStatus.className = 'key-status ' + (kind === 'info' ? '' : kind);
        keyStatus.innerHTML = '';
        keyStatus.appendChild(el('span', { text: kind === 'ok' ? '✓' : kind === 'warn' ? '⚠' : kind === 'err' ? '✕' : '…' }));
        keyStatus.appendChild(el('div', { text: msg }));
      }

      const keySection = el('div', { class: 'modal-section' },
        el('h4', { text: 'z.ai API key (optional)' }),
        el('p', { class: 'f-hint', style: 'margin-bottom:12px' },
          'Get a key at z.ai → API Keys. With a valid key, generation routes through the live z.ai API (GLM models). ' +
          'Without one, the built-in local engine handles everything — the app works either way. ' +
          'The key is stored only in this browser and sent only to your own Core Codex server for proxying.'),
        row, keyStatus
      );
      box.appendChild(keySection);

      if (settings.apiKey) {
        setStatus('ok', `Saved key ${CC.maskKey(settings.apiKey)} — used automatically for generation.`);
      }

      /* Default model */
      const modelSelect = el('select', { class: 'model-select', id: 'set-model' });
      CC.api('/api/models').then((data) => {
        data.models.forEach((m) => modelSelect.appendChild(el('option', { value: m.id, text: m.name + (m.badge === 'free' ? ' (free)' : m.badge === 'newest' ? ' ✦' : '') })));
        modelSelect.value = settings.defaultModel || data.default || 'glm-5.2';
      }).catch(() => modelSelect.appendChild(el('option', { value: 'glm-5.2', text: 'GLM-5.2' })));

      box.appendChild(el('div', { class: 'modal-section' },
        el('h4', { text: 'Default model' }),
        modelSelect
      ));

      /* Danger zone */
      box.appendChild(el('div', { class: 'modal-section' },
        el('h4', { text: 'Local data' }),
        el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' },
          el('button', {
            class: 'btn btn-ghost btn-sm', text: 'Clear all sessions', type: 'button',
            onclick: () => { CC.ls.remove('cc_sessions'); CC.toast('Sessions cleared', 'ok'); if (CC.Agent.unmount) { CC.Agent.unmount(); CC.Agent.mount(document.getElementById('view')); } },
          }),
          el('button', {
            class: 'btn btn-ghost btn-sm', text: 'Reset usage counter', type: 'button',
            onclick: () => { CC.ls.remove('cc_usage'); CC.toast('Usage window reset', 'ok'); window.dispatchEvent(new CustomEvent('cc:plan')); },
          }),
          settings.apiKey
            ? el('button', {
                class: 'btn btn-danger btn-sm', text: 'Remove API key', type: 'button',
                onclick: () => {
                  const s = CC.getSettings(); s.apiKey = '';
                  CC.saveSettings(s); keyInput.value = '';
                  keyStatus.style.display = 'none';
                  syncHeader();
                  CC.toast('API key removed', 'ok');
                },
              })
            : null
        )
      ));

      /* Actions */
      box.appendChild(el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-outline', text: 'Cancel', type: 'button', onclick: close }),
        el('button', {
          class: 'btn btn-primary', text: 'Save settings', type: 'button',
          onclick: () => {
            const s = CC.getSettings();
            s.apiKey = keyInput.value.trim();
            s.defaultModel = modelSelect.value || s.defaultModel;
            CC.saveSettings(s);
            syncHeader();
            close();
            CC.toast(s.apiKey ? 'Settings saved — z.ai key active' : 'Settings saved', 'ok');
          },
        })
      ));
    });
  }

  /* ============================ Upgrade modal ============================== */

  CC.upgradeModal = function upgradeModal(quota) {
    CC.openModal((box, close) => {
      box.appendChild(el('div', { class: 'modal-head' },
        el('h3', { text: 'You\'ve hit your 5-hour limit' }),
        el('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close, html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' })
      ));
      box.appendChild(el('p', { class: 'modal-sub', text: `This window allows ${quota} prompts, like Z Code's quota system. Upgrade for more headroom — or reset the counter from Settings for testing.` }));
      box.appendChild(el('div', { class: 'receipt-rows' },
        el('div', { class: 'receipt-row' }, el('span', { text: 'Explorer (free)' }), el('b', { text: '20 / 5h' })),
        el('div', { class: 'receipt-row' }, el('span', { text: 'Lite' }), el('b', { text: '~80 / 5h · $18/mo' })),
        el('div', { class: 'receipt-row' }, el('span', { text: 'Pro' }), el('b', { text: '~400 / 5h · $72/mo' })),
        el('div', { class: 'receipt-row' }, el('span', { text: 'Max' }), el('b', { text: '~1,600 / 5h · $160/mo' }))
      ));
      box.appendChild(el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-outline', text: 'Maybe later', type: 'button', onclick: close }),
        el('a', { class: 'btn btn-primary', href: '#/pricing', text: 'See plans →', onclick: close })
      ));
    });
  };

  /* ================================= Init ================================== */

  function init() {
    document.getElementById('open-settings').addEventListener('click', openSettings);
    window.addEventListener('cc:plan', syncHeader);
    syncHeader();

    // Health check: reflect z.ai reachability in the header chip.
    CC.api('/api/health').then((h) => {
      const settings = CC.getSettings();
      if (settings.apiKey && h.upstream && h.upstream.reachable) CC.setEngineChip('live');
      else if (settings.apiKey) CC.setEngineChip('offline', 'z.ai key saved');
      else CC.setEngineChip('local');
    }).catch(() => {});

    route();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
