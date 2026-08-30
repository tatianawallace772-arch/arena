# Fish Audio Voice Lab

A single-file HTML playground for testing Fish Audio text-to-speech from a browser.

## Run it

Serve the repository with any static web server, then open the page in a browser:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Open `http://localhost:4173` and enter your Fish Audio API key in the password field. The page does not hardcode, persist, or log the key; it is kept in memory for the current tab and sent directly to Fish Audio when you generate audio.

## Notes

- Choose a model, output format, optional reference voice ID, and speaking speed.
- Generated audio can be played in the page or downloaded locally.
- Never commit an API key or paste one into source code. Revoke keys that have been exposed and create a replacement.
