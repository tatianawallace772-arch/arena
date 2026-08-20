# Corex Code

**Corex Code** is Core AI’s agentic coding workspace — a Z Code–style harness for the latest [z.ai](https://z.ai) GLM models.

Open the workspace with no login. Describe a goal. Corex plans, writes files, shows loading while it generates, and previews HTML in place.

## Product

- **Workspace** — multi-file editor, agent chat, live preview, terminal log
- **Models** — GLM-5.3 (default), GLM-5-Turbo, GLM-4.7 via the z.ai OpenAI-compatible API
- **Plans** — Lite / Pro / Max, aligned with GLM Coding Plan pricing
- **Secure checkout** — TLS copy, Luhn checksum, never persists the full card
- **No login** — guest session in the browser

## Run

```bash
npm install
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:8787`

The z.ai key is configured on the server (`ZAI_API_KEY`). If the upstream link is blocked, Corex continues the run with the local coding harness so generate still completes.

## Checkout test card

`4242 4242 4242 4242` · any future expiry · any 3-digit CVC
