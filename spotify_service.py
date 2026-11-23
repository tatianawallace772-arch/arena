"""Music data service layer.

Two providers expose the same interface:

* ``SpotapiService`` — live Spotify metadata via the ``spotapi`` package's
  anonymous public catalogue (``SyncCatalogue``). spotapi's sync client is
  bound to the thread that created it, so all calls are dispatched to a
  dedicated worker thread. Optional cookie auth via the ``SPOTIFY_COOKIES``
  environment variable.
* ``DemoService`` — a bundled offline catalog with synthesized audio
  previews, used when Spotify is unreachable or ``SPOTAPI_MODE=demo``.

``SPOTAPI_MODE`` selects the behaviour: ``auto`` (default, try live then
fall back), ``live`` (require spotapi) or ``demo`` (offline catalog only).
"""

from __future__ import annotations

import os
import queue
import threading
from typing import Any, Callable, Optional

import demo_catalog as dc

MODE_ENV = os.environ.get("SPOTAPI_MODE", "auto").strip().lower()
REQUEST_TIMEOUT = float(os.environ.get("SPOTAPI_TIMEOUT", "20"))


class ServiceError(Exception):
    """Raised when the live Spotify provider fails a request."""


# ---------------------------------------------------------------------------
# Normalization helpers (work on plain dicts produced by spotapi.to_dict)
# ---------------------------------------------------------------------------

