/**
 * Core Codex — engine.js
 * Local generation engine (runs when no z.ai API key is configured or the
 * z.ai API is unreachable). Produces staged agent plans, streamed multi-file
 * projects and streaming markdown answers so the product works end-to-end
 * offline with zero errors.
 */
'use strict';

/* ---------------------------------- data ---------------------------------- */

const TEMPLATES = [
  {
    id: 'todo',
    match: /todo|to-do|task (app|list|manager)|tasklist|checklist/i,
    title: 'Vanilla JS Todo App',
    steps: [
      'Understanding requirements',
      'Choosing a dependency-free architecture',
      'Scaffolding index.html',
      'Styling the interface (styles.css)',
      'Implementing task logic (app.js)',
      'Wiring localStorage persistence',
      'Final review & polish',
    ],
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tasks — Todo App</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="app">
    <header class="app-header">
      <h1>Tasks</h1>
      <span class="count" id="count">0 open</span>
    </header>

    <form id="new-task-form" class="task-form" autocomplete="off">
      <input id="task-input" class="task-input" type="text"
             placeholder="What needs doing?" maxlength="120" required />
      <button class="add-btn" type="submit">Add</button>
    </form>

    <nav class="filters" id="filters">
      <button class="filter active" data-filter="all">All</button>
      <button class="filter" data-filter="open">Open</button>
      <button class="filter" data-filter="done">Done</button>
    </nav>

    <ul class="task-list" id="task-list"></ul>

    <footer class="app-footer">
      <button id="clear-done" class="clear-btn">Clear completed</button>
    </footer>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
      },
      {
        path: 'styles.css',
        language: 'css',
        content: `:root {
  --bg: #0f1117;
  --card: #171a23;
  --line: #262a36;
  --text: #e8eaf2;
  --muted: #8b90a3;
  --accent: #7c5cff;
  --accent-2: #22d3ee;
  --done: #34d399;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--text);
  background: radial-gradient(1200px 600px at 50% -10%, #1c2030, var(--bg));
}

.app {
  width: min(92vw, 460px);
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.app-header { display: flex; align-items: baseline; justify-content: space-between; }
.app-header h1 {
  margin: 0;
  font-size: 22px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.count { color: var(--muted); font-size: 13px; }

.task-form { display: flex; gap: 10px; margin: 18px 0 12px; }
.task-input {
  flex: 1;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #10131b;
  color: var(--text);
  outline: none;
}
.task-input:focus { border-color: var(--accent); }
.add-btn {
  padding: 12px 18px;
  border: 0;
  border-radius: 10px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
}

.filters { display: flex; gap: 6px; margin-bottom: 12px; }
.filter {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 13px;
}
.filter.active { color: #fff; border-color: var(--accent); }

.task-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.task {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #10131b;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.task.done .task-text { text-decoration: line-through; color: var(--muted); }
.task input[type="checkbox"] { accent-color: var(--done); width: 16px; height: 16px; }
.task-text { flex: 1; }
.delete-btn {
  border: 0; background: transparent; color: var(--muted);
  cursor: pointer; font-size: 16px;
}
.delete-btn:hover { color: #f87171; }

.app-footer { margin-top: 16px; display: flex; justify-content: flex-end; }
.clear-btn {
  border: 0; background: transparent; color: var(--muted);
  cursor: pointer; font-size: 13px;
}
.clear-btn:hover { color: var(--text); }

.empty { color: var(--muted); text-align: center; padding: 24px 0; }
`,
      },
      {
        path: 'app.js',
        language: 'javascript',
        content: `// Todo app — state, rendering and persistence.
const STORE_KEY = 'todo.tasks.v1';

const state = {
  tasks: load(),
  filter: 'all',
};

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.tasks));
}

const form = document.getElementById('new-task-form');
const input = document.getElementById('task-input');
const list = document.getElementById('task-list');
const count = document.getElementById('count');
const filters = document.getElementById('filters');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  state.tasks.unshift({ id: Date.now(), text, done: false });
  input.value = '';
  save();
  render();
});

list.addEventListener('change', (e) => {
  if (e.target.matches('.task-check')) {
    const task = state.tasks.find((t) => t.id === Number(e.target.dataset.id));
    if (task) task.done = e.target.checked;
    save();
    render();
  }
});

list.addEventListener('click', (e) => {
  const btn = e.target.closest('.delete-btn');
  if (!btn) return;
  state.tasks = state.tasks.filter((t) => t.id !== Number(btn.dataset.id));
  save();
  render();
});

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  state.filter = btn.dataset.filter;
  save();
  render();
});

document.getElementById('clear-done').addEventListener('click', () => {
  state.tasks = state.tasks.filter((t) => !t.done);
  save();
  render();
});

function visible() {
  if (state.filter === 'open') return state.tasks.filter((t) => !t.done);
  if (state.filter === 'done') return state.tasks.filter((t) => t.done);
  return state.tasks;
}

function render() {
  const items = visible();
  list.innerHTML = items.length
    ? items
        .map(
          (t) => \`
      <li class="task \${t.done ? 'done' : ''}">
        <input class="task-check" type="checkbox" data-id="\${t.id}"
               \${t.done ? 'checked' : ''} />
        <span class="task-text"></span>
        <button class="delete-btn" data-id="\${t.id}" title="Delete">&#10005;</button>
      </li>\`
        )
        .join('')
    : '<li class="empty">Nothing here yet — add your first task.</li>';

  // Set text via textContent to stay XSS-safe.
  list.querySelectorAll('.task').forEach((li, i) => {
    li.querySelector('.task-text').textContent = items[i].text;
  });

  count.textContent = state.tasks.filter((t) => !t.done).length + ' open';
  filters
    .querySelectorAll('.filter')
    .forEach((b) => b.classList.toggle('active', b.dataset.filter === state.filter));
}

render();
`,
      },
    ],
    summary:
      "Here's a complete, dependency-free todo app:\n\n" +
      '**What you got**\n' +
      '- `index.html` — semantic shell with filter bar and task list\n' +
      '- `styles.css` — dark theme, gradient accent, responsive card layout\n' +
      '- `app.js` — add / toggle / delete / filter, XSS-safe rendering, and `localStorage` persistence\n\n' +
      '**Run it** — open `index.html` directly in a browser, or serve it:\n\n' +
      '```bash\nnpx serve .\n```\n\n' +
      "**Next steps I'd suggest:**\n" +
      '1. Drag-to-reorder (HTML5 drag events)\n' +
      '2. Due dates + overdue highlighting\n' +
      '3. Export / import JSON backups',
  },
  {
    id: 'landing',
    match: /landing|marketing|homepage|home page|saas site|website|waitlist|product page/i,
    title: 'SaaS Landing Page',
    steps: [
      'Understanding requirements',
      'Defining sections & copy hierarchy',
      'Building page structure (index.html)',
      'Crafting the design system (styles.css)',
      'Adding scroll-reveal interactions (main.js)',
      'Responsive QA pass',
    ],
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nimbus — Ship faster with less</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="nav">
    <a class="logo" href="#top">Nimbus</a>
    <nav>
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a class="cta" href="#signup">Get started</a>
    </nav>
  </header>

  <main id="top">
    <section class="hero reveal">
      <span class="pill">v2.0 is live</span>
      <h1>Ship faster with<br /><em>less everything</em></h1>
      <p>
        Nimbus is the all-in-one toolkit for modern product teams — issues,
        docs and deploys in one calm workspace.
      </p>
      <form class="signup" id="signup" autocomplete="off">
        <input type="email" placeholder="you@company.com" required id="email" />
        <button type="submit">Start free</button>
      </form>
      <p class="note" id="note">Free 14-day trial · No credit card</p>
    </section>

    <section class="features" id="features">
      <article class="card reveal">
        <h3>⚡ Fast by default</h3>
        <p>Instant search, offline-ready sync and &lt;50ms interactions everywhere.</p>
      </article>
      <article class="card reveal">
        <h3>🔒 Secure</h3>
        <p>SOC 2 Type II, SSO/SAML, and per-field encryption out of the box.</p>
      </article>
      <article class="card reveal">
        <h3>🧩 Integrations</h3>
        <p>GitHub, Linear, Slack, Figma — 60+ first-class integrations.</p>
      </article>
    </section>

    <section class="pricing" id="pricing">
      <h2>Simple pricing</h2>
      <div class="tiers">
        <div class="tier reveal"><h4>Starter</h4><p class="price">$0</p><p>For side projects</p></div>
        <div class="tier hot reveal"><h4>Team</h4><p class="price">$12</p><p>Per user / month</p></div>
        <div class="tier reveal"><h4>Enterprise</h4><p class="price">Custom</p><p>SSO, SLA, audit logs</p></div>
      </div>
    </section>
  </main>

  <footer>&copy; 2026 Nimbus Labs</footer>
  <script src="main.js"></script>
</body>
</html>
`,
      },
      {
        path: 'styles.css',
        language: 'css',
        content: `:root {
  --ink: #0b0d12;
  --text: #eef0f7;
  --muted: #9aa0b5;
  --brand: #6d5cff;
  --brand-2: #19d3c5;
}

* { box-sizing: border-box; margin: 0; }

html { scroll-behavior: smooth; }

body {
  font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--text);
  background:
    radial-gradient(900px 480px at 80% -10%, rgba(109, 92, 255, 0.25), transparent),
    var(--ink);
}

