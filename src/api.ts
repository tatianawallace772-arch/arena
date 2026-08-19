export const API_BASE = '/api/302/v1'

export type ModelInfo = { id: string; owned_by?: string }

export type RunMetrics = {
  status: 'idle' | 'running' | 'done' | 'error'
  text: string
  reasoning: string
  error?: string
  startedAt?: number
  firstTokenMs?: number
  totalMs?: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  chunks: number
}

export const emptyMetrics = (): RunMetrics => ({
  status: 'idle',
  text: '',
  reasoning: '',
  chunks: 0,
})

export async function listModels(apiKey: string): Promise<ModelInfo[]> {
  const res = await fetch(`${API_BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`${res.status} ${await safeText(res)}`)
  const json = await res.json()
  const data: any[] = json?.data ?? []
  return data
    .map((m) => ({ id: String(m.id), owned_by: m.owned_by }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

async function safeText(res: Response) {
  try {
    return (await res.text()).slice(0, 400)
  } catch {
    return ''
  }
}

/** Fake streaming run so the UI can be explored without an API key / network access. */
export async function runMockChat(p: {
  model: string
  prompt: string
  signal: AbortSignal
  onUpdate: (patch: Partial<RunMetrics>) => void
}): Promise<void> {
  const started = performance.now()
  p.onUpdate({ status: 'running', startedAt: Date.now(), text: '', reasoning: '', chunks: 0 })
  const words = `[demo mode] ${p.model} would answer here. Prompt received: "${p.prompt.slice(
    0,
    120
  )}". Connect a real 302.AI API key to get live completions with real latency and token counts.`.split(
    ' '
  )
  let text = ''
  let firstTokenMs: number | undefined
  const perWord = 25 + Math.random() * 60
  for (let i = 0; i < words.length; i++) {
    if (p.signal.aborted) throw new Error('Cancelled')
    await new Promise((r) => setTimeout(r, perWord))
    if (firstTokenMs === undefined) firstTokenMs = performance.now() - started
    text += (i ? ' ' : '') + words[i]
    p.onUpdate({ text, chunks: i + 1, firstTokenMs })
  }
  p.onUpdate({
    status: 'done',
    text,
    chunks: words.length,
    firstTokenMs,
    totalMs: performance.now() - started,
    promptTokens: Math.ceil(p.prompt.length / 4),
    completionTokens: words.length,
    totalTokens: Math.ceil(p.prompt.length / 4) + words.length,
  })
}

export type ChatParams = {
  apiKey: string
  model: string
  system: string
  prompt: string
  temperature: number
  maxTokens: number
  stream: boolean
  signal: AbortSignal
  onUpdate: (patch: Partial<RunMetrics>) => void
}

/** Runs one chat completion against 302.AI and reports streaming progress + timings. */
export async function runChat(p: ChatParams): Promise<void> {
  const started = performance.now()
  const messages: any[] = []
  if (p.system.trim()) messages.push({ role: 'system', content: p.system })
  messages.push({ role: 'user', content: p.prompt })

  const body: Record<string, unknown> = {
    model: p.model,
    messages,
    temperature: p.temperature,
    stream: p.stream,
  }
  if (p.maxTokens > 0) body.max_tokens = p.maxTokens
  if (p.stream) body.stream_options = { include_usage: true }

  p.onUpdate({ status: 'running', startedAt: Date.now(), text: '', reasoning: '', chunks: 0 })

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: p.signal,
  })

  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} — ${await safeText(res)}`)
  }

  if (!p.stream) {
    const json = await res.json()
    const msg = json?.choices?.[0]?.message ?? {}
    p.onUpdate({
      status: 'done',
      text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? ''),
      reasoning: msg.reasoning_content ?? '',
      firstTokenMs: performance.now() - started,
      totalMs: performance.now() - started,
      promptTokens: json?.usage?.prompt_tokens,
      completionTokens: json?.usage?.completion_tokens,
      totalTokens: json?.usage?.total_tokens,
      chunks: 1,
    })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let reasoning = ''
  let chunks = 0
  let firstTokenMs: number | undefined
  let usage: any

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let json: any
      try {
        json = JSON.parse(payload)
      } catch {
        continue
      }
      if (json.usage) usage = json.usage
      const delta = json?.choices?.[0]?.delta ?? {}
      const piece: string = delta.content ?? ''
      const think: string = delta.reasoning_content ?? delta.reasoning ?? ''
      if (piece || think) {
        chunks++
        if (firstTokenMs === undefined) firstTokenMs = performance.now() - started
        text += piece
        reasoning += think
        p.onUpdate({ text, reasoning, chunks, firstTokenMs })
      }
    }
  }

  p.onUpdate({
    status: 'done',
    text,
    reasoning,
    chunks,
    firstTokenMs,
    totalMs: performance.now() - started,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    totalTokens: usage?.total_tokens,
  })
}
