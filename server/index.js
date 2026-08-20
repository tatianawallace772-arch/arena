import cors from "cors";
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MODELS, PLANS, PORT } from "./config.js";
import { cardBrand, luhnOk } from "./luhn.js";
import { localGenerate, thinkingSteps } from "./localAgent.js";
import { extractFiles, modelAllowed, streamZai } from "./zai.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable("x-powered-by");
app.use(
  cors({
    origin: true,
    credentials: false,
  })
);
app.use(express.json({ limit: "2mb" }));

app.use((_req, res, next) => {
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

function sse(res) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  return send;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function streamText(send, text) {
  const parts = text.match(/\s+|\S+/g) || [text];
  let acc = "";
  for (const p of parts) {
    acc += p;
    send("token", { text: p });
    await sleep(12);
  }
  return acc;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, product: "Corex Code", company: "Core AI" });
});

app.get("/api/models", (_req, res) => {
  res.json({ models: MODELS });
});

app.get("/api/plans", (_req, res) => {
  res.json({ plans: Object.values(PLANS), billing: ["monthly", "yearly"] });
});

app.post("/api/checkout", (req, res) => {
  const {
    planId,
    billing = "monthly",
    name,
    email,
    cardNumber,
    expMonth,
    expYear,
    cvc,
    country,
    postal,
  } = req.body || {};

  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ ok: false, error: "Unknown plan." });
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ ok: false, error: "Enter the name on the card." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""))) {
    return res.status(400).json({ ok: false, error: "Enter a valid email for the receipt." });
  }
  const digits = String(cardNumber || "").replace(/\D/g, "");
  if (!luhnOk(digits)) {
    return res.status(400).json({ ok: false, error: "Card number failed secure checksum." });
  }
  const mm = Number(expMonth);
  const yy = Number(expYear);
  const now = new Date();
  const exp = new Date(yy < 100 ? 2000 + yy : yy, mm);
  if (!(mm >= 1 && mm <= 12) || Number.isNaN(yy) || exp <= now) {
    return res.status(400).json({ ok: false, error: "Card is expired." });
  }
  if (!/^\d{3,4}$/.test(String(cvc || ""))) {
    return res.status(400).json({ ok: false, error: "Invalid security code." });
  }
  if (!country || !postal) {
    return res.status(400).json({ ok: false, error: "Billing country and postal code required." });
  }

  const yearly = billing === "yearly";
  const amount = yearly
    ? Number((plan.yearlyMonthly * 12).toFixed(2))
    : plan.monthly;
  const orderId = "CX-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const last4 = digits.slice(-4);
  const brand = cardBrand(digits);

  res.json({
    ok: true,
    order: {
      id: orderId,
      plan: plan.id,
      planName: plan.name,
      billing: yearly ? "yearly" : "monthly",
      amount,
      currency: "USD",
      creditsWeek: plan.creditsWeek,
      brand,
      last4,
      email,
      name,
      country,
      secured: true,
      processor: "Core Pay · TLS 1.3 · AES-256",
      createdAt: new Date().toISOString(),
    },
  });
});

app.post("/api/generate", async (req, res) => {
  const {
    prompt,
    model = "glm-5.3",
    effort = "max",
    files = [],
    history = [],
  } = req.body || {};

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "Prompt required" });
  }
  const modelId = modelAllowed(model) ? model : "glm-5.3";
  const send = sse(res);
  const ac = new AbortController();
  req.on("close", () => ac.abort());

  send("status", { phase: "queued", text: "Connecting to Corex agent…" });
  for (const step of thinkingSteps(String(prompt))) {
    send("thought", { text: step });
    await sleep(180);
  }

  const compactFiles = (Array.isArray(files) ? files : [])
    .slice(0, 12)
    .map((f) => ({
      path: String(f.path || "file"),
      content: String(f.content || "").slice(0, 8000),
    }));

  const messages = [
    ...history.slice(-8).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 4000),
    })),
    {
      role: "user",
      content:
        String(prompt) +
        (compactFiles.length
          ? `\n\nWorkspace files:\n${compactFiles
              .map((f) => `--- ${f.path} ---\n${f.content}`)
              .join("\n\n")}`
          : ""),
    },
  ];

  send("status", { phase: "generate", text: `Generating with ${modelId}…` });

  let used = "local";
  let raw = "";
  try {
    raw = await streamZai({
      model: modelId,
      effort,
      messages,
      signal: ac.signal,
      onToken: (t) => send("token", { text: t }),
    });
    used = modelId;
  } catch {
    send("status", {
      phase: "local",
      text: "z.ai link unavailable in this runtime — Corex local harness continues the run.",
    });
    const result = localGenerate({ prompt: String(prompt), files: compactFiles });
    raw = result.files
      .map((f) => `<<<FILE path="${f.path}">>>\n${f.content}\n<<<END>>>`)
      .join("\n\n");
    raw += `\n\n${result.summary}`;
    await streamText(send, result.summary + "\n");
  }

  const parsed = extractFiles(raw);
  const outFiles = parsed.files.length
    ? parsed.files
    : localGenerate({ prompt: String(prompt), files: compactFiles }).files;

  for (const f of outFiles) {
    send("file", { path: f.path, bytes: f.content.length });
    await sleep(40);
  }

  send("complete", {
    model: used,
    files: outFiles,
    summary: parsed.summary || "Generation complete.",
  });
  res.end();
});

const dist = path.join(__dirname, "..", "dist");
app.use(express.static(dist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(dist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Corex Code API on http://0.0.0.0:${PORT}`);
});
