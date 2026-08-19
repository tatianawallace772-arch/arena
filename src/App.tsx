import { useEffect, useMemo, useRef, useState } from 'react'
import { emptyMetrics, listModels, runChat, runMockChat, type ModelInfo, type RunMetrics } from './api'
import { DEFAULT_MODELS, PRESET_PROMPTS } from './presets'

type Results = Record<string, RunMetrics>

const LS_KEY = 'ai302.apiKey'
const LS_SEL = 'ai302.selected'

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(LS_KEY) ?? '')
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsError, setModelsError] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_SEL) ?? 'null') ?? DEFAULT_MODELS.slice(0, 3)
    } catch {
      return DEFAULT_MODELS.slice(0, 3)
    }
  })
  const [customModel, setCustomModel] = useState('')

  const [system, setSystem] = useState(PRESET_PROMPTS[0].system)
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0].prompt)
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [stream, setStream] = useState(true)
  const [demo, setDemo] = useState(false)

  const [results, setResults] = useState<Results>({})
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => localStorage.setItem(LS_KEY, apiKey), [apiKey])
  useEffect(() => localStorage.setItem(LS_SEL, JSON.stringify(selected)), [selected])

  const catalog = useMemo(() => {
    const ids = new Set<string>([...models.map((m) => m.id), ...DEFAULT_MODELS, ...selected])
    return [...ids].sort((a, b) => a.localeCompare(b))
  }, [models, selected])

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return f ? catalog.filter((m) => m.toLowerCase().includes(f)) : catalog
  }, [catalog, filter])

  async function loadModels() {
    if (!apiKey.trim()) {
      setModelsError('Enter your 302.AI API key first.')
      return
    }
    setLoadingModels(true)
    setModelsError('')
    try {
      setModels(await listModels(apiKey.trim()))
    } catch (e: any) {
      setModelsError(e?.message ?? String(e))
    } finally {
      setLoadingModels(false)
    }
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  function addCustom() {
    const id = customModel.trim()
    if (!id) return
    setSelected((s) => (s.includes(id) ? s : [...s, id]))
    setCustomModel('')
  }

  function patch(model: string, p: Partial<RunMetrics>) {
    setResults((r) => ({ ...r, [model]: { ...(r[model] ?? emptyMetrics()), ...p } }))
  }

  async function runAll() {
    if (!apiKey.trim() && !demo) {
      setModelsError('Enter your 302.AI API key first.')
      return
    }
    if (!selected.length || !prompt.trim()) return

    const ctrl = new AbortController()
    abortRef.current = ctrl
    setRunning(true)
    setResults(Object.fromEntries(selected.map((m) => [m, emptyMetrics()])))

    await Promise.all(
      selected.map(async (model) => {
        try {
          if (demo) {
            await runMockChat({ model, prompt, signal: ctrl.signal, onUpdate: (p) => patch(model, p) })
            return
          }
          await runChat({
            apiKey: apiKey.trim(),
            model,
            system,
            prompt,
            temperature,
            maxTokens,
            stream,
            signal: ctrl.signal,
            onUpdate: (p) => patch(model, p),
          })
        } catch (e: any) {
          patch(model, {
            status: 'error',
            error: ctrl.signal.aborted ? 'Cancelled' : e?.message ?? String(e),
          })
        }
      })
    )

    setRunning(false)
    abortRef.current = null
  }

  function stopAll() {
    abortRef.current?.abort()
  }

  function exportJson() {
    const blob = new Blob(
      [JSON.stringify({ prompt, system, temperature, maxTokens, results }, null, 2)],
      { type: 'application/json' }
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `302ai-test-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const done = selected.filter((m) => results[m]?.status === 'done')
  const fastest = done.length
    ? done.reduce((a, b) => ((results[a]?.totalMs ?? 1e9) <= (results[b]?.totalMs ?? 1e9) ? a : b))
    : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">302</span>
          <div>
            <h1>AI Model Test Bench</h1>
            <p>Run one prompt across many 302.AI models and compare output, latency and tokens.</p>
          </div>
        </div>
        <div className="keyrow">
          <input
            type={showKey ? 'text' : 'password'}
            placeholder="302.AI API key (sk-...)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            spellCheck={false}
          />
          <button className="ghost" onClick={() => setShowKey((v) => !v)}>
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button className="ghost" onClick={loadModels} disabled={loadingModels}>
            {loadingModels ? 'Loading…' : 'Load models'}
          </button>
        </div>
      </header>

      {modelsError && <div className="banner error">{modelsError}</div>}
      {demo && (
        <div className="banner info">
          Demo mode is on — responses are simulated locally, nothing is sent to 302.AI.
        </div>
      )}

      <main className="layout">
        <aside className="panel">
          <h2>Models {selected.length > 0 && <span className="pill">{selected.length}</span>}</h2>
          <input
            className="filter"
            placeholder="Filter models…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="modellist">
            {visible.map((id) => (
              <label key={id} className={selected.includes(id) ? 'model on' : 'model'}>
                <input type="checkbox" checked={selected.includes(id)} onChange={() => toggle(id)} />
                <span>{id}</span>
              </label>
            ))}
            {!visible.length && <p className="muted">No models match.</p>}
          </div>
          <div className="addrow">
            <input
              placeholder="Add model id…"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            />
            <button className="ghost" onClick={addCustom}>
              Add
            </button>
          </div>

          <h2>Parameters</h2>
          <label className="field">
            Temperature <b>{temperature.toFixed(2)}</b>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </label>
          <label className="field">
            Max tokens
            <input
              type="number"
              min={0}
              step={128}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
            />
          </label>
          <label className="checkline">
            <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} />
            Stream responses
          </label>
          <label className="checkline">
            <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
            Demo mode (no API calls)
          </label>
        </aside>

        <section className="main">
          <div className="panel prompt">
            <div className="presets">
              {PRESET_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  className="chip"
                  onClick={() => {
                    setSystem(p.system)
                    setPrompt(p.prompt)
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="field">
              System prompt
              <textarea rows={2} value={system} onChange={(e) => setSystem(e.target.value)} />
            </label>
            <label className="field">
              User prompt
              <textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </label>
            <div className="actions">
              <button className="primary" onClick={runAll} disabled={running || !selected.length}>
                {running ? 'Running…' : `Run on ${selected.length} model${selected.length === 1 ? '' : 's'}`}
              </button>
              <button className="ghost" onClick={stopAll} disabled={!running}>
                Stop
              </button>
              <button className="ghost" onClick={exportJson} disabled={!Object.keys(results).length}>
                Export JSON
              </button>
            </div>
          </div>

          <div className="grid">
            {selected.map((model) => {
              const r = results[model] ?? emptyMetrics()
              const tps =
                r.completionTokens && r.totalMs ? (r.completionTokens / (r.totalMs / 1000)).toFixed(1) : null
              return (
                <article key={model} className={`card ${r.status}`}>
                  <header>
                    <h3 title={model}>{model}</h3>
                    <span className={`status ${r.status}`}>
                      {r.status === 'running' ? 'streaming' : r.status}
                    </span>
                  </header>
                  <div className="metrics">
                    <span>{r.totalMs ? `${(r.totalMs / 1000).toFixed(2)}s` : '—'}</span>
                    <span title="time to first token">
                      TTFT {r.firstTokenMs ? `${Math.round(r.firstTokenMs)}ms` : '—'}
                    </span>
                    <span title="prompt / completion tokens">
                      {r.promptTokens ?? '—'}↑ {r.completionTokens ?? '—'}↓
                    </span>
                    {tps && <span>{tps} tok/s</span>}
                    {fastest === model && <span className="best">fastest</span>}
                  </div>
                  {r.reasoning && (
                    <details className="reasoning">
                      <summary>Reasoning</summary>
                      <pre>{r.reasoning}</pre>
                    </details>
                  )}
                  {r.error ? (
                    <pre className="err">{r.error}</pre>
                  ) : (
                    <pre className="out">{r.text || (r.status === 'running' ? '▌' : '')}</pre>
                  )}
                  <footer>
                    <button
                      className="ghost sm"
                      onClick={() => navigator.clipboard.writeText(r.text)}
                      disabled={!r.text}
                    >
                      Copy
                    </button>
                    <span className="muted">{r.text.length} chars</span>
                  </footer>
                </article>
              )
            })}
            {!selected.length && <p className="muted">Select at least one model on the left.</p>}
          </div>
        </section>
      </main>
    </div>
  )
}
