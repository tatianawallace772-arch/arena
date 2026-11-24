# Dubuntu — dubuntu.org

**Ubuntu, remixed.** An unofficial community remix of Ubuntu LTS, with its own site at [dubuntu.org](https://dubuntu.org/).

> **Disclaimer:** Dubuntu is an unofficial community project. It is not affiliated with, endorsed by, or supported by Canonical Ltd. “Ubuntu” and the Ubuntu logo are registered trademarks of Canonical Ltd. This site is not an official Ubuntu site.

## What’s here

A fast, dependency-free static site modelled on the ubuntu.com layout — black header, hero, editions, desktop tour, server strip, releases table, community and FAQ — with Dubuntu branding and interactive tools.

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
python3 dev-server.py 8000
# open http://localhost:8000
```

`dev-server.py` reproduces Vercel's clean-URL behaviour, so `/download` serves
`download.html` just like production. There is no npm install and no build step:
edit HTML/CSS/JS and refresh.

## Deployment status

| Item | Value |
|------|-------|
| Vercel project | `dubuntu` (`prj_mHuGbWarPpqSG6eDU0nfwMwy29lM`, team `team_3t47LYzr7LJyUXTd99Tr7Lqq`) |
| Connected repo | `tatianawallace772-arch/arena`, production domain target `dubuntu.org` |
| Production build | framework preset `eleventy`, but the build command is only a copy — the site itself still has no build step |
| Build command | `mkdir -p dist && cp *.html robots.txt sitemap.xml dist/ && cp -r assets dist/` |
| Output directory | `dist` (git-ignored) |
| Install command | `echo no-install-needed` |
| Domains attached | `dubuntu.org` (serve) and `www.dubuntu.org` (308 → `dubuntu.org`) |

### DNS records still needed at the registrar

The domain is registered with **OVH** (nameservers `dns200.anycast.me` /
`ns200.anycast.me`) and currently points at `54.38.92.132`, so Vercel still
reports the domain as *misconfigured*. In the OVH DNS zone for `dubuntu.org`:

| Type | Name | Value |
|------|------|-------|
| `A` | `@` | `216.198.79.1` |
| `A` | `@` | `64.29.17.1` |
| `CNAME` | `www` | `d22fa11e1cacfad8.vercel-dns-017.com.` |

(The older single-record alternative still works: `A @ 76.76.21.21` and
`CNAME www cname.vercel-dns.com.`) Remove the existing `A` record for
`54.38.92.132`, then wait for propagation — Vercel issues the TLS certificate
automatically once the records resolve. Progress is visible at
Vercel → project `dubuntu` → Settings → Domains.

### Deploying new changes

This branch produces preview deployments on push. To publish a change to
production either ask for a deploy, or run `vercel --prod` with the project's
build settings above (or merge the branch into the repo's production branch).

## Interactive features

- Edition + mirror selector with live ISO metadata and SHA-256
- Checksum verifier (paste a hash, get ✓/✗)
- System-requirements checker (RAM / CPU / disk sliders)
- Desktop tabs, FAQ accordion, copy-to-clipboard code blocks
- Search overlay (Ctrl/⌘+K), mobile nav, scroll-reveal, release countdown
- Typing terminal animation on the homepage

## Licence

Site code and artwork: CC BY-SA 4.0 unless otherwise noted. Ubuntu® is a trademark of Canonical Ltd.
