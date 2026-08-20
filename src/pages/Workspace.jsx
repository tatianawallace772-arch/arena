import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchModels, generate } from "../lib/api.js";
import {
  loadFiles,
  loadPlan,
  loadTasks,
  mergeFiles,
  saveFiles,
  saveTasks,
  STARTER_FILES,
} from "../lib/session.js";

function lineCount(text) {
  return String(text || "").split("\n").length;
}

function previewDoc(files) {
  const html = files.find((f) => f.path.endsWith(".html"));
  if (!html) return null;
  const css = files.filter((f) => f.path.endsWith(".css")).map((f) => f.content).join("\n");
  const js = files.filter((f) => f.path.endsWith(".js") && !f.path.endsWith(".jsx")).map((f) => f.content).join("\n");
  return html.content
    .replace(
      /<link[^>]+href=["']\.\/styles\.css["'][^>]*>/i,
      `<style>${css}</style>`
    )
    .replace(
      /<script[^>]+src=["']\.\/app\.js["'][^>]*><\/script>/i,
      `<script>${js}<\/script>`
    );
}

export default function Workspace() {
  const plan = loadPlan();
  const [files, setFiles] = useState(loadFiles);
  const [active, setActive] = useState(() => loadFiles()[0]?.path || "README.md");
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("glm-5.3");
  const [effort, setEffort] = useState("max");
  const [tab, setTab] = useState("code");
  const [prompt, setPrompt] = useState("Create an intelligent Gomoku game with heuristic AI and win detection.");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [thoughts, setThoughts] = useState([]);
  const [tools, setTools] = useState([]);
  const [stream, setStream] = useState("");
  const [log, setLog] = useState("corex@workspace % waiting for a goal\n");
  const [history, setHistory] = useState([]);
  const [tasks, setTasks] = useState(loadTasks);
  const msgsRef = useRef(null);

  useEffect(() => {
    fetchModels()
      .then((d) => setModels(d.models || []))
      .catch(() =>
        setModels([
          { id: "glm-5.3", label: "GLM-5.3" },
          { id: "glm-5-turbo", label: "GLM-5-Turbo" },
          { id: "glm-4.7", label: "GLM-4.7" },
        ])
      );
  }, []);

  useEffect(() => saveFiles(files), [files]);
  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight });
  }, [stream, thoughts, tools, history, busy]);

  const current = files.find((f) => f.path === active) || files[0];
  const htmlPreview = useMemo(() => previewDoc(files), [files]);

  function appendLog(line) {
    setLog((s) => s + line + "\n");
  }

  function onEdit(value) {
    setFiles((all) => all.map((f) => (f.path === current.path ? { ...f, content: value } : f)));
  }

  function resetWorkspace() {
    setFiles(STARTER_FILES);
    setActive(STARTER_FILES[0].path);
    setHistory([]);
    setThoughts([]);
    setTools([]);
    setStream("");
  }

  async function run(e) {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setThoughts([]);
    setTools([]);
    setStream("");
    setStatus("Generating");
    setHistory((h) => [...h, { role: "user", content: text }]);
    appendLog(`corex@workspace % generate --model ${model} --effort ${effort}`);
    appendLog(`# ${text}`);

    let acc = "";
    try {
      const complete = await generate({
        prompt: text,
        model,
        effort,
        files,
        history,
        onEvent: (event, data) => {
          if (event === "status") {
            setStatus(data.text || "Working");
            appendLog(`→ ${data.text}`);
          }
          if (event === "thought") setThoughts((t) => [...t, data.text]);
          if (event === "token") {
            acc += data.text || "";
            setStream(acc);
          }
          if (event === "file") {
            setTools((t) => [...t, data.path]);
            appendLog(`wrote ${data.path} (${data.bytes}b)`);
          }
        },
      });
      if (complete?.files?.length) {
        setFiles((cur) => {
          const next = mergeFiles(cur, complete.files);
          setActive(complete.files[0].path);
          return next;
        });
        setTab(complete.files.some((f) => f.path.endsWith(".html")) ? "preview" : "code");
      }
      const summary = complete?.summary || acc || "Done.";
      setHistory((h) => [...h, { role: "assistant", content: summary }]);
      setTasks((t) => [{ title: text.slice(0, 48), at: Date.now() }, ...t].slice(0, 8));
      setStatus("Ready");
      appendLog("ok · generation complete\n");
    } catch (err) {
      setStatus("Error");
      appendLog("error · " + (err.message || "generate failed"));
      setHistory((h) => [
        ...h,
        { role: "assistant", content: "Generation failed. Check the API connection and try again." },
      ]);
    } finally {
      setBusy(false);
      setPrompt("");
    }
  }

  return (
    <div className="workspace">
      <header className="ws-nav">
        <Link to="/" className="brand" style={{ gap: 8 }}>
          <img src="/brand/corex-mark.png" alt="" width={26} height={26} style={{ borderRadius: 7 }} />
          Corex Code
        </Link>
        <span style={{ color: "var(--faint)", fontSize: 12 }}>by Core AI</span>
        <span className="grow" />
        <select className="model" value={model} onChange={(e) => setModel(e.target.value)}>
          {(models.length ? models : [{ id: "glm-5.3", label: "GLM-5.3" }]).map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select className="model" value={effort} onChange={(e) => setEffort(e.target.value)}>
          <option value="low">Effort low</option>
          <option value="high">Effort high</option>
          <option value="max">Effort max</option>
        </select>
        <span className="kicker" style={{ padding: "4px 8px" }}>
          {plan ? `${plan.planName} plan` : "Guest · no login"}
        </span>
        <button className="ghost" onClick={resetWorkspace}>
          New
        </button>
        <Link className="btn btn-line" to="/plans" style={{ padding: "7px 10px", fontSize: 13 }}>
          Plans
        </Link>
      </header>

      <div className="ws-body">
        <aside className="pane">
          <div className="pane-h">Files</div>
          <div style={{ overflow: "auto", flex: 1 }}>
            {files.map((f) => (
              <button
                key={f.path}
                className={"file" + (f.path === current?.path ? " active" : "")}
                onClick={() => {
                  setActive(f.path);
                  setTab("code");
                }}
              >
                {f.path}
              </button>
            ))}
          </div>
          <div className="pane-h">Tasks</div>
          <div style={{ overflow: "auto", maxHeight: 180, padding: "6px 10px", color: "var(--muted)", fontSize: 12 }}>
            {tasks.length === 0 ? <div>No runs yet</div> : null}
            {tasks.map((t) => (
              <div key={t.at} style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                {t.title}
              </div>
            ))}
          </div>
        </aside>

        <section className="pane">
          <div className="tabs">
            <button className={"tab" + (tab === "code" ? " on" : "")} onClick={() => setTab("code")}>
              {current?.path || "editor"}
            </button>
            <button className={"tab" + (tab === "preview" ? " on" : "")} onClick={() => setTab("preview")}>
              Preview
            </button>
          </div>
          {busy ? <div className="loading-bar" /> : null}
          {tab === "preview" ? (
            htmlPreview ? (
              <iframe className="preview" title="preview" srcDoc={htmlPreview} />
            ) : (
              <div style={{ padding: 24, color: "var(--muted)" }}>
                No HTML file yet. Generate a web app to preview it here.
              </div>
            )
          ) : (
            <div className="editor-wrap">
              <div className="gutter">
                {Array.from({ length: Math.max(lineCount(current?.content), 1) }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                className="editor"
                spellCheck={false}
                value={current?.content || ""}
                onChange={(e) => onEdit(e.target.value)}
              />
            </div>
          )}
        </section>

        <aside className="agent">
          <div className="pane-h">
            Agent
            <span>{status}</span>
          </div>
          <div className="msgs" ref={msgsRef}>
            {history.length === 0 && !busy ? (
              <div className="msg bot">
                Describe a goal. Corex will plan, write files, and leave a preview when it can.
                GLM-5.3 is selected.
              </div>
            ) : null}
            {history.map((m, i) => (
              <div key={i} className={"msg " + (m.role === "user" ? "user" : "bot")}>
                {m.content}
              </div>
            ))}
            {busy ? (
              <div className="msg bot">
                <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--mint)" }}>
                  <span className="spin light" />
                  Generating with {model}…
                </div>
                <div className="thoughts" style={{ marginTop: 10 }}>
                  {thoughts.map((t, i) => (
                    <div key={i}>{t}</div>
                  ))}
                </div>
                {tools.map((t) => (
                  <div key={t} className="tool">
                    Wrote {t}
                  </div>
                ))}
                {stream ? (
                  <p style={{ whiteSpace: "pre-wrap", color: "var(--muted)" }}>{stream}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <form className="composer" onSubmit={run}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask Corex to build, fix, or explain…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(e);
              }}
            />
            <div className="composer-row">
              <span style={{ color: "var(--faint)", fontSize: 11 }}>⌘/Ctrl + Enter</span>
              <button className="btn btn-mint" disabled={busy || !prompt.trim()}>
                {busy ? (
                  <>
                    <span className="spin" /> Generating
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </form>
        </aside>
      </div>

      <div className="term">
        <b>terminal</b>
        {"\n"}
        {log}
      </div>
    </div>
  );
}
