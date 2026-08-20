/**
 * Core Codex — checkout.js
 * Pricing page (Z Code-style tiers) and secure checkout flow:
 * live card formatting & Luhn checks client-side, authoritative validation
 * and pricing server-side, animated processing state, receipt + confetti.
 * PAN never leaves this transaction — only brand + last4 are ever stored.
 */
(function () {
  'use strict';

  if (!window.CC) return;
  const { $, $$, el } = CC;

  let plansCache = null;

  async function loadPlans() {
    if (plansCache) return plansCache;
    const data = await CC.api('/api/plans');
    plansCache = data;
    return data;
  }

  const money = (cents) => CC.fmtMoney(cents);

  /* ================================ Pricing ================================ */

  const Pricing = { mount: mountPricing };

  async function mountPricing(view) {
    view.innerHTML = '';
    let data;
    try {
      data = await loadPlans();
    } catch (err) {
      view.appendChild(el('div', { class: 'container section', style: 'text-align:center' },
        el('p', { class: 'notice-chip', style: 'display:inline-flex', text: 'Could not load plans: ' + err.message })));
      return;
    }
    const plans = data.plans;
    let annual = false;
    const activePlan = CC.getPlan().id;

    const wrap = el('div', { class: 'container' });

    wrap.appendChild(el('div', { class: 'section-head', style: 'margin-top:56px' },
      el('span', { class: 'eyebrow', style: 'justify-content:center', text: 'Pricing' }),
      el('h2', { text: 'Core Codex plans' }),
      el('p', { text: 'Every plan includes the full GLM model lineup. Higher tiers just add quota — the same way Z Code plans work.' })
    ));

    // Monthly / annual toggle
    const monthlyLbl = el('span', { class: 'cycle-label active', text: 'Monthly' });
    const annualLbl = el('span', { class: 'cycle-label', text: 'Annual' });
    const savePill = el('span', { class: 'save-pill', text: 'save 30%' });
    annualLbl.appendChild(savePill);
    const switchEl = el('button', {
      class: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-label': 'Toggle annual billing',
      onclick: () => { annual = !annual; sync(); },
    });
    const toggle = el('div', { class: 'pricing-toggle' }, monthlyLbl, switchEl, annualLbl);

    const grid = el('div', { class: 'pricing-grid' });

    function sync() {
      switchEl.classList.toggle('on', annual);
      switchEl.setAttribute('aria-checked', String(annual));
      monthlyLbl.classList.toggle('active', !annual);
      annualLbl.classList.toggle('active', annual);
      renderCards();
    }

    function renderCards() {
      grid.innerHTML = '';
      plans.forEach((p) => {
        const isFree = p.priceCents === 0;
        const perMonth = annual ? Math.round(p.annualCents / 12) : p.priceCents;
        const card = el('div', { class: 'plan-card' + (p.popular ? ' popular' : '') });

        if (p.popular) card.appendChild(el('div', { class: 'popular-flag', text: 'Most popular' }));

        card.appendChild(el('div', { class: 'row', style: 'display:flex;justify-content:space-between;align-items:center' },
          el('div', { class: 'plan-name', text: p.name })));
        card.appendChild(el('p', { class: 'plan-for', text: planFor(p) }));

        card.appendChild(el('div', { class: 'plan-price' },
          el('span', { class: 'amount', text: isFree ? '$0' : money(perMonth) }),
          el('span', { class: 'per', text: '/ month' })
        ));
        card.appendChild(el('div', { class: 'plan-annual-note', text: annualNote(p, annual) }));

        const ul = el('ul', { class: 'plan-features' });
        p.features.forEach((f) => ul.appendChild(el('li', { text: f })));
        ul.appendChild(el('li', { text: 'MCP calls: ' + p.mcpCalls.toLocaleString() + '/mo', class: 'muted' }));
        card.appendChild(ul);

        const cta = el('a', {
          class: 'btn ' + (p.popular || activePlan === p.id ? 'btn-primary' : 'btn-outline'),
          href: isFree ? '#/agent' : `#/checkout?plan=${p.id}&cycle=${annual ? 'annual' : 'monthly'}`,
          text: isFree ? 'Start free' : activePlan === p.id ? 'Current plan · upgrade' : 'Choose ' + p.name,
        });
        card.appendChild(cta);
        grid.appendChild(card);
      });
    }

    wrap.appendChild(toggle);
    wrap.appendChild(grid);

    /* Comparison table */
    const cmpSection = el('div', { class: 'section' });
    cmpSection.appendChild(el('div', { class: 'section-head' },
      el('h2', { text: 'Compare plans' })));
    const table = el('table', { class: 'cmp-table' });
    table.innerHTML =
      '<tr><th>Feature</th>' + plans.map((p) => `<th>${p.name}</th>`).join('') + '</tr>' +
      row('Prompts / 5 hours', plans, (p) => p.quota5h.toLocaleString()) +
      row('Prompts / week', plans, (p) => p.weeklyQuota.toLocaleString()) +
      row('MCP calls / month', plans, (p) => p.mcpCalls ? p.mcpCalls.toLocaleString() : '—') +
      row('GLM-5.3 & GLM-5.2', plans, (p) => (p.id === 'free' ? '—' : '<span class="yes">✓</span>')) +
      row('Priority peak speeds', plans, (p) => (p.id === 'pro' || p.id === 'max' ? '<span class="yes">✓</span>' : '—')) +
      row('First access to new models', plans, (p) => (p.id === 'max' ? '<span class="yes">✓</span>' : '—')) +
      row('Bring your own z.ai key', plans, () => '<span class="yes">✓</span>') +
      row('Price / month', plans, (p) => (p.priceCents === 0 ? '$0' : money(p.priceCents))) +
      row('Annual (per month)', plans, (p) => (p.priceCents === 0 ? '$0' : money(Math.round(p.annualCents / 12))));
    function row(label, list, cell) {
      return `<tr><td>${label}</td>` + list.map((p) => `<td>${cell(p)}</td>`).join('') + '</tr>';
    }
    const cmpWrap = el('div', { class: 'pricing-compare' }, table);
    cmpSection.appendChild(cmpWrap);
    wrap.appendChild(cmpSection);

    /* FAQ */
    const faq = el('div', { class: 'section pricing-faq' },
      el('div', { class: 'section-head' }, el('h2', { text: 'Questions' })));
    const faqs = [
      ['Do I need an account?', 'No. Core Codex works without any login. Your plan, sessions and API key live in your own browser — nothing to sign up for.'],
      ['What do I get with a paid plan?', 'Higher usage quotas (the same tiering as the GLM Coding Plan: ~80 / ~400 / ~1,600 prompts per 5-hour window) and MCP tooling allowances. Every tier uses the same models.'],
      ['How does billing work?', 'Monthly plans renew every 30 days; annual plans are billed once a year at 30% off. You can switch or cancel any time from the receipt link.'],
      ['Is my card safe?', 'Yes. Card data is validated in the browser and processed server-side over the same origin; the full card number is never stored — only the brand and last 4 digits, which appear on your receipt.'],
      ['Can I use my own z.ai API key?', 'Absolutely — open Settings and paste a key from z.ai → API Keys. Core Codex validates it and routes generation through the live z.ai API. Without a key, the built-in local engine keeps everything working.'],
      ['Which models are included?', 'The latest z.ai lineup: GLM-5.3, GLM-5.2, GLM-5-Turbo, GLM-4.7, GLM-4.7-Flash, GLM-4.5-Air and GLM-4.5-Flash.'],
    ];
    faqs.forEach(([q, a]) => {
      const item = el('div', { class: 'faq-item' });
      const btn = el('button', { class: 'faq-q', onclick: () => item.classList.toggle('open') },
        el('span', { text: q }), el('span', { class: 'chev', text: '⌄' }));
      item.appendChild(btn);
      item.appendChild(el('div', { class: 'faq-a', text: a }));
      faq.appendChild(item);
    });
    wrap.appendChild(faq);

    view.appendChild(wrap);
    sync();
  }

  function planFor(p) {
    return {
      free: 'Kick the tires, no card',
      lite: 'Evenings & weekend projects',
      pro: 'Daily driver for serious builders',
      max: 'Long autonomous agent sessions',
    }[p.id] || '';
  }
  function annualNote(p, annual) {
    if (p.priceCents === 0) return 'Free forever';
    if (annual) return `Billed ${money(p.annualCents)} today · renews yearly`;
    return `or ${money(Math.round(p.annualCents / 12))}/mo billed annually`;
  }

  /* ================================ Checkout =============================== */

  const Checkout = { mount: mountCheckout };

  async function mountCheckout(view, params) {
    view.innerHTML = '';
    let plans;
    try { plans = (await loadPlans()).plans; } catch (err) {
      view.appendChild(el('div', { class: 'checkout-shell' },
        el('div', { class: 'panel' }, el('h2', { text: 'Checkout unavailable' }), el('p', { text: err.message }))));
      return;
    }

    const planId = (params.get('plan') || 'pro').toLowerCase();
    const plan = plans.find((p) => p.id === planId && p.priceCents > 0) || plans.find((p) => p.id === 'pro');
    let cycle = params.get('cycle') === 'annual' ? 'annual' : 'monthly';

    const shell = el('div', { class: 'checkout-shell' });
    const grid = el('div', { class: 'checkout-grid' });

    /* ---- Order summary panel ---- */
    const summary = el('div', { class: 'panel' });
    const cycleChoice = el('div', { class: 'cycle-choice' });
    const orderBody = el('div', {});

    function renderSummary() {
      cycleChoice.innerHTML = '';
      const monthly = el('div', {
        class: 'cycle-opt' + (cycle === 'monthly' ? ' selected' : ''), role: 'button', tabindex: '0',
        onclick: () => { cycle = 'monthly'; syncSummary(); },
      }, el('div', { class: 'co-title' }, el('span', { text: 'Monthly' }), el('span', { text: money(plan.priceCents) })),
         el('div', { class: 'co-sub', text: 'Renews every 30 days' }));
      const annual = el('div', {
        class: 'cycle-opt' + (cycle === 'annual' ? ' selected' : ''), role: 'button', tabindex: '0',
        onclick: () => { cycle = 'annual'; syncSummary(); },
      }, el('div', { class: 'co-title' }, el('span', { text: 'Annual ' }, el('span', { class: 'save-pill', text: '-30%' })), el('span', { text: money(Math.round(plan.annualCents / 12)) })),
         el('div', { class: 'co-sub', text: `${money(plan.annualCents)} per year` }));
      cycleChoice.appendChild(monthly);
      cycleChoice.appendChild(annual);

      const total = cycle === 'annual' ? plan.annualCents : plan.priceCents;
      orderBody.innerHTML = '';
      orderBody.appendChild(el('div', { class: 'order-plan' },
        el('div', {}, el('div', { class: 'op-name', text: 'Core Codex ' + plan.name }), el('div', { class: 'op-cycle', text: plan.models })),
        el('span', { class: 'badge badge-flag', text: plan.name })));
      const lines = el('div', { class: 'order-lines' });
      lines.appendChild(el('div', { class: 'order-line' }, el('span', { text: `Core Codex ${plan.name} (${cycle})` }), el('b', { text: money(total) })));
      lines.appendChild(el('div', { class: 'order-line' }, el('span', { text: 'Prompts / 5 hours' }), el('b', { text: '~' + plan.quota5h.toLocaleString() })));
      lines.appendChild(el('div', { class: 'order-line' }, el('span', { text: 'MCP calls / month' }), el('b', { text: plan.mcpCalls.toLocaleString() })));
      lines.appendChild(el('div', { class: 'order-line' }, el('span', { text: 'VAT / tax' }), el('b', { text: 'included' })));
      orderBody.appendChild(lines);
      orderBody.appendChild(el('div', { class: 'order-total' },
        el('span', { class: 'lbl', text: 'Total due today' }),
        el('span', { class: 'amt', text: money(total) })));
      orderBody.appendChild(el('p', { class: 'order-note', text: cycle === 'annual' ? `Renews at ${money(plan.annualCents)}/year. Cancel anytime.` : `Renews at ${money(plan.priceCents)}/month. Cancel anytime.` }));
    }
    function syncSummary() { renderSummary(); location.hash = `#/checkout?plan=${plan.id}&cycle=${cycle}`; }

    summary.appendChild(el('h2', { text: 'Order summary' }));
    summary.appendChild(el('p', { class: 'panel-sub', text: 'No account needed — your plan activates instantly on this device.' }));
    summary.appendChild(cycleChoice);
    summary.appendChild(orderBody);

    /* ---- Payment panel ---- */
    const pay = el('div', { class: 'panel', style: 'position:relative' });
    pay.appendChild(el('h2', { text: 'Payment' }));
    pay.appendChild(el('p', { class: 'panel-sub', text: 'Processed securely server-side · we never store your full card number' }));

    const nameField = fieldEl('Name on card', 'text', 'Ada Lovelace', 'cc-name');
    const numberField = fieldEl('Card number', 'text', '4242 4242 4242 4242', 'cc-number');
    numberField.classList.add('has-card');
    const brandIco = el('span', { class: 'card-brand-ico', text: '💳' });
    numberField.appendChild(brandIco);
    const numberInput = numberField.querySelector('input');

    const expField = fieldEl('Expiry', 'text', 'MM/YY', 'cc-exp', { maxlength: 5 });
    const cvcField = fieldEl('Security code', 'text', 'CVC', 'cc-cvc', { maxlength: 4, inputmode: 'numeric' });
    const rowWrap = el('div', { class: 'field' }, el('div', { class: 'f-row' }, expField, cvcField));
    expField.classList.remove('field'); expField.classList.add('field');
    const emailField = fieldEl('Email (optional, for the receipt)', 'email', 'you@example.com', 'cc-email');

    function fieldEl(label, type, placeholder, id, extra) {
      const wrap = el('div', { class: 'field' });
      wrap.appendChild(el('label', { for: id, text: label }));
      const attrs = { type, id, placeholder, autocomplete: 'off', ...(extra || {}) };
      wrap.appendChild(el('input', attrs));
      return wrap;
    }

    // Live card formatting
    numberInput.addEventListener('input', () => {
      let digits = numberInput.value.replace(/\D/g, '').slice(0, 19);
      const amex = digits.startsWith('34') || digits.startsWith('37');
      if (amex) {
        numberInput.value = [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ').trim();
      } else {
        numberInput.value = digits.replace(/(.{4})/g, '$1 ').trim();
      }
      const d = digits;
      brandIco.textContent = /^4/.test(d) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(d) ? 'MC' : /^3[47]/.test(d) ? 'AMEX' : /^(6011|65)/.test(d) ? 'DISC' : '💳';
      clearErr(numberField);
    });

    const expInput = expField.querySelector('input');
    expInput.addEventListener('input', () => {
      let v = expInput.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
      expInput.value = v;
      clearErr(expField);
    });
    const cvcInput = cvcField.querySelector('input');
    cvcInput.addEventListener('input', () => {
      cvcInput.value = cvcInput.value.replace(/\D/g, '').slice(0, 4);
      clearErr(cvcField);
    });

    function setErr(f, msg) {
      clearErr(f);
      f.querySelector('input') && f.querySelector('input').classList.add('invalid');
      f.appendChild(el('div', { class: 'f-err', text: msg }));
    }
    function clearErr(f) {
      const input = f.querySelector('input');
      if (input) input.classList.remove('invalid');
      $$(':scope .f-err', f).forEach((e) => e.remove());
    }

    const testHint = el('p', { class: 'f-hint', style: 'margin-bottom:14px' }, 'Demo gateway — use test card ');
    testHint.appendChild(el('a', {
      href: '#', text: '4242 4242 4242 4242', onclick: (e) => {
        e.preventDefault();
        nameField.querySelector('input').value = 'Ada Lovelace';
        numberInput.value = '4242 4242 4242 4242';
        expInput.value = '12/30';
        cvcInput.value = '123';
        brandIco.textContent = 'VISA';
      },
    }));
    testHint.appendChild(document.createTextNode(' · declines with 4000 0000 0000 0002 · any future expiry'));

    const payBtn = el('button', { class: 'btn btn-primary btn-lg', style: 'width:100%', type: 'submit' }, '🔒  Pay securely');
    const payOverlay = el('div', { class: 'pay-overlay', style: 'display:none' },
      el('span', { class: 'spinner' }),
      el('div', { class: 'po-text', text: 'Authorizing payment…' }),
      el('div', { class: 'po-sub', text: 'Encrypting · validating · confirming' })
    );

    const form = el('form', {
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        if (payBtn.disabled) return;
        $$('.f-err', pay).forEach((x) => x.remove());
        $$('.invalid', pay).forEach((x) => x.classList.remove('invalid'));

        // Client-side pre-flight (server re-validates everything)
        let ok = true;
        const name = nameField.querySelector('input').value.trim();
        const number = numberInput.value.replace(/\s/g, '');
        const exp = expInput.value;
        const cvc = cvcInput.value;
        const email = emailField.querySelector('input').value.trim();

        if (name.length < 2) { setErr(nameField, 'Enter the name on your card.'); ok = false; }
        if (!/^\d{13,19}$/.test(number)) { setErr(numberField, 'Card number looks incomplete.'); ok = false; }
        else if (!luhn(number)) { setErr(numberField, 'That card number is invalid (failed Luhn check).'); ok = false; }
        const m = exp.match(/^(0?[1-9]|1[0-2])\/(\d{2})$/);
        if (!m) { setErr(expField, 'Use MM/YY.'); ok = false; }
        else if (new Date(2000 + Number(m[2]), Number(m[1]), 1) <= new Date()) { setErr(expField, 'That card has expired.'); ok = false; }
        const amexCard = /^3[47]/.test(number);
        if (!new RegExp(`^\\d{${amexCard ? 4 : 3},4}$`).test(cvc)) { setErr(cvcField, `${amexCard ? 4 : 3} digits.`); ok = false; }
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr(emailField, 'That email looks off.'); ok = false; }
        if (!ok) return;

        payBtn.disabled = true;
        payOverlay.style.display = 'flex';

        try {
          const res = await CC.api('/api/checkout', {
            method: 'POST',
            body: {
              plan: plan.id,
              cycle,
              email: email || undefined,
              card: { number, exp, cvc, name },
            },
          });
          CC.setPlan({ id: plan.id, orderId: res.order.id, cycle, since: res.order.createdAt });
          window.dispatchEvent(new CustomEvent('cc:plan'));
          payOverlay.style.display = 'none';
          renderReceipt(res.order);
          confetti();
        } catch (err) {
          payOverlay.style.display = 'none';
          payBtn.disabled = false;
          const fieldErrors = err.data && err.data.errors;
          if (fieldErrors && fieldErrors.length) {
            fieldErrors.forEach((msg) => {
              if (/card number|luhn/i.test(msg)) setErr(numberField, msg);
              else if (/expir/i.test(msg)) setErr(expField, msg);
              else if (/security code|cvc/i.test(msg)) setErr(cvcField, msg);
              else if (/name/i.test(msg)) setErr(nameField, msg);
              else setErr(numberField, msg);
            });
            CC.toast(fieldErrors[0], 'err');
          } else {
            CC.toast(err.message, 'err');
          }
        }
      },
    },
      nameField, numberField, rowWrap, emailField, testHint, payBtn
    );
    pay.appendChild(form);
    pay.appendChild(payOverlay);
    pay.appendChild(el('div', { class: 'secure-strip' },
      el('span', { html: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>' }),
      el('span', { text: '256-bit TLS · server-side Luhn validation · PAN never stored' })
    ));

    function renderReceipt(order) {
      grid.innerHTML = '';
      const receipt = el('div', { class: 'panel receipt-card', style: 'grid-column:1/-1' },
        el('div', { class: 'success-anim', text: '✓' }),
        el('h2', { text: 'Payment successful' }),
        el('p', { class: 'panel-sub', text: `Core Codex ${order.planName} is active on this device. Happy building! 🚀` }),
        el('div', { class: 'receipt-rows' },
          rrow('Order ID', order.id),
          rrow('Plan', `Core Codex ${order.planName} (${order.cycle})`),
          rrow('Amount', money(order.amountCents)),
          rrow('Card', `${order.card.brand} •••• ${order.card.last4}`),
          rrow('Date', new Date(order.createdAt).toLocaleString()),
          rrow('Renews', new Date(order.renewsAt).toLocaleDateString())
        ),
        el('div', { style: 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap' },
          el('a', { class: 'btn btn-primary btn-lg', href: '#/agent', text: 'Start building →' }),
          el('a', { class: 'btn btn-outline btn-lg', href: '#/pricing', text: 'Back to pricing' })
        )
      );
      function rrow(k, v) { return el('div', { class: 'receipt-row' }, el('span', { text: k }), el('b', { text: v })); }
      grid.appendChild(receipt);
    }

    grid.appendChild(summary);
    grid.appendChild(pay);
    shell.appendChild(grid);
    shell.appendChild(el('p', { style: 'text-align:center;margin-top:18px' },
      el('a', { href: '#/pricing', text: '← Back to pricing' })));
    view.appendChild(shell);
    renderSummary();
  }

  function luhn(digits) {
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (d < 0 || d > 9) return false;
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function confetti() {
    const colors = ['#7c5cff', '#22d3ee', '#34d399', '#fbbf24', '#f87171', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const c = el('div', { class: 'confetti' });
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (2 + Math.random() * 2.5) + 's';
      c.style.animationDelay = (Math.random() * 0.6) + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      if (i % 3 === 0) c.style.borderRadius = '50%';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5600);
    }
  }

  CC.Pricing = Pricing;
  CC.Checkout = Checkout;
})();
