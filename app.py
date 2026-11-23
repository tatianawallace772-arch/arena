"""SpotAPIfy — a Spotify-style web app powered by the `spotapi` package.

Run:
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
    .venv/bin/python app.py

Environment:
    SPOTAPI_MODE=auto|live|demo   (default: auto — live Spotify via spotapi,
                                   falling back to the bundled demo catalog)
    SPOTIFY_COOKIES=...           (optional Spotify cookie header for spotapi)
    PORT=5000                     (port to bind)
"""

from __future__ import annotations

import os
import threading
from urllib.parse import unquote

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

import audio_synth
import demo_catalog as dc
from covers import cover_svg
from spotify_service import ServiceError, get_service

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)

service = get_service()


@app.after_request
def add_headers(resp):
    if request.path.startswith("/api/covers/") or request.path.startswith("/api/preview/"):
        resp.headers["Cache-Control"] = "public, max-age=86400"
    elif request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


@app.get("/")
def index():
    return send_from_directory(os.path.join(BASE_DIR, "static"), "index.html")


@app.get("/api/status")
def status():
    return jsonify(service.status())


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/home")
def home():
    try:
        return jsonify(service.home())
    except ServiceError as exc:
        return jsonify({"error": str(exc)}), 502


@app.get("/api/library/playlists")
def library_playlists():
    try:
        return jsonify({"items": service.library_playlists()})
    except ServiceError as exc:
        return jsonify({"error": str(exc)}), 502


@app.get("/api/search")
def search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"tracks": [], "albums": [], "artists": [], "playlists": [], "top_result": None})
    try:
        limit = max(1, min(20, int(request.args.get("limit", "10"))))
    except ValueError:
        limit = 10
    try:
        return jsonify(service.search(query, limit))
    except ServiceError as exc:
        return jsonify({"error": str(exc)}), 502


@app.get("/api/album/<album_id>")
def album(album_id):
    try:
        data = service.album(album_id)
    except ServiceError as exc:
        return jsonify({"error": str(exc)}), 502
    if not data:
        return jsonify({"error": "Album not found"}), 404
    return jsonify(data)


@app.get("/api/artist/<artist_id>")
def artist(artist_id):
    try:
        data = service.artist(artist_id)
    except ServiceError as exc:
        return jsonify({"error": str(exc)}), 502
    if not data:
        return jsonify({"error": "Artist not found"}), 404
    return jsonify(data)


@app.get("/api/playlist/<playlist_id>")
def playlist(playlist_id):
    try:
        data = service.playlist(playlist_id)
    except ServiceError as exc:
        return jsonify({"error": str(exc)}), 502
    if not data:
        return jsonify({"error": "Playlist not found"}), 404
    return jsonify(data)


@app.get("/api/track/<track_id>")
def track(track_id):
    try:
        data = service.track(track_id)
    except ServiceError as exc:
        return jsonify({"error": str(exc)}), 502
    if not data:
        return jsonify({"error": "Track not found"}), 404
    return jsonify(data)


@app.get("/api/covers/<cid>.svg")
def cover(cid):
    kind = request.args.get("kind", "album")
    if kind not in ("album", "artist", "playlist"):
        kind = "album"
    title = request.args.get("title", "")
    if not title:
        # Look up a nice title from the demo catalog when possible.
        node = dc.ALBUM_MAP.get(cid) or dc.PLAYLIST_MAP.get(cid)
        if node:
            title = node["name"]
        elif cid in dc.ARTIST_MAP:
            title = dc.ARTIST_MAP[cid]["name"]
    title = unquote(title)[:60]
    svg = cover_svg(cid, kind=kind, title=title)
    return Response(svg, mimetype="image/svg+xml")


@app.get("/api/preview/<track_id>.wav")
def preview(track_id):
    if service.mode != "demo" and track_id not in dc.TRACK_MAP:
        return jsonify({"error": "Audio previews are only available in demo mode"}), 404
    if track_id not in dc.TRACK_MAP:
        return jsonify({"error": "Unknown track"}), 404
    try:
        wav = audio_synth.preview_wav(track_id)
    except Exception as exc:
        return jsonify({"error": f"preview failed: {exc}"}), 500
    return Response(wav, mimetype="audio/wav")


def _prewarm():
    ids = []
    for pl in dc.PLAYLISTS[:3]:
        ids.extend(pl["tracks"][:6])
    audio_synth.prewarm(ids)


if __name__ == "__main__":
    threading.Thread(target=_prewarm, daemon=True).start()
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, threaded=True, debug=False)
