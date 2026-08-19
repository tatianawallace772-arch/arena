# 302.AI Model Test Bench

A small web app for testing and comparing AI models served by [302.AI](https://302.ai)'s
OpenAI-compatible API. Enter your API key, pick several models, send one prompt, and watch
the answers stream in side by side with latency and token metrics.

## Features

- **Bring your own key** — the 302.AI API key is kept in `localStorage` in your browser only.
- **Model catalog** — pulls the live list from `GET /v1/models`, plus a filter box and a
  free-text field for any model id you want to try.
- **Side-by-side runs** — one prompt fanned out to every selected model in parallel.
- **Streaming** — SSE token streaming with a non-streaming fallback toggle.
- **Metrics** — total latency, time to first token (TTFT), prompt/completion tokens,
  tokens per second, and a "fastest" badge.
- **Prompt presets** — sanity check, reasoning, coding, JSON output, summarization, multilingual.
- **Reasoning models** — `reasoning_content` deltas are shown in a collapsible section.
- **Export** — download the whole run (settings + all outputs + metrics) as JSON.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Then paste your 302.AI API key in the top-right field and click **Load models**.

Other scripts:

```bash
npm run build    # type-check + production bundle into dist/
npm run preview  # serve the production bundle
```

## How requests are routed

The browser never calls `api.302.ai` directly. Vite proxies `/api/302/*` to
`https://api.302.ai/*` (see `vite.config.ts`), which avoids CORS problems and keeps the
frontend host-agnostic. If you deploy the built bundle, put an equivalent proxy rule
(nginx, a serverless function, etc.) in front of `/api/302`.

## Project layout

```
index.html
src/
  main.tsx      app entry
  App.tsx       UI: key, model picker, params, prompt, result grid
  api.ts        302.AI client: model list + streaming chat completions
  presets.ts    default model ids and prompt presets
  styles.css    dark theme
vite.config.ts  dev server + /api/302 proxy
```

## Notes

- The key is sent from your browser through the dev proxy to 302.AI. Don't use this app on a
  shared/untrusted machine, and don't commit your key.
- Model availability and pricing depend on your 302.AI account; a 4xx from a specific model
  is shown in that model's card without affecting the other runs.