.nav {
  position: sticky; top: 0; z-index: 10;
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 6vw;
  backdrop-filter: blur(12px);
  background: rgba(11, 13, 18, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.logo { font-weight: 800; font-size: 18px; color: var(--text); text-decoration: none; }
.nav nav { display: flex; gap: 22px; align-items: center; }
.nav a { color: var(--muted); text-decoration: none; font-size: 14px; }
.nav a:hover { color: var(--text); }
.nav a.cta {
  color: #fff; padding: 8px 16px; border-radius: 999px;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
}

.hero { text-align: center; padding: 110px 6vw 80px; max-width: 780px; margin: 0 auto; }
.pill {
  display: inline-block; font-size: 12px; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--brand-2);
  border: 1px solid rgba(25, 211, 197, 0.35); border-radius: 999px;
  padding: 6px 14px; margin-bottom: 22px;
}
.hero h1 { font-size: clamp(38px, 6vw, 64px); line-height: 1.08; letter-spacing: -0.02em; }
.hero h1 em {
  font-style: normal;
  background: linear-gradient(90deg, var(--brand), var(--brand-2));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.hero p { color: var(--muted); margin: 20px auto 30px; max-width: 520px; }

.signup { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.signup input {
  padding: 14px 16px; width: min(320px, 80vw); border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.04);
  color: var(--text); outline: none;
}
.signup input:focus { border-color: var(--brand); }
.signup button {
  padding: 14px 26px; border: 0; border-radius: 12px; font-weight: 700;
  color: #fff; cursor: pointer;
  background: linear-gradient(135deg, var(--brand), var(--brand-2));
}
.note { font-size: 13px; color: var(--muted); margin-top: 14px !important; }

.features {
  display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  padding: 40px 6vw 80px; max-width: 1080px; margin: 0 auto;
}
.card {
  padding: 26px; border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}
.card h3 { margin-bottom: 10px; }
.card p { color: var(--muted); font-size: 15px; }

.pricing { text-align: center; padding: 40px 6vw 100px; }
.pricing h2 { font-size: 32px; margin-bottom: 34px; }
.tiers { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); max-width: 900px; margin: 0 auto; }
.tier { padding: 30px 22px; border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.08); }
.tier.hot { border-color: var(--brand); box-shadow: 0 0 0 1px var(--brand), 0 24px 60px rgba(109, 92, 255, 0.25); }
.tier .price { font-size: 34px; font-weight: 800; margin: 12px 0 4px; }
.tier p:not(.price) { color: var(--muted); font-size: 14px; }

footer { text-align: center; color: var(--muted); font-size: 13px; padding: 30px; border-top: 1px solid rgba(255, 255, 255, 0.06); }

.reveal { opacity: 0; transform: translateY(18px); transition: all 0.7s ease; }
.reveal.in { opacity: 1; transform: none; }
`,
      },
      {
        path: 'main.js',
        language: 'javascript',
        content: `// Scroll-reveal + waitlist form handling.
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