def _deep_get(d: Any, *path: str) -> Any:
    cur = d
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def _find_image(node: Any) -> Optional[str]:
    """Depth-first hunt for a Spotify artwork ``sources`` list."""
    if isinstance(node, dict):
        sources = node.get("sources")
        if isinstance(sources, list) and sources:
            urls = [s.get("url") for s in sources if isinstance(s, dict) and s.get("url")]
            if urls:
                return urls[len(urls) // 2] if len(urls) > 1 else urls[0]
        for value in node.values():
            found = _find_image(value)
            if found:
                return found
    elif isinstance(node, (list, tuple)):
        for value in node:
            found = _find_image(value)
            if found:
                return found
    return None


def _find_people(node: Any) -> list[dict]:
    """Extract [{id, name}] from nested artist credit structures."""
    items = _deep_get(node, "artists", "items")
    people = []
    if isinstance(items, list):
        for item in items:
            if not isinstance(item, dict):
                continue
            name = _deep_get(item, "profile", "name") or item.get("name")
            uri = item.get("uri") or ""
            if name:
                people.append({"id": _id_from_uri(uri), "name": name})
    return people


def _find_duration(node: Any) -> int:
    if isinstance(node, dict):
        value = node.get("total_milliseconds")
        if isinstance(value, (int, float)):
            return int(value)
        for v in node.values():
            got = _find_duration(v)
            if got:
                return got
    return 0


def _id_from_uri(uri: Any) -> str:
    if isinstance(uri, str) and ":" in uri:
        return uri.split(":")[-1]
    return uri if isinstance(uri, str) else ""


def _spotify_url(uri: Any) -> Optional[str]:
    if isinstance(uri, str) and uri.startswith("spotify:"):
        parts = uri.split(":")
        if len(parts) >= 3:
            return f"https://open.spotify.com/{parts[1]}/{parts[2]}"
    return None


# ---------------------------------------------------------------------------
# Demo provider
# ---------------------------------------------------------------------------

class DemoService:
    name = "demo"

    # -- serialization ----------------------------------------------------
    def _artist_lite(self, artist_id: str) -> dict:
        a = dc.ARTIST_MAP[artist_id]
        return {"id": a["id"], "name": a["name"]}

    def _track(self, tid: str) -> Optional[dict]:
        t = dc.TRACK_MAP.get(tid)
        if not t:
            return None
        album = dc.ALBUM_MAP[t["album_id"]]
        return {
            "id": t["id"],
            "uri": f"demo:track:{t['id']}",
            "name": t["name"],
            "artists": [self._artist_lite(a) for a in t["artist_ids"]],
            "album": {"id": album["id"], "name": album["name"]},
            "duration_ms": t["duration_ms"],
            "track_number": t["track_number"],
            "plays": t["plays"],
            "cover": f"/api/covers/{album['id']}.svg?kind=album",
            "preview_url": f"/api/preview/{t['id']}.wav",
            "spotify_url": None,
        }

    def _album_lite(self, album_id: str) -> Optional[dict]:
        al = dc.ALBUM_MAP.get(album_id)
        if not al:
            return None
        artist = dc.ARTIST_MAP[al["artist_id"]]
        return {
            "id": al["id"],
            "uri": f"demo:album:{al['id']}",
            "type": "album",
            "name": al["name"],
            "artists": [self._artist_lite(al["artist_id"])],
            "year": al["year"],
            "cover": f"/api/covers/{al['id']}.svg?kind=album",
            "subtitle": f"{al['year']} • {artist['name']}",
        }

    def _artist_card(self, artist_id: str) -> dict:
        a = dc.ARTIST_MAP[artist_id]
        return {
            "id": a["id"],
            "uri": f"demo:artist:{a['id']}",
            "type": "artist",
            "name": a["name"],
            "cover": f"/api/covers/{a['id']}.svg?kind=artist",
            "subtitle": "Artist",
        }

    def _playlist_card(self, pl: dict) -> dict:
        return {
            "id": pl["id"],
            "uri": f"demo:playlist:{pl['id']}",
            "type": "playlist",
            "name": pl["name"],
            "description": pl["description"],
            "cover": f"/api/covers/{pl['id']}.svg?kind=playlist",
            "subtitle": pl["description"],
        }

    # -- API --------------------------------------------------------------
    def home(self) -> dict:
        albums = sorted(
            dc.ALBUM_MAP.values(),
            key=lambda al: -sum(dc.TRACK_MAP[t]["plays"] for t in al["track_ids"]),
        )
        return {
            "mode": self.name,
            "quick_picks": [self._album_lite(al["id"]) for al in albums[:6]],
            "sections": [
                {"title": "Made for you", "items": [self._playlist_card(p) for p in list(dc.PLAYLIST_MAP.values())[:6]]},
                {"title": "Popular albums", "items": [self._album_lite(al["id"]) for al in albums[:8]]},
                {"title": "Featured artists", "items": [self._artist_card(a["id"]) for a in dc.ARTISTS]},
                {"title": "More playlists", "items": [self._playlist_card(p) for p in dc.PLAYLISTS[6:]]},
            ],
        }

    def library_playlists(self) -> list[dict]:
        return [self._playlist_card(p) for p in dc.PLAYLISTS]

    def search(self, query: str, limit: int = 10) -> dict:
        q = query.strip().lower()
        if not q:
            return {"tracks": [], "albums": [], "artists": [], "playlists": [], "top_result": None}

        def score(text_words, weights) -> int:
            total = 0
            for text, weight in zip(text_words, weights):
                if not text:
                    continue
                text = text.lower()
                if q in text:
                    total += weight * (2 if text.startswith(q) else 1)
            return total

        track_hits = []
        for t in dc.TRACK_MAP.values():
            artist_names = " ".join(dc.ARTIST_MAP[a]["name"] for a in t["artist_ids"])
            album_name = dc.ALBUM_MAP[t["album_id"]]["name"]
            s = score([t["name"], artist_names, album_name, " ".join(t["genres"])], [4, 2, 1, 1])
            if s:
                track_hits.append((s, t["plays"], t["id"]))
        track_hits.sort(key=lambda x: (-x[0], -x[1]))
        tracks = [self._track(tid) for _, _, tid in track_hits[:limit]]

        album_hits = []
        for al in dc.ALBUM_MAP.values():
            s = score([al["name"], dc.ARTIST_MAP[al["artist_id"]]["name"], str(al["year"])], [4, 2, 1])
            if s:
                album_hits.append((s, al["id"]))
        album_hits.sort(key=lambda x: -x[0])
        albums = [self._album_lite(aid) for _, aid in album_hits[:limit]]

        artist_hits = [(score([a["name"], " ".join(a["genres"])], [4, 1]), a["id"]) for a in dc.ARTISTS]
        artist_hits = [x for x in artist_hits if x[0] > 0]
        artist_hits.sort(key=lambda x: -x[0])
        artists = [self._artist_card(aid) for _, aid in artist_hits[:limit]]

        pl_hits = [(score([p["name"], p["description"], " ".join(p["tags"])], [4, 1, 2]), p["id"]) for p in dc.PLAYLISTS]
        pl_hits = [x for x in pl_hits if x[0] > 0]
        pl_hits.sort(key=lambda x: -x[0])
        playlists = [self._playlist_card(dc.PLAYLIST_MAP[pid]) for _, pid in pl_hits[:limit]]

        top = None
        candidates = []
        if track_hits:
            candidates.append((track_hits[0][0] + 1, "track", self._track(track_hits[0][2])))
        if album_hits:
            candidates.append((album_hits[0][0], "album", self._album_lite(album_hits[0][1])))
        if artist_hits:
            candidates.append((artist_hits[0][0], "artist", self._artist_card(artist_hits[0][1])))
        if pl_hits:
            candidates.append((pl_hits[0][0], "playlist", self._playlist_card(dc.PLAYLIST_MAP[pl_hits[0][1]])))
        if candidates:
            candidates.sort(key=lambda x: -x[0])
            top = {"type": candidates[0][1], "item": candidates[0][2]}

        return {"tracks": tracks, "albums": albums, "artists": artists, "playlists": playlists, "top_result": top}

    def album(self, album_id: str) -> Optional[dict]:
        al = dc.ALBUM_MAP.get(album_id)
        if not al:
            return None
        artist = dc.ARTIST_MAP[al["artist_id"]]
        out = self._album_lite(album_id)
        out.update({
            "tracks": [self._track(t) for t in al["track_ids"]],
            "genres": artist["genres"],
            "more_by": [self._album_lite(a["id"]) for a in dc.ALBUM_MAP.values()
                        if a["artist_id"] == al["artist_id"] and a["id"] != album_id],
        })
        return out

    def artist(self, artist_id: str) -> Optional[dict]:
        a = dc.ARTIST_MAP.get(artist_id)
        if not a:
            return None
        albums = [self._album_lite(al["id"]) for al in dc.ALBUM_MAP.values() if al["artist_id"] == artist_id]
        tracks = []
        for al in dc.ALBUM_MAP.values():
            if al["artist_id"] != artist_id:
                continue
            for tid in al["track_ids"]:
                tracks.append(dc.TRACK_MAP[tid])
        tracks.sort(key=lambda t: -t["plays"])
        return {
            "id": a["id"],
            "uri": f"demo:artist:{a['id']}",
            "name": a["name"],
            "image": f"/api/covers/{a['id']}.svg?kind=artist",
            "genres": a["genres"],
            "listeners": a["listeners"],
            "blurb": a["blurb"],
            "top_tracks": [self._track(t["id"]) for t in tracks[:8]],
            "albums": albums,
        }

    def playlist(self, playlist_id: str) -> Optional[dict]:
        p = dc.PLAYLIST_MAP.get(playlist_id)
        if not p:
            return None
        out = self._playlist_card(p)
        out.update({
            "owner": p["owner"],
            "tracks": [self._track(t) for t in p["tracks"] if t in dc.TRACK_MAP],
        })
        return out

    def track(self, track_id: str) -> Optional[dict]:
        return self._track(track_id)


# ---------------------------------------------------------------------------
# Live spotapi provider
# ---------------------------------------------------------------------------

class _SpotapiWorker:
    """Owns a SyncCatalogue on a dedicated thread (spotapi is thread-bound)."""

    def __init__(self, cookies: Optional[str] = None):
        self._queue: queue.Queue = queue.Queue()
        self._ready = threading.Event()
        self._init_error: Optional[BaseException] = None
        self._cookies = cookies
        self._thread = threading.Thread(target=self._run, name="spotapi-worker", daemon=True)
        self._thread.start()

    def _run(self) -> None:
        from spotapi import SyncCatalogue

        try:
            kwargs = {"cookies": self._cookies} if self._cookies else {}
            cat = SyncCatalogue(**kwargs)
            cat.__enter__()
        except BaseException as exc:  # network failure, bad cookies, ...
            self._init_error = exc
            self._ready.set()
            return

        self._ready.set()
        try:
            while True:
                item = self._queue.get()
                if item is None:
                    break
                fn, args, kwargs, reply = item
                try:
                    reply.put((True, fn(cat, *args, **kwargs)))
                except BaseException as exc:
                    reply.put((False, exc))
        finally:
            try:
                cat.close()
            except Exception:
                pass

    def call(self, fn: Callable, *args, timeout: float = REQUEST_TIMEOUT, **kwargs) -> Any:
        if not self._ready.wait(timeout=REQUEST_TIMEOUT):
            raise ServiceError("spotapi worker did not start in time")
        if self._init_error is not None:
            raise ServiceError(f"spotapi unavailable: {self._init_error}")
        reply: queue.Queue = queue.Queue(maxsize=1)
        self._queue.put((fn, args, kwargs, reply))
        try:
            ok, value = reply.get(timeout=timeout)
        except queue.Empty:
            raise ServiceError("Spotify request timed out")
        if ok:
            return value
        if isinstance(value, ServiceError):
            raise value
        raise ServiceError(str(value) or type(value).__name__)


class SpotapiService:
    name = "live"

    def __init__(self):
        cookies = os.environ.get("SPOTIFY_COOKIES") or None
        self._worker = _SpotapiWorker(cookies=cookies)
        self.ok = False
        self.error: Optional[str] = None
        try:
            self._worker.call(
                lambda cat: cat.search("spotify", types=("track",), limit=1),
                timeout=15,
            )
            self.ok = True
        except Exception as exc:
            self.error = str(exc)

    # -- normalization -----------------------------------------------------
    def _norm_track(self, d: dict) -> Optional[dict]:
        try:
            from spotapi import to_dict
            d = to_dict(d)
            name = d.get("name")
            uri = d.get("uri") or ""
            if not name:
                return None
            album_node = d.get("album_of_track") or d.get("album") or {}
            artists = _find_people(d)
            return {
                "id": _id_from_uri(uri),
                "uri": uri,
                "name": name,
                "artists": artists or [{"id": "", "name": "Unknown artist"}],
                "album": {"id": _id_from_uri(album_node.get("uri", "")), "name": album_node.get("name", "")},
                "duration_ms": _find_duration(d),
                "track_number": d.get("track_number"),
                "plays": None,
                "cover": _find_image(d),
                "preview_url": None,
                "spotify_url": _spotify_url(uri),
            }
        except Exception:
            return None

    def _norm_album_card(self, d: dict) -> Optional[dict]:
        try:
            from spotapi import to_dict
            d = to_dict(d)
            name = d.get("name")
            uri = d.get("uri") or ""
            if not name or not uri:
                return None
            artists = _find_people(d)
            year = _deep_get(d, "date", "year")
            subtitle = " • ".join(str(x) for x in [year, ", ".join(a["name"] for a in artists)] if x)
            return {
                "id": _id_from_uri(uri), "uri": uri, "type": "album", "name": name,
                "artists": artists, "year": year,
                "cover": _find_image(d), "subtitle": subtitle or "Album",
            }
        except Exception:
            return None

    def _norm_artist_card(self, d: dict) -> Optional[dict]:
        try:
            from spotapi import to_dict
            d = to_dict(d)
            name = _deep_get(d, "profile", "name") or d.get("name")
            uri = d.get("uri") or ""
            if not name or not uri:
                return None
            return {
                "id": _id_from_uri(uri), "uri": uri, "type": "artist", "name": name,
                "cover": _find_image(d), "subtitle": "Artist",
            }
        except Exception:
            return None

    def _norm_playlist_card(self, d: dict) -> Optional[dict]:
        try:
            from spotapi import to_dict
            d = to_dict(d)
            name = d.get("name")
            uri = d.get("uri") or ""
            if not name or not uri:
                return None
            owner = _deep_get(d, "owner", "name") or _deep_get(d, "made_by", "name") or "Spotify"
            return {
                "id": _id_from_uri(uri), "uri": uri, "type": "playlist", "name": name,
                "description": d.get("description") or f"By {owner}",
                "cover": _find_image(d), "subtitle": f"By {owner}",
            }
        except Exception:
            return None

    @staticmethod
    def _first_page(stream, limit: int = 50) -> list:
        items: list = []
        try:
            for page in stream:
                for entry in page:
                    items.append(entry)
                    if len(items) >= limit:
                        return items
        except Exception:
            pass
        return items

    # -- API --------------------------------------------------------------
    def home(self) -> dict:
        def fetch(cat):
            out = {"new": [], "playlists": [], "artists": []}
            try:
                res = cat.search("tag:new", types=("album",), limit=10)
                out["new"] = [self._norm_album_card(a) for a in res.albums]
            except Exception:
                pass
            try:
                res = cat.search("top hits", types=("playlist",), limit=10)
                out["playlists"] = [self._norm_playlist_card(p) for p in res.playlists]
            except Exception:
                pass
            try:
                res = cat.search("genre:pop", types=("artist",), limit=10)
                out["artists"] = [self._norm_artist_card(a) for a in res.artists]
            except Exception:
                pass
            return out

        data = self._worker.call(fetch)
        sections = []
        for title, key in (("New releases", "new"), ("Top playlists", "playlists"), ("Artists to watch", "artists")):
            items = [x for x in data[key] if x]
            if items:
                sections.append({"title": title, "items": items})
        return {
            "mode": self.name,
            "quick_picks": (sections[0]["items"][:6] if sections else []),
            "sections": sections,
        }

    def library_playlists(self) -> list[dict]:
        try:
            res = self._worker.call(lambda cat: cat.search("spotify", types=("playlist",), limit=12))
            return [p for p in (self._norm_playlist_card(x) for x in res.playlists) if p]
        except ServiceError:
            return []

    def search(self, query: str, limit: int = 10) -> dict:
        res = self._worker.call(
            lambda cat: cat.search(query, types=("track", "album", "artist", "playlist"), limit=limit)
        )
        tracks = [t for t in (self._norm_track(x) for x in res.tracks) if t]
        albums = [a for a in (self._norm_album_card(x) for x in res.albums) if a]
        artists = [a for a in (self._norm_artist_card(x) for x in res.artists) if a]
        playlists = [p for p in (self._norm_playlist_card(x) for x in res.playlists) if p]
        top = None
        if tracks:
            top = {"type": "track", "item": tracks[0]}
        elif artists:
            top = {"type": "artist", "item": artists[0]}
        elif albums:
            top = {"type": "album", "item": albums[0]}
        return {"tracks": tracks, "albums": albums, "artists": artists,
                "playlists": playlists, "top_result": top}

    def album(self, album_id: str) -> Optional[dict]:
        def fetch(cat):
            return cat.get_album(f"spotify:album:{album_id}")

        details = self._worker.call(fetch)
        from spotapi import to_dict
        d = to_dict(details)
        card = self._norm_album_card(d) or {"id": album_id, "name": "Album", "cover": None, "artists": [], "year": None}
        tracks = []
        for item in (_deep_get(d, "tracks_v2", "items") or []):
            node = item.get("track") if isinstance(item, dict) else None
            if not node:
                continue
            node.setdefault("album_of_track", {"name": card.get("name", ""), "uri": card.get("uri", "")})
            t = self._norm_track(node)
            if t:
                t["cover"] = t["cover"] or card.get("cover")
                tracks.append(t)
        card["tracks"] = tracks
        card["label"] = d.get("label")
        return card

    def artist(self, artist_id: str) -> Optional[dict]:
        def fetch(cat):
            details = cat.get_artist(f"spotify:artist:{artist_id}")
            try:
                top = cat.get_artist_top_tracks(f"spotify:artist:{artist_id}")
            except Exception:
                top = ()
            try:
                releases = self._first_page(cat.get_artist_releases(f"spotify:artist:{artist_id}"), 12)
            except Exception:
                releases = []
            return details, top, releases

        details, top, releases = self._worker.call(fetch)
        from spotapi import to_dict
        d = to_dict(details)
        card = self._norm_artist_card(d) or {"id": artist_id, "name": "Artist", "cover": None}
        listeners = _deep_get(d, "stats", "monthly_listeners") or _deep_get(d, "stats", "listeners")
        return {
            "id": card["id"],
            "uri": card["uri"],
            "name": card["name"],
            "image": card.get("cover") or _find_image(d),
            "genres": [],
            "listeners": listeners,
            "blurb": None,
            "top_tracks": [t for t in (self._norm_track(x) for x in top) if t][:8],
            "albums": [a for a in (self._norm_album_card(x) for x in releases) if a][:12],
        }

    def playlist(self, playlist_id: str) -> Optional[dict]:
        def fetch(cat):
            details = cat.get_playlist(f"spotify:playlist:{playlist_id}")
            try:
                entries = self._first_page(cat.get_playlist_items(f"spotify:playlist:{playlist_id}"), 60)
            except Exception:
                entries = []
            return details, entries

        details, entries = self._worker.call(fetch)
        from spotapi import to_dict
        card = self._norm_playlist_card(details) or {"id": playlist_id, "name": "Playlist", "cover": None}
        tracks = []
        for entry in entries:
            try:
                ed = to_dict(entry)
                node = ed.get("item") if isinstance(ed, dict) else None
                if not node or not isinstance(node, dict) or not node.get("name"):
                    continue
                t = self._norm_track(node)
                if t:
                    tracks.append(t)
            except Exception:
                continue
        card["tracks"] = tracks
        card["owner"] = card.get("subtitle", "Spotify").replace("By ", "")
        return card

    def track(self, track_id: str) -> Optional[dict]:
        details = self._worker.call(lambda cat: cat.get_track(f"spotify:track:{track_id}"))
        return self._norm_track(details)


# ---------------------------------------------------------------------------
# Facade
# ---------------------------------------------------------------------------

class MusicService:
    def __init__(self):
        self.demo = DemoService()
        self.live: Optional[SpotapiService] = None
        self.live_error: Optional[str] = None

        if MODE_ENV in ("auto", "live"):
            try:
                live = SpotapiService()
                if live.ok:
                    self.live = live
                else:
                    self.live_error = live.error
            except Exception as exc:
                self.live_error = str(exc)

        if MODE_ENV == "live" and not self.live:
            # Keep serving in demo mode but report the failure loudly.
            self.live_error = self.live_error or "SPOTAPI_MODE=live but spotapi failed to initialize"

        self.mode = "live" if self.live else "demo"

    @property
    def impl(self):
        return self.live if self.live else self.demo

    def status(self) -> dict:
        return {
            "mode": self.mode,
            "requested_mode": MODE_ENV,
            "live_available": self.live is not None,
            "live_error": self.live_error,
            "demo_tracks": len(dc.TRACK_MAP),
        }

    # delegate -------------------------------------------------------------
    def home(self) -> dict:
        return self.impl.home()

    def library_playlists(self) -> list[dict]:
        return self.impl.library_playlists()

    def search(self, query: str, limit: int = 10) -> dict:
        return self.impl.search(query, limit)

    def album(self, album_id: str):
        return self.impl.album(album_id)

    def artist(self, artist_id: str):
        return self.impl.artist(artist_id)

    def playlist(self, playlist_id: str):
        return self.impl.playlist(playlist_id)

    def track(self, track_id: str):
        return self.impl.track(track_id)


_SERVICE: Optional[MusicService] = None
_LOCK = threading.Lock()


def get_service() -> MusicService:
    global _SERVICE
    with _LOCK:
        if _SERVICE is None:
            _SERVICE = MusicService()
    return _SERVICE
