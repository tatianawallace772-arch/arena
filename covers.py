"""Deterministic SVG cover art.

Generates Spotify-style gradient covers for demo artists/albums/playlists so
the app needs no external image assets. Same id always yields the same art.
"""

from __future__ import annotations

import hashlib
from xml.sax.saxutils import escape

PALETTES = [
    ("#1db954", "#0d3b21"), ("#e13300", "#3b1200"), ("#8d67ab", "#2a1e3d"),
    ("#e8115b", "#42091f"), ("#477d95", "#0f2d3c"), ("#ba5d07", "#3d1f02"),
    ("#0d73ec", "#071e40"), ("#af2896", "#3c0e33"), ("#148a08", "#0a3306"),
    ("#d9a466", "#402d10"), ("#509bf5", "#0d2340"), ("#e91429", "#40060d"),
    ("#7c4dbb", "#241539"), ("#c87f16", "#38230a"),
]


def _hash(text: str) -> int:
    return int(hashlib.sha256(text.encode()).hexdigest()[:16], 16)


def _wrap(title: str, limit: int = 14) -> list[str]:
    words = title.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if len(trial) > limit and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
        if len(lines) == 1 and len(cur) > limit:
            break
    if cur and len(lines) < 2:
        lines.append(cur)
    if len(lines) > 2:
        lines = lines[:2]
    if len(lines) == 2 and sum(len(w) for w in words) > len(lines[0]) + len(lines[1]):
        lines[1] = lines[1][: limit - 1].rstrip() + "…"
    return lines or [title[:limit]]


def cover_svg(seed: str, kind: str = "album", title: str = "") -> str:
    h = _hash(f"{kind}:{seed}")
    c1, c2 = PALETTES[h % len(PALETTES)]
    r1 = 90 + (h >> 8) % 120
    r2 = 40 + (h >> 16) % 60
    cx = 300 + ((h >> 24) % 120) - 60
    cy = 200 + ((h >> 32) % 120) - 60

    if kind == "artist":
        shapes = (
            f'<circle cx="300" cy="238" r="{r1}" fill="rgba(0,0,0,0.28)"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r2}" fill="rgba(255,255,255,0.14)"/>'
        )
    elif kind == "playlist":
        bars = []
        for i in range(5):
            bh = 60 + ((h >> (i * 4)) % 130)
            x = 175 + i * 52
            bars.append(
                f'<rect x="{x}" y="{290 - bh}" width="30" height="{bh * 2}" rx="15" '
                f'fill="rgba(255,255,255,0.20)"/>'
            )
        shapes = "".join(bars)
    else:  # album / default: vinyl rings
        shapes = (
            f'<circle cx="300" cy="270" r="{r1 + 60}" fill="none" stroke="rgba(255,255,255,0.20)" stroke-width="14"/>'
            f'<circle cx="300" cy="270" r="{r1}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="10"/>'
            f'<circle cx="300" cy="270" r="{r2}" fill="rgba(0,0,0,0.30)"/>'
            f'<circle cx="{cx}" cy="{cy}" r="26" fill="rgba(255,255,255,0.16)"/>'
        )

    label = {"album": "ALBUM", "playlist": "PLAYLIST", "artist": "ARTIST"}.get(kind, "SPOTAPIFY")
    title_lines = _wrap(title) if title else []
    text_y = 478 if len(title_lines) > 1 else 505
    tspans = "".join(
        f'<tspan x="48" dy="{0 if i == 0 else 62}">{escape(line)}</tspan>'
        for i, line in enumerate(title_lines)
    )
    text = (
        f'<text x="48" y="{text_y}" font-family="system-ui,Segoe UI,Roboto,sans-serif" '
        f'font-size="56" font-weight="800" fill="#ffffff">{tspans}</text>'
        if title_lines else ""
    )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">'
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/>'
        f'</linearGradient></defs>'
        f'<rect width="600" height="600" fill="url(#g)"/>'
        f'{shapes}'
        f'<text x="48" y="84" font-family="system-ui,Segoe UI,Roboto,sans-serif" font-size="26" '
        f'font-weight="700" letter-spacing="4" fill="rgba(255,255,255,0.72)">{label}</text>'
        f'{text}'
        f'</svg>'
    )