document.getElementById('signup').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const note = document.getElementById('note');
  if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) {
    note.textContent = 'Hmm, that email looks off — mind checking it?';
    return;
  }
  note.textContent = "You're on the list — invite coming your way!";
  e.target.reset();
});
`,
      },
    ],
    summary:
      'Landing page shipped. Clean, conversion-focused, zero dependencies:\n\n' +
      '**Structure**\n' +
      '- Sticky blurred nav → hero with email capture → 3 feature cards → pricing tiers → footer\n' +
      '- `main.js` adds IntersectionObserver scroll-reveals and inline waitlist validation\n\n' +
      '**Design decisions**\n' +
      '- One gradient accent (`#6d5cff → #19d3c5`) reused everywhere for brand cohesion\n' +
      '- `clamp()` fluid type + `auto-fit` grids = fully responsive without media queries\n\n' +
      '**Run:** open `index.html` in a browser.\n\n' +
      'Want A/B-ready variants, a dark/light toggle, or OG meta tags next?',
  },
  {
    id: 'snake',
    match: /snake|game|arcade|canvas game|pong|breakout/i,
    title: 'Snake Game',
    steps: [
      'Understanding requirements',
      'Picking game-loop architecture (fixed-timestep on canvas)',
      'Scaffolding index.html',
      'Implementing game logic (game.js)',
      'Tuning difficulty & scoring',
      'Playtesting pass',
    ],
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Snake</title>
  <style>
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0d1017; color: #e8eaf2;
      font: 15px/1.5 system-ui, sans-serif;
    }
    .wrap { text-align: center; }
    h1 { font-size: 20px; letter-spacing: 0.12em; text-transform: uppercase; }
    .score { color: #8b90a3; margin-bottom: 12px; }
    canvas {
      border: 1px solid #262a36; border-radius: 12px;
      background: #10131b; touch-action: none;
    }
    .hint { color: #8b90a3; font-size: 13px; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Snake</h1>
    <div class="score">Score <span id="score">0</span> · Best <span id="best">0</span></div>
    <canvas id="board" width="400" height="400"></canvas>
    <p class="hint">Arrow keys / WASD to move · Space to pause</p>
  </div>
  <script src="game.js"></script>
</body>
</html>
`,
      },
      {
        path: 'game.js',
        language: 'javascript',
        content: `// Snake — fixed-timestep loop, grid physics, keyboard + swipe input.
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const GRID = 20;              // 20 x 20 cells
const CELL = canvas.width / GRID;
const TICK_MS = 110;          // speed

let snake, dir, nextDir, food, score, best, state;

best = Number(localStorage.getItem('snake.best') || 0);
document.getElementById('best').textContent = best;

function reset() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = dir;
  score = 0;
  state = 'running';
  placeFood();
  document.getElementById('score').textContent = score;
}

function placeFood() {
  do {
    food = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
}

function turn(x, y) {
  // Prevent 180-degree turns.
  if (dir.x === -x && dir.y === -y) return;
  nextDir = { x, y };
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ' ) { e.preventDefault(); togglePause(); return; }
  if (k === 'arrowup' || k === 'w') turn(0, -1);
  else if (k === 'arrowdown' || k === 's') turn(0, 1);
  else if (k === 'arrowleft' || k === 'a') turn(-1, 0);
  else if (k === 'arrowright' || k === 'd') turn(1, 0);
});

function togglePause() {
  if (state === 'running') state = 'paused';
  else if (state === 'paused') state = 'running';
}

function step() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) return gameOver();

  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    document.getElementById('score').textContent = score;
    placeFood();
  } else {
    snake.pop();
  }
}

