# Dubuntu — dubuntu.org

**Ubuntu, remixed.** An unofficial community remix of Ubuntu LTS, with its own site at [dubuntu.org](https://dubuntu.org/).

> **Disclaimer:** Dubuntu is an unofficial community project. It is not affiliated with, endorsed by, or supported by Canonical Ltd. “Ubuntu” and the Ubuntu logo are registered trademarks of Canonical Ltd. This site is not an official Ubuntu site.

## What’s here

A fast, dependency-free static site (no build step) modelled on the ubuntu.com layout — black header, hero, editions, desktop tour, server strip, releases table, community and FAQ — with Dubuntu branding and interactive tools.

| Page | Purpose |
|------|---------|
| `index.html` | Home: hero, why Dubuntu, editions, desktop tabs, server strip, releases, FAQ |
| `download.html` | ISO downloads (Desktop / Server / ARM64 / WSL), mirrors, SHA-256 verifier, system-requirements checker |
| `desktop.html` | Desktop tour: GNOME 48, Dub Shell, apps, customisation |
| `server.html` | Server & cloud: LXD, Docker, cloud-init, ARM, WSL |
| `community.html` | Contribute, roadmap, support, disclaimer |
| `404.html` | Custom 404 |

Assets live in `assets/css/style.css`, `assets/js/app.js`, `assets/img/`.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

No npm, no build. Edit HTML/CSS/JS and refresh.

## Deploy to dubuntu.org (Vercel)

This repo is Vercel-ready (`vercel.json` included). Two paths:

### Option A — Vercel Git integration (recommended)

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** this repo. Framework preset: **Other** (no build command, output directory: `.`).
3. Add the custom domain **dubuntu.org** in Project → Settings → Domains.
4. At your DNS registrar, add the records Vercel shows (typically):
   - `A` `@` → `76.76.21.21`
   - `CNAME` `www` → `cname.vercel-dns.com`
5. Wait for DNS to propagate — Vercel issues the TLS certificate automatically.

### Option B — Vercel CLI

```bash
npm i -g vercel
vercel --prod
vercel domains add dubuntu.org
```

## Interactive features

- Edition + mirror selector with live ISO metadata and SHA-256
- Checksum verifier (paste a hash, get ✓/✗)
- System-requirements checker (RAM / CPU / disk sliders)
- Desktop tabs, FAQ accordion, copy-to-clipboard code blocks
- Search overlay (Ctrl/⌘+K), mobile nav, scroll-reveal, release countdown
- Typing terminal animation on the homepage

## Licence

Site code and artwork: CC BY-SA 4.0 unless otherwise noted. Ubuntu® is a trademark of Canonical Ltd.
