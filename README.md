# Fish Audio Voice Lab

A local-first HTML playground for testing Fish Audio text-to-speech through a same-origin server proxy.

## Run it

Use Node.js to serve the page and proxy requests to Fish Audio:

```bash
FISH_API_KEY="your-key-here" node server.js
```

Then open `http://localhost:4173`.

For a quick local test, you can leave `FISH_API_KEY` unset and enter a key in the page. The server-side environment variable is preferred for production because the key never needs to be entered into the browser. If your network uses an upstream gateway, set `FISH_AUDIO_URL` to its Fish Audio TTS URL; it defaults to `https://api.fish.audio/v1/tts`.

## What it does

- Sends browser requests to the local `/api/tts` route.
- Forwards validated text-to-speech requests to Fish Audio on the server.
- Supports model, output format, reference voice ID, and speaking speed controls.
- Plays and downloads the generated audio in the page.
- Does not hardcode, persist, or log API keys.

Never commit an API key or paste one into source code. Revoke keys that have been exposed and create a replacement.