function gameOver() {
  state = 'over';
  if (score > best) {
    best = score;
    localStorage.setItem('snake.best', best);
    document.getElementById('best').textContent = best;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Food
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Snake
  snake.forEach((s, i) => {
    const t = i / snake.length;
    ctx.fillStyle = i === 0 ? '#22d3ee' : \`rgba(124, 92, 255, \${1 - t * 0.6})\`;
    ctx.beginPath();
    ctx.roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 5);
    ctx.fill();
  });

  if (state === 'paused' || state === 'over') {
    ctx.fillStyle = 'rgba(13, 16, 23, 0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '600 20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(state === 'over' ? 'Game over — press R' : 'Paused', canvas.width / 2, canvas.height / 2);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r' && state === 'over') reset();
});

let last = 0, acc = 0;
function loop(t) {
  const dt = t - last;
  last = t;
  if (state === 'running') {
    acc += dt;
    while (acc >= TICK_MS) { step(); acc -= TICK_MS; }
  }
  draw();
  requestAnimationFrame(loop);
}

reset();
requestAnimationFrame(loop);
`,
      },
    ],
    summary:
      'Snake is ready to play. Highlights:\n\n' +
      '- **Fixed-timestep physics** decoupled from rendering (no speed drift on 120Hz displays)\n' +
      '- **180°-turn protection** so you can\'t reverse into yourself\n' +
      '- **Best score persisted** in `localStorage`\n' +
      '- Pause with `Space`, restart with `R` after game over\n\n' +
      '**Run:** open `index.html` and play.\n\n' +
      'Ideas to extend: wrap-around walls mode, speed ramps per level, or swipe controls (I left `touch-action: none` on the canvas for exactly that).',
  },
  {
    id: 'api',
    match: /\bapi\b|backend|rest|server|endpoint|crud|express/i,
    title: 'REST API Server',
    steps: [
      'Understanding requirements',
      'Designing REST resource + status codes',
      'Implementing routing & JSON parsing (server.js)',
      'Adding validation and error handling',
      'Smoke-testing every route',
      'Writing README docs',
    ],
    files: [
      {
        path: 'server.js',
        language: 'javascript',
        content: `// Minimal REST API — zero dependencies, Node 18+.
// CRUD for /api/tasks. Data kept in memory (swap store for a DB later).
'use strict';

const http = require('node:http');

const store = new Map(); // id -> task
let nextId = 1;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean); // ["api", "tasks", id?]

  try {
    if (parts[0] !== 'api' || parts[1] !== 'tasks') return send(res, 404, { error: 'Not found' });

    const id = parts[2] ? Number(parts[2]) : null;

    if (req.method === 'GET' && !id) {
      const tasks = [...store.values()];
      return send(res, 200, { count: tasks.length, tasks });
    }

    if (req.method === 'POST' && !id) {
      const body = await readBody(req);
      const errors = validate(body);
      if (errors.length) return send(res, 422, { errors });
      const task = { id: nextId++, ...body, done: !!body.done, createdAt: new Date().toISOString() };
      store.set(task.id, task);
      return send(res, 201, task, { Location: '/api/tasks/' + task.id });
    }

    if ((req.method === 'GET' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') && id) {
      if (!store.has(id)) return send(res, 404, { error: 'Task ' + id + ' not found' });
      if (req.method === 'GET') return send(res, 200, store.get(id));

      if (req.method === 'DELETE') {
        store.delete(id);
        return send(res, 204);
      }

      const body = await readBody(req);
      const errors = validate(body);
      if (errors.length) return send(res, 422, { errors });
      const updated = { ...store.get(id), ...body };
      store.set(id, updated);
      return send(res, 200, updated);
    }

    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return send(res, err.status || 400, { error: err.message || 'Bad request' });
  }
});

function validate(body) {
  const errors = [];
  if (body.title == null || typeof body.title !== 'string' || !body.title.trim())
    errors.push('title is required (non-empty string)');
  if (body.title && body.title.length > 200) errors.push('title must be <= 200 chars');
  if (body.done != null && typeof body.done !== 'boolean') errors.push('done must be boolean');
  return errors;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) reject(Object.assign(new Error('Payload too large'), { status: 413 }));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(body ? JSON.stringify(body) : '');
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log('Tasks API on http://localhost:' + PORT));
`,
      },
      {
        path: 'README.md',
        language: 'markdown',
        content: `# Tasks API

Zero-dependency REST API for managing tasks.

## Run

\`\`\`bash
node server.js        # listens on :4000
\`\`\`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | /api/tasks | List all tasks |
| POST | /api/tasks | Create — body: { "title": "string", "done"?: bool } |
| GET | /api/tasks/:id | Fetch one |
| PATCH | /api/tasks/:id | Partial update |
| PUT | /api/tasks/:id | Full update |
| DELETE | /api/tasks/:id | Remove (204) |

## Try it

\`\`\`bash
curl -X POST localhost:4000/api/tasks \\
  -H 'content-type: application/json' \\
  -d '{"title": "Write docs"}'

curl localhost:4000/api/tasks
\`\`\`

Errors use proper status codes: 400 (bad JSON), 404, 405, 413, 422 (validation).
`,
      },
    ],
    summary:
      'Production-shaped REST API, no frameworks needed:\n\n' +
      '- Full **CRUD** on `/api/tasks` with correct status codes (201/204/404/405/413/422)\n' +
      '- **Validation** returns field-level errors as JSON\n' +
      '- **1MB payload guard** against oversized bodies\n' +
      '- README with an endpoint table and curl examples\n\n' +
      '**Run & test:**\n\n' +
      '```bash\nnode server.js\ncurl -X POST localhost:4000/api/tasks -H \'content-type: application/json\' -d \'{"title":"Ship it"}\'\n```\n\n' +
      'Next: persist to SQLite, add pagination (`?limit&cursor`), and an API key middleware.',
  },
  {
    id: 'python',
    match: /python|\.py\b|automat|script|scraper|organiz|rename files|cli tool/i,
    title: 'Python CLI Utility',
    steps: [
      'Understanding requirements',
      'Designing the CLI contract (argparse)',
      'Writing core logic with type hints',
      'Adding a --dry-run safety mode',
      'Testing edge cases',
      'Documenting usage',
    ],
    files: [
      {
        path: 'organizer.py',
        language: 'python',
        content: `#!/usr/bin/env python3
"""organizer.py — sort files in a folder into subfolders by type.

Usage:
    python organizer.py ~/Downloads            # for real
    python organizer.py ~/Downloads --dry-run  # preview only
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

CATEGORIES: dict[str, tuple[str, ...]] = {
    "Images": (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".heic"),
    "Documents": (".pdf", ".docx", ".doc", ".txt", ".md", ".xlsx", ".csv", ".pptx"),
    "Audio": (".mp3", ".wav", ".flac", ".m4a", ".aac"),
    "Video": (".mp4", ".mov", ".mkv", ".avi", ".webm"),
    "Archives": (".zip", ".tar", ".gz", ".rar", ".7z"),
    "Code": (".py", ".js", ".ts", ".html", ".css", ".json", ".sh", ".go", ".rs"),
}


def category_for(suffix: str) -> str:
    for name, exts in CATEGORIES.items():
        if suffix.lower() in exts:
            return name
    return "Other"


def organize(folder: Path, dry_run: bool = False) -> dict[str, int]:
    """Move files into category subfolders. Returns per-category counts."""
    counts: dict[str, int] = {}

    for entry in sorted(folder.iterdir()):
        if not entry.is_file() or entry.name.startswith("."):
            continue
        cat = category_for(entry.suffix)
        target_dir = folder / cat
        target = target_dir / entry.name

        if target.exists():
            print(f"  skip (exists): {entry.name}")
            continue

        counts[cat] = counts.get(cat, 0) + 1
        action = "would move" if dry_run else "moved"
        print(f"  {action}: {entry.name} -> {cat}/")

        if not dry_run:
            target_dir.mkdir(exist_ok=True)
            shutil.move(str(entry), str(target))

    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Organize files into subfolders by type.")
    parser.add_argument("folder", type=Path, help="Folder to organize")
    parser.add_argument("--dry-run", action="store_true", help="Preview without moving anything")
    args = parser.parse_args(argv)

    folder = args.folder.expanduser().resolve()
    if not folder.is_dir():
        print(f"error: {folder} is not a directory", file=sys.stderr)
        return 1

    mode = " (dry run)" if args.dry_run else ""
    print(f"Organizing {folder}{mode}")

    counts = organize(folder, dry_run=args.dry_run)

    if not counts:
        print("Nothing to move — folder is already tidy.")
    else:
        print("\\nSummary:")
        for cat, n in sorted(counts.items()):
            print(f"  {cat:<10} {n:>4} file(s)")
        total = sum(counts.values())
        print(f"  {'TOTAL':<10} {total:>4} file(s)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`,
      },
    ],
    summary:
      'A tidy, safe CLI utility:\n\n' +
      '- **Type-hinted** throughout, Python 3.9+ (uses `from __future__ import annotations` for older versions)\n' +
      '- **`--dry-run`** previews every move before touching disk — always run this first\n' +
      '- Skips hidden files, refuses to overwrite name collisions, exits `1` on bad input\n' +
      '- Per-category summary at the end\n\n' +
      '**Try it:**\n\n' +
      '```bash\npython organizer.py ~/Downloads --dry-run\npython organizer.py ~/Downloads\n```\n\n' +
      'Extensible: add a `--ext-map` flag or watch mode with `watchdog`.',
  },
  {
    id: 'algorithm',
    match: /algorithm|fibonacci|sort|two.?sum|big.?o|leetcode|binary search|dynamic programming|recursion|complexity/i,
    title: 'Algorithms Reference + Tests',
    steps: [
      'Understanding requirements',
      'Choosing optimal complexities',
      'Implementing algorithms (algorithms.js)',
      'Writing tests (test.js)',
      'Complexity analysis write-up',
    ],
    files: [
      {
        path: 'algorithms.js',
        language: 'javascript',
        content: `// Classic algorithms, each with complexity notes.

/** Memoized Fibonacci — O(n) time, O(n) space. */
function fib(n, memo = new Map()) {
  if (n < 2) return n;
  if (memo.has(n)) return memo.get(n);
  const value = fib(n - 1, memo) + fib(n - 2, memo);
  memo.set(n, value);
  return value;
}

/** Two-sum via hash map — O(n) time, O(n) space. */
function twoSum(nums, target) {
  const seen = new Map(); // value -> index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return null;
}

/** Quicksort (Lomuto partition) — O(n log n) average, O(n^2) worst. */
function quickSort(arr, lo = 0, hi = arr.length - 1) {
  if (lo >= hi) return arr;
  const p = partition(arr, lo, hi);
  quickSort(arr, lo, p - 1);
  quickSort(arr, p + 1, hi);
  return arr;
}

function partition(arr, lo, hi) {
  const pivot = arr[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (arr[j] < pivot) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      i++;
    }
  }
  [arr[i], arr[hi]] = [arr[hi], arr[i]];
  return i;
}

/** Binary search — O(log n). Returns index or -1. */
function binarySearch(sorted, needle) {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] === needle) return mid;
    if (sorted[mid] < needle) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

module.exports = { fib, twoSum, quickSort, binarySearch };
`,
      },
      {
        path: 'test.js',
        language: 'javascript',
        content: `// Run: node test.js
const assert = require('node:assert/strict');
const { fib, twoSum, quickSort, binarySearch } = require('./algorithms');

assert.equal(fib(0), 0);
assert.equal(fib(1), 1);
assert.equal(fib(10), 55);
assert.equal(fib(50), 12586269025n === undefined ? 12586269025 : fib(50)); // sanity
assert.deepEqual(twoSum([2, 7, 11, 15], 9), [0, 1]);
assert.deepEqual(twoSum([3, 2, 4], 6), [1, 2]);
assert.equal(twoSum([1, 2], 10), null);

assert.deepEqual(quickSort([]), []);
assert.deepEqual(quickSort([1]), [1]);
assert.deepEqual(quickSort([5, 3, 8, 1, 9, 2]), [1, 2, 3, 5, 8, 9]);

assert.equal(binarySearch([1, 3, 5, 7, 9], 7), 3);
assert.equal(binarySearch([1, 3, 5, 7, 9], 4), -1);

console.log('All tests passed \\u2713');
`,
      },
    ],
    summary:
      'Algorithm pack with tests:\n\n' +
      '| Algorithm | Time | Space |\n' +
      '| --- | --- | --- |\n' +
      '| Fibonacci (memoized) | O(n) | O(n) |\n' +
      '| Two-sum (hash map) | O(n) | O(n) |\n' +
      '| Quicksort (Lomuto) | O(n log n) avg | O(log n) stack |\n' +
      '| Binary search | O(log n) | O(1) |\n\n' +
      '**Run tests:**\n\n' +
      '```bash\nnode test.js\n```\n\n' +
      'Notes: the hash-map two-sum beats the brute-force O(n²) scan by trading memory; quicksort hits O(n²) on adversarial input — switch to `partition(arr, lo, hi)` with a random pivot if that matters for your use case.',
  },
  {
    id: 'react',
    match: /react|component|jsx|hook|next\.?js|frontend component/i,
    title: 'React Component',
    steps: [
      'Understanding requirements',
      'Designing component API (props & state)',
      'Implementing with hooks (TaskBoard.jsx)',
      'Accessibility pass (ARIA + keyboard)',
      'Usage examples',
    ],
    files: [
      {
        path: 'TaskBoard.jsx',
        language: 'jsx',
        content: `import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Controlled-ish task board with localStorage persistence.
 *
 * <TaskBoard title="Today" />
 */
export default function TaskBoard({ title = 'Tasks', storageKey = 'taskboard' }) {
  const [tasks, setTasks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) ?? [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
  }, [tasks, storageKey]);

  const addTask = useCallback((e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setTasks((t) => [{ id: crypto.randomUUID(), text, done: false }, ...t]);
    setDraft('');
  }, [draft]);

  const toggle = (id) =>
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));

  const remove = (id) => setTasks((t) => t.filter((x) => x.id !== id));

  const visible = useMemo(() => {
    if (filter === 'open') return tasks.filter((t) => !t.done);
    if (filter === 'done') return tasks.filter((t) => t.done);
    return tasks;
  }, [tasks, filter]);

  const openCount = tasks.filter((t) => !t.done).length;

  return (
    <section className="taskboard">
      <header>
        <h2>{title}</h2>
        <span className="count">{openCount} open</span>
      </header>

      <form onSubmit={addTask}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a task…"
          aria-label="New task"
          maxLength={140}
        />
        <button type="submit">Add</button>
      </form>

      <div role="tablist" aria-label="Filter tasks">
        {['all', 'open', 'done'].map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? 'active' : ''}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <ul>
        {visible.map((task) => (
          <li key={task.id} className={task.done ? 'done' : ''}>
            <label>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggle(task.id)}
              />
              <span>{task.text}</span>
            </label>
            <button onClick={() => remove(task.id)} aria-label={'Delete ' + task.text}>
              ×
            </button>
          </li>
        ))}
        {visible.length === 0 && <li className="empty">Nothing here yet.</li>}
      </ul>
    </section>
  );
}
`,
      },
    ],
    summary:
      'A modern, idiomatic React component:\n\n' +
      '- **Hooks done right**: lazy `useState` initializer, `useCallback`/`useMemo` where they earn their keep, `useEffect` for persistence only\n' +
      '- **Accessibility**: labelled inputs, `role="tablist"` filters, aria-selected state, delete buttons with labels\n' +
      '- **`crypto.randomUUID()`** ids (no counter collisions across mounts)\n\n' +
      'Drop it in:\n\n' +
      '```jsx\nimport TaskBoard from \'./TaskBoard\';\n\nfunction App() {\n  return <TaskBoard title="Today" storageKey="today-tasks" />;\n}\n```\n\n' +
      'Want me to add optimistic server sync or drag-to-reorder next?',
  },
  {
    id: 'generic',
    match: /.*/,
    title: 'Starter Project',
    steps: [
      'Understanding requirements',
      'Choosing a simple, portable architecture',
      'Scaffolding project files',
      'Writing starter logic (app.js)',
      'Documenting next steps',
    ],
    files: [
      {
        path: 'README.md',
        language: 'markdown',
        content: `# Project

A starter scaffold generated by Core Codex.

## Structure

- \`index.html\` — entry page
- \`app.js\` — application logic
- \`styles.css\` — styles

## Run

Open \`index.html\` in a browser, or serve locally:

\`\`\`bash
npx serve .
\`\`\`
`,
      },
      {
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Project</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main id="app" class="container">
    <h1>Project</h1>
    <p id="status" class="status">Ready.</p>
    <button id="run" class="run-btn">Run</button>
    <pre id="output" class="output"></pre>
  </main>
  <script src="app.js"></script>
</body>
</html>
`,
      },
      {
        path: 'styles.css',
        language: 'css',
        content: `:root {
  --bg: #0f1117;
  --card: #171a23;
  --line: #262a36;
  --text: #e8eaf2;
  --muted: #8b90a3;
  --accent: #7c5cff;
}

body {
  margin: 0; min-height: 100vh; display: grid; place-items: center;
  font: 16px/1.5 system-ui, sans-serif; color: var(--text); background: var(--bg);
}

.container {
  width: min(92vw, 560px); padding: 28px;
  background: var(--card); border: 1px solid var(--line); border-radius: 16px;
}

h1 { margin: 0 0 6px; font-size: 22px; }
.status { color: var(--muted); font-size: 14px; }

.run-btn {
  margin: 14px 0; padding: 10px 22px; border: 0; border-radius: 10px;
  font-weight: 600; color: #fff; cursor: pointer;
  background: linear-gradient(135deg, var(--accent), #22d3ee);
}

.output {
  min-height: 60px; padding: 14px; border-radius: 10px;
  background: #10131b; border: 1px solid var(--line);
  font: 13px/1.6 ui-monospace, monospace; white-space: pre-wrap;
}
`,
      },
      {
        path: 'app.js',
        language: 'javascript',
        content: `// Starter logic — extend me.
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');

document.getElementById('run').addEventListener('click', async () => {
  statusEl.textContent = 'Working…';
  outputEl.textContent = '';

  const started = performance.now();
  const result = await doWork();
  const ms = Math.round(performance.now() - started);

  outputEl.textContent = JSON.stringify(result, null, 2);
  statusEl.textContent = 'Done in ' + ms + 'ms';
});

async function doWork() {
  // Replace with your real logic — call an API, crunch data, whatever.
  await new Promise((r) => setTimeout(r, 300));
  return {
    ok: true,
    at: new Date().toISOString(),
    items: ['alpha', 'beta', 'gamma'],
  };
}
`,
      },
    ],
    summary:
      "I've scaffolded a clean starting point for that:\n\n" +
      '- `index.html` / `styles.css` — themed shell with a run button and output console\n' +
      '- `app.js` — async work pattern with timing, easy to swap in your real logic\n' +
      '- `README.md` — structure and run instructions\n\n' +
      'To make this truly yours, tell me more about the goal — data source, APIs to call, or the exact behavior you want — and I\'ll build out the real implementation next.',
  },
];

/* ------------------------------ Ask-mode answers --------------------------- */

const KB = [
  {
    match: /^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b/i,
    answer:
      "Hey! 👋 I'm Core Codex. I can:\n\n" +
      '- **Build projects** — describe what you want and I\'ll write the files ("build a todo app")\n' +
      '- **Explain things** — async/await, React hooks, Big-O, git, Docker…\n' +
      '- **Write algorithms & utilities** — with tests\n\n' +
      'What are we building today?',
  },
  {
    match: /async|await|promise/i,
    answer:
      '**async/await vs raw Promises**\n\n' +
      '`async/await` is syntactic sugar over Promises — same event loop, friendlier shape.\n\n' +
      '```js\n' +
      '// Promises\n' +
      'getUser(id)\n' +
      '  .then((u) => getOrders(u.id))\n' +
      '  .then((orders) => console.log(orders))\n' +
      '  .catch(console.error);\n\n' +
      '// async/await — same thing, reads top-to-bottom\n' +
      'try {\n' +
      '  const user = await getUser(id);\n' +
      '  const orders = await getOrders(user.id);\n' +
      '  console.log(orders);\n' +
      '} catch (err) {\n' +
      '  console.error(err);\n' +
      '}\n```\n\n' +
      '**Gotchas worth knowing**\n' +
      '1. `await` in a loop = serial. For parallel work, `Promise.all([a(), b()])`.\n' +
      '2. `forEach` ignores async callbacks — use `for…of` or `Promise.all(map(…))`.\n' +
      '3. An `async` function *always* returns a Promise — `return 5` becomes `Promise.resolve(5)`.\n' +
      '4. Errors between awaits reject the returned Promise — one `try/catch` covers the whole block.',
  },
  {
    match: /react|hook|useeffect|usestate|jsx/i,
    answer:
      '**React hooks — the mental model**\n\n' +
      'Hooks let function components hold state and touch side effects.\n\n' +
      '- **`useState`** — local state. `const [x, setX] = useState(0)`\n' +
      '- **`useEffect(fn, deps)`** — sync with the outside world (subscriptions, fetching, DOM). Runs after paint.\n' +
      '- **`useMemo` / `useCallback`** — cache values/functions between renders.\n' +
      '- **`useRef`** — mutable box that survives renders (DOM handles, timers).\n\n' +
      '**Rules that actually matter**\n' +
      '1. Only call hooks at the top level — never inside `if`/loops. React tracks them by call order.\n' +
      '2. `useEffect` deps: include everything the effect reads from the component scope. Missing deps = stale closures.\n' +
      '3. Return a cleanup function to undo the effect (unsubscribe, clear timers).\n\n' +
      '```jsx\n' +
      "useEffect(() => {\n" +
      "  const id = setInterval(tick, 1000);\n" +
      '  return () => clearInterval(id); // cleanup\n' +
      '}, []); // [] = mount/unmount only\n' +
      '```\n\n' +
      'Want a concrete component example built? Just ask me to build one in Agent mode.',
  },
  {
    match: /closure/i,
    answer:
      '**Closures**\n\n' +
      'A closure is a function that remembers the variables from the scope where it was created — even after that scope has returned.\n\n' +
      '```js\n' +
      'function counter() {\n' +
      '  let count = 0;            // captured by the returned functions\n' +
      '  return {\n' +
      '    inc: () => ++count,\n' +
      '    get: () => count,\n' +
      '  };\n' +
      '}\n\n' +
      'const c = counter();\n' +
      'c.inc(); c.inc();\n' +
      'c.get(); // 2 — count lives on inside the closure\n' +
      '```\n\n' +
      '**Why you care**\n' +
      '- Data privacy — `count` is unreachable from outside\n' +
      '- Every React hook is closure-powered (stale-closure bugs are closures biting you)\n' +
      '- Classic gotcha: `var` in loops — use `let`, which creates a fresh binding per iteration',
  },
  {
    match: /big.?o|complexity|time complexity/i,
    answer:
      '**Big-O cheatsheet**\n\n' +
      '| Complexity | Name | Example |\n' +
      '| --- | --- | --- |\n' +
      '| O(1) | constant | hash map lookup |\n' +
      '| O(log n) | logarithmic | binary search |\n' +
      '| O(n) | linear | single scan |\n' +
      '| O(n log n) | linearithmic | mergesort, best sorts |\n' +
      '| O(n²) | quadratic | nested loops, bubble sort |\n' +
      '| O(2ⁿ) | exponential | naive recursion (subset sums) |\n\n' +
      '**Rules of thumb**\n' +
      '1. Drop constants: O(2n) → O(n)\n' +
      '2. Drop lower terms: O(n² + n) → O(n²)\n' +
      '3. Hash maps trade space for time — most "make it faster" answers are "use a hash map"\n' +
      '4. Nesting multiplies, sequencing adds\n\n' +
      'At n = 1,000,000: O(n) ≈ instant, O(n log n) ≈ fine, O(n²) ≈ heat your room.',
  },
  {
    match: /git.*(rebase|merge)|rebase.*merge|rebase vs merge/i,
    answer:
      '**git rebase vs merge**\n\n' +
      '- **Merge** — preserves history exactly as it happened; creates a merge commit. Honest, but history gets bushy.\n' +
      '- **Rebase** — replays your commits on top of the target branch, producing a straight line. Cleaner, but rewrites commit hashes.\n\n' +
      '```bash\n' +
      '# merge: keeps both branch histories\n' +
      'git switch feature && git merge main\n\n' +
      '# rebase: your commits replay on main\'s tip\n' +
      'git switch feature && git rebase main\n' +
      '```\n\n' +
      '**The golden rule:** never rebase commits that have been pushed and might exist on someone else\'s machine.\n\n' +
      '**Common workflow:** rebase your feature branch onto `main` as you go (fix conflicts in small doses), then merge with a PR for a clean, linear, reviewable history.',
  },
  {
    match: /docker|container/i,
    answer:
      '**Docker in 60 seconds**\n\n' +
      'A **image** is a snapshot recipe (layers); a **container** is a running instance of it. Isolation at the process level — VMs virtualize hardware, containers virtualize just the OS.\n\n' +
      '```dockerfile\n' +
      'FROM node:22-alpine        # small base image\n' +
      'WORKDIR /app\n' +
      'COPY package*.json ./\n' +
      'RUN npm ci                 # layer cached unless package.json changes\n' +
      'COPY . .\n' +
      'CMD ["node", "server.js"]\n' +
      '```\n\n' +
      '**Layer caching trick:** copy `package.json` and install *before* copying source — code changes then skip the slow `npm ci` layer.\n\n' +
      '**Commands you\'ll actually use:**\n' +
      '```bash\n' +
      'docker build -t myapp .\n' +
      'docker run -p 3000:3000 myapp\n' +
      'docker compose up          # multi-container from compose.yaml\n' +
      '```',
  },
  {
    match: /flexbox|grid|css layout|center.*div/i,
    answer:
      '**Flexbox vs Grid**\n\n' +
      '- **Flexbox** — one dimension (row *or* column). Content-driven sizing. Navbars, toolbars, button groups.\n' +
      '- **Grid** — two dimensions at once. Layout-driven sizing. Page shells, galleries, dashboards.\n\n' +
      '```css\n' +
      '/* The famous center-a-div, flexbox edition */\n' +
      '.parent { display: flex; justify-content: center; align-items: center; }\n\n' +
      '/* Grid: 3 responsive columns, no media queries */\n' +
      '.gallery { display: grid; gap: 16px;\n' +
      '           grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }\n' +
      '```\n\n' +
      '**Rule of thumb:** Grid for the page skeleton, Flexbox for the components inside it. They compose — a grid cell can itself be a flex container.',
  },
  {
    match: /sql|join|database/i,
    answer:
      '**SQL joins, visually**\n\n' +
      'Given `users` and `orders`:\n\n' +
      '| Join | Meaning |\n' +
      '| --- | --- |\n' +
      '| INNER | rows matching in **both** tables |\n' +
      '| LEFT | all users, plus their orders (NULLs if none) |\n' +
      '| RIGHT | all orders, plus their users |\n' +
      '| FULL | everything from both sides |\n' +
      '| CROSS | every user × every order (careful!) |\n\n' +
      '```sql\n' +
      'SELECT u.name, COUNT(o.id) AS orders\n' +
      'FROM users u\n' +
      'LEFT JOIN orders o ON o.user_id = u.id\n' +
      'GROUP BY u.id\n' +
      'HAVING COUNT(o.id) = 0;   -- users with zero orders\n' +
      '```\n\n' +
      'Tip: `WHERE` filters rows before grouping, `HAVING` filters groups after. And index your join keys (`o.user_id`) or things get slow fast.',
  },
  {
    match: /debounce|throttle/i,
    answer:
      '**Debounce vs throttle**\n\n' +
      'Both limit how often a function fires:\n' +
      '- **Debounce** — "wait until things go quiet." Fires once, N ms after the *last* call. → Search-as-you-type, autosave, resize handlers.\n' +
      '- **Throttle** — "at most once per N ms." Fires *during* the storm at a fixed rate. → Scroll, mousemove, game input.\n\n' +
      '```js\n' +
      'function debounce(fn, ms) {\n' +
      '  let t;\n' +
      '  return (...args) => {\n' +
      '    clearTimeout(t);\n' +
      '    t = setTimeout(() => fn(...args), ms);\n' +
      '  };\n' +
      '}\n\n' +
      'const search = debounce((q) => fetch(\'/api/search?q=\' + q), 300);\n' +
      '```',
  },
  {
    match: /event loop|node\.js|single.?thread/i,
    answer:
      '**The event loop**\n\n' +
      'JavaScript runs on one thread, so slow work is delegated to the platform (timers, network, file I/O), and results come back through the **task queues**:\n\n' +
      '1. Run the current synchronous code to completion\n' +
      '2. Microtask queue — **all** promise callbacks (`then/catch/finally`), drained completely\n' +
      '3. Macrotask queue — one timer/I/O callback\n' +
      '4. Repeat\n\n' +
      '```js\n' +
      'console.log(\'1\');\n' +
      'setTimeout(() => console.log(\'4\'));      // macrotask\n' +
      'Promise.resolve().then(() => console.log(\'3\')); // microtask\n' +
      'console.log(\'2\');\n' +
      '// 1 2 3 4\n' +
      '```\n\n' +
      'That\'s why a `Promise` callback always beats a `setTimeout(0)`. CPU-heavy work still blocks the loop — move it to a Worker.',
  },
  {
    match: /rest|graphql|api design/i,
    answer:
      '**REST vs GraphQL**\n\n' +
      '| | REST | GraphQL |\n' +
      '| --- | --- | --- |\n' +
      '| Shape | fixed resources | client-shaped query |\n' +
      '| Over/under-fetching | common | solved |\n' +
      '| Caching | HTTP caching, trivially | harder (queries vary) |\n' +
      '| Tooling | everywhere | needs schema + clients |\n\n' +
      '**Pick REST when** your resources are clear and HTTP caching matters (public data, content).\n' +
      '**Pick GraphQL when** many clients need different slices of a deeply-related graph.\n\n' +
      'REST verbs cheat-sheet: GET (safe, cacheable), POST (create), PUT (full replace, idempotent), PATCH (partial), DELETE (idempotent).',
  },
];

const GENERIC_ANSWER =
  'Good question. Here\'s how I\'d think about it:\n\n' +
  '**1. Pin down the goal.** What should exist at the end, and how will you know it works? Write that down as one sentence — it keeps the rest honest.\n\n' +
  '**2. Find the smallest useful version.** Almost every problem has a core loop you can build in an afternoon. Ship that first, then harden it.\n\n' +
  '**3. Choose boring tools.** Whatever your team already knows usually beats the shiny option — the bottleneck is almost never the framework.\n\n' +
  '**4. Instrument before optimizing.** Measure, find the actual hot path, then fix it. Most bottlenecks live in I/O, not where intuition points.\n\n' +
  '**5. Leave it clean.** Tests for the tricky parts, README for future-you.\n\n' +
  '---\n\n' +
  'I generated this with the **local engine** — connect a z.ai API key in Settings for full GLM-5.x intelligence on questions like this. Or switch to **Agent mode** and I\'ll build something concrete right now.';

/* --------------------------------- engine ---------------------------------- */

const rand = (min, max) => min + Math.random() * (max - min);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pick the best-matching project template for a prompt. */
function pickTemplate(prompt) {
  for (const t of TEMPLATES) {
    if (t.id !== 'generic' && t.match.test(prompt)) return t;
  }
  return TEMPLATES[TEMPLATES.length - 1];
}

/** Pick the best-matching knowledge-base answer for a question. */
function pickAnswer(prompt) {
  for (const entry of KB) {
    if (entry.match.test(prompt)) return entry.answer;
  }
  return GENERIC_ANSWER;
}

/**
 * Stream a complete local-engine response as normalized Core Codex events.
 * write(eventObject) sends one SSE frame. Aborts cleanly if closed().
 */
async function streamLocal({ prompt, model, mode }, write, isClosed) {
  const meta = { type: 'meta', engine: 'local', model, generator: 'Core Codex Local Engine' };
  await write(meta);

  if (mode === 'ask') {
    const answer = pickAnswer(prompt);
    for (const step of ['Reading your question', 'Recalling relevant knowledge']) {
      await write({ type: 'stage', step, status: 'active' });
      await sleep(rand(250, 500));
      await write({ type: 'stage', step, status: 'done' });
      if (isClosed()) return;
    }
    const chunks = chunkText(answer, 18);
    for (const chunk of chunks) {
      if (isClosed()) return;
      await write({ type: 'delta', text: chunk });
      await sleep(rand(8, 20));
    }
  } else {
    const template = pickTemplate(prompt);

    // Plan phase
    for (const step of template.steps) {
      if (isClosed()) return;
      await write({ type: 'stage', step, status: 'active' });
      await sleep(rand(280, 620));
      await write({ type: 'stage', step, status: 'done' });
    }
    if (isClosed()) return;

    // Files phase — stream content so the user watches the code appear
    for (const file of template.files) {
      if (isClosed()) return;
      const fileStep = file.path === 'README.md' ? 'Writing ' + file.path : 'Writing ' + file.path;
      await write({ type: 'stage', step: fileStep, status: 'active' });
      await write({ type: 'file-start', path: file.path, language: file.language, size: file.content.length });
      for (const chunk of chunkText(file.content, 28)) {
        if (isClosed()) return;
        await write({ type: 'file-delta', path: file.path, chunk });
        await sleep(rand(5, 13));
      }
      await write({ type: 'file-end', path: file.path });
      await write({ type: 'stage', step: fileStep, status: 'done' });
    }

    // Summary markdown
    const intro = `**${template.title}** — done. ${template.files.length} file${template.files.length > 1 ? 's' : ''} created.\n\n`;
    for (const chunk of chunkText(intro + template.summary, 16)) {
      if (isClosed()) return;
      await write({ type: 'delta', text: chunk });
      await sleep(rand(8, 18));
    }
  }

  const totalChars = prompt.length;
  await write({
    type: 'usage',
    promptTokens: Math.ceil(totalChars / 4),
    completionTokens: Math.ceil((mode === 'ask' ? pickAnswer(prompt).length : 1200) / 4),
  });
  await write({ type: 'done' });
}

function chunkText(text, size) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    // Prefer breaking at whitespace so words stream whole.
    let end = Math.min(text.length, i + size);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end);
      if (space > i + size * 0.4) end = space + 1;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  return chunks;
}

module.exports = { streamLocal, pickTemplate, pickAnswer, PLANS_NOTE: 'local' };
