export const PORT = Number(process.env.PORT || 8787);

export const ZAI_API_KEY =
  process.env.ZAI_API_KEY ||
  "3339c195f50a4e55b47f390b8e385f81.LilUlpgdKjkfoT5A";

export const ZAI_ENDPOINTS = [
  "https://api.z.ai/api/paas/v4/chat/completions",
  "https://api.z.ai/api/coding/paas/v4/chat/completions",
];

export const MODELS = [
  {
    id: "glm-5.3",
    label: "GLM-5.3",
    blurb: "Flagship coding & long-horizon agents",
    effort: ["low", "high", "max"],
    defaultEffort: "max",
  },
  {
    id: "glm-5-turbo",
    label: "GLM-5-Turbo",
    blurb: "Speed-optimized coding model",
    effort: ["low", "high"],
    defaultEffort: "high",
  },
  {
    id: "glm-4.7",
    label: "GLM-4.7",
    blurb: "Cost-efficient everyday coding",
    effort: ["low", "high"],
    defaultEffort: "high",
  },
];

export const PLANS = {
  lite: {
    id: "lite",
    name: "Lite",
    tagline: "Built for lightweight iteration on small repos",
    monthly: 18,
    yearlyMonthly: 12.6,
    creditsWeek: 10000,
    usageLabel: "10,000 credits / week",
    features: [
      "Rolling access to GLM-5.3, GLM-5-Turbo, and GLM-4.7",
      "Corex Code agent workspace with multi-file edits",
      "20+ agent tools: plan, write, review, preview",
      "Default data privacy — no login required",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "Built for day-to-day development on mid-sized repos",
    monthly: 80,
    yearlyMonthly: 56,
    creditsWeek: 60000,
    usageLabel: "6× Lite usage",
    popular: true,
    features: [
      "All Lite benefits",
      "Priority access to the latest flagship models",
      "Curated MCP-style tools: search, reader, review",
      "Faster generation speeds",
    ],
  },
  max: {
    id: "max",
    name: "Max",
    tagline: "Built for advanced users on mid-to-large repos",
    monthly: 168,
    yearlyMonthly: 117.6,
    creditsWeek: 140000,
    usageLabel: "14× Lite usage",
    features: [
      "All Pro benefits",
      "First access to new Corex Code features",
      "Dedicated resources during peak times",
      "1M-context long-horizon Goals",
    ],
  },
};
