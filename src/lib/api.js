export async function fetchPlans() {
  const r = await fetch("/api/plans");
  if (!r.ok) throw new Error("plans");
  return r.json();
}

export async function fetchModels() {
  const r = await fetch("/api/models");
  if (!r.ok) throw new Error("models");
  return r.json();
}

export async function checkout(payload) {
  const r = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.error || "Checkout failed");
  return data.order;
}

export async function generate({ prompt, model, effort, files, history, onEvent }) {
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model, effort, files, history }),
  });
  if (!r.ok || !r.body) throw new Error("Generate failed");

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let complete = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const chunks = buf.split("\n\n");
    buf = chunks.pop() || "";
    for (const chunk of chunks) {
      const evLine = chunk.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = evLine ? evLine.slice(6).trim() : "message";
      let data = {};
      try {
        data = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }
      onEvent?.(event, data);
      if (event === "complete") complete = data;
    }
  }
  return complete;
}
