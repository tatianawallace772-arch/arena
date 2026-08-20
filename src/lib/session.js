const PLAN_KEY = "corex.plan";
const FILES_KEY = "corex.files";
const TASKS_KEY = "corex.tasks";

export const FALLBACK_PLANS = [
  {
    id: "lite",
    name: "Lite",
    tagline: "Built for lightweight iteration on small repos",
    monthly: 18,
    yearlyMonthly: 12.6,
    usageLabel: "10,000 credits / week",
    features: [
      "Rolling access to GLM-5.3, GLM-5-Turbo, and GLM-4.7",
      "Corex Code agent workspace with multi-file edits",
      "20+ agent tools: plan, write, review, preview",
      "Default data privacy — no login required",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Built for day-to-day development on mid-sized repos",
    monthly: 80,
    yearlyMonthly: 56,
    usageLabel: "6× Lite usage",
    popular: true,
    features: [
      "All Lite benefits",
      "Priority access to the latest flagship models",
      "Curated MCP-style tools: search, reader, review",
      "Faster generation speeds",
    ],
  },
  {
    id: "max",
    name: "Max",
    tagline: "Built for advanced users on mid-to-large repos",
    monthly: 168,
    yearlyMonthly: 117.6,
    usageLabel: "14× Lite usage",
    features: [
      "All Pro benefits",
      "First access to new Corex Code features",
      "Dedicated resources during peak times",
      "1M-context long-horizon Goals",
    ],
  },
];

export const STARTER_FILES = [
  {
    path: "README.md",
    content: `# Welcome to Corex Code

This is your agent workspace. Describe a goal and Corex will plan, write files, and verify.

Try:
- Create a Gomoku game with heuristic AI
- Build a persistent todo app
- Scaffold an Express notes API
`,
  },
  {
    path: "goals/first-goal.md",
    content: `# First goal

Replace this with what you want shipped.

Corex Code uses GLM-5.3 as the default coding model.
`,
  },
];

export function loadPlan() {
  try {
    return JSON.parse(localStorage.getItem(PLAN_KEY) || "null");
  } catch {
    return null;
  }
}

export function savePlan(plan) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

export function loadFiles() {
  try {
    const raw = JSON.parse(localStorage.getItem(FILES_KEY) || "null");
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
    /* ignore */
  }
  return STARTER_FILES;
}

export function saveFiles(files) {
  localStorage.setItem(FILES_KEY, JSON.stringify(files));
}

export function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(TASKS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export function mergeFiles(current, incoming) {
  const map = new Map(current.map((f) => [f.path, f]));
  for (const f of incoming) map.set(f.path, f);
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function priceFor(plan, billing) {
  if (!plan) return 0;
  return billing === "yearly" ? plan.yearlyMonthly : plan.monthly;
}

export function dueNow(plan, billing) {
  if (!plan) return 0;
  return billing === "yearly"
    ? Number((plan.yearlyMonthly * 12).toFixed(2))
    : plan.monthly;
}
