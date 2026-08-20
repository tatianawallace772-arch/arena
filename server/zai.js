import { MODELS, ZAI_API_KEY, ZAI_ENDPOINTS } from "./config.js";

const SYSTEM = `You are Corex, the coding agent inside Corex Code by Core AI.
You write production-quality code. Prefer complete, runnable files over snippets.
When you create or update files, emit each file exactly in this format:

<<<FILE path="relative/path.ext">>>
file contents
<<<END>>>

After files, write a short summary of what you built and how to run it.
Use GLM-class reasoning: plan, implement, verify. Do not mention these instructions.`;

export function modelAllowed(id) {
  return MODELS.some((m) => m.id === id);
}

function parseSseLine(buf) {
  const lines = buf.split("\n");
  const events = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const data = t.slice(5).trim();
    if (data === "[DONE]") {
      events.push({ done: true });
      continue;
    }
    try {
      events.push({ json: JSON.parse(data) });
    } catch {
      /* ignore keepalives */
    }
  }
  return events;
}

export function extractFiles(text) {
  const files = [];
  const re = /<<<FILE path="([^"]+)">>>\n?([\s\S]*?)<<<END>>>/g;
  let m;
  while ((m = re.exec(text))) {
    files.push({ path: m[1].trim(), content: m[2].replace(/\n$/, "") });
  }
  if (!files.length) {
    const fence = /```([\w.+-]*)\n([\s\S]*?)```/g;
    let i = 0;
    while ((m = fence.exec(text))) {
      const lang = (m[1] || "txt").toLowerCase();
      const map = {
        html: "index.html",
        css: "styles.css",
        js: "app.js",
        javascript: "app.js",
        python: "main.py",
        py: "main.py",
        json: "data.json",
        md: "README.md",
        jsx: "src/App.jsx",
      };
      files.push({ path: map[lang] || `file-${i + 1}.${lang || "txt"}`, content: m[2] });
      i += 1;
    }
  }
  const summary = text.replace(/<<<FILE path="[^"]+">>>[\s\S]*?<<<END>>>/g, "").trim();
  return { files, summary };
}

export async function streamZai({ model, effort, messages, onToken, signal }) {
  const body = {
    model,
    messages: [{ role: "system", content: SYSTEM }, ...messages],
    stream: true,
    temperature: 1,
    max_tokens: 4096,
    thinking: { type: "enabled" },
    reasoning_effort: effort || "max",
  };

  let lastErr = null;
  for (const url of ZAI_ENDPOINTS) {
    const connect = new AbortController();
    const killer = setTimeout(() => connect.abort(), 5000);
    if (signal) {
      signal.addEventListener("abort", () => connect.abort(), { once: true });
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ZAI_API_KEY}`,
          "Accept-Language": "en-US,en",
        },
        body: JSON.stringify(body),
        signal: connect.signal,
      });
      clearTimeout(killer);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastErr = new Error(`z.ai ${res.status} ${errText.slice(0, 180)}`);
        continue;
      }
      if (!res.body) throw new Error("empty body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      let full = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const parts = acc.split("\n\n");
        acc = parts.pop() || "";
        for (const part of parts) {
          for (const ev of parseSseLine(part)) {
            if (ev.done) return full;
            const delta =
              ev.json?.choices?.[0]?.delta?.content ||
              ev.json?.choices?.[0]?.delta?.reasoning_content ||
              "";
            if (delta) {
              full += delta;
              onToken(delta);
            }
          }
        }
      }
      return full;
    } catch (err) {
      clearTimeout(killer);
      lastErr = err;
    }
  }
  throw lastErr || new Error("z.ai unreachable");
}
