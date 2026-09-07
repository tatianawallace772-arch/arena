# Magic Hour Playground

A dependency-free Magic Hour image and video generation studio. The UI keeps the API key on the Node server, supports image generation, text-to-video, image-to-video uploads, project polling, and a small local library.

## Run locally

```bash
cp .env.example .env
# Add your Magic Hour key to .env
npm start
```

Open [http://localhost:3000](http://localhost:3000).

`MAGIC_HOUR_API_KEY` is only read by `server.js` and is never sent to the browser. The app falls back to a clearly labeled demo mode when the key is not configured.

## API surface

- `POST /api/generate` — starts an image, text-to-video, or image-to-video project
- `GET /api/projects/:kind/:id` — proxies Magic Hour project status and downloads
- `GET /api/account` — loads the connected account credit balance
- `GET /api/config` — reports whether the server has a key without exposing it

The server uses the official Magic Hour REST API at `https://api.magichour.ai/v1`.
