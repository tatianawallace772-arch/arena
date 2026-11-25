#!/usr/bin/env python3
"""
Create the offline sample bundle used by Junction's Import page.

This does not touch the network: it mimics the exact shape produced by
tools/fb_import.py so the importer can be demoed without scraping.

    python tools/make_sample_bundle.py
    -> public/data/imports/sample-page.json
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "imports" / "sample-page.json"
ASSET_BASE = "/assets"

now = datetime.now(tz=timezone.utc)


def days_ago(d: float) -> int:
    return int((now - timedelta(days=d)).timestamp() * 1000)


posts = [
    {
        "id": "122084712345678901",
        "at": days_ago(0.2),
        "text": (
            "This week’s window seat view. We’re in the middle of a run of clear mornings over the "
            "San Juan range — if you’ve been waiting for a sign to get outside, this is the sign.\n\n"
            "Post the view from your morning run and tag the page. We’ll share our favorites on Friday."
        ),
        "images": [f"{ASSET_BASE}/photos/hike.jpg"],
        "video": None,
        "link": None,
        "reactions": {"like": 1842, "love": 612, "wow": 96, "care": 24},
        "commentsCount": 143,
        "shares": 61,
        "url": "https://www.facebook.com/ridgeandriver/posts/122084712345678901",
    },
    {
        "id": "122084712345678902",
        "at": days_ago(1.1),
        "text": (
            "Recipe drop: the camp stove elote we made on last month’s trip. Charred over the fire, "
            "lime crema, cotija, chili. Full recipe is linked below — print it, don’t screenshot it."
        ),
        "images": [f"{ASSET_BASE}/photos/tacos.jpg"],
        "video": None,
        "link": {
            "url": "https://www.facebook.com/ridgeandriver/notes/camp-stove-elote",
            "title": "Camp stove elote, for four people and one pot",
            "desc": "Everything you need fits in a single dry bag.",
        },
        "reactions": {"like": 981, "love": 402, "haha": 33},
        "commentsCount": 88,
        "shares": 120,
        "url": "https://www.facebook.com/ridgeandriver/posts/122084712345678902",
    },
    {
        "id": "122084712345678903",
        "at": days_ago(2.4),
        "text": (
            "Trail conditions update: the upper ridge is dry, the north face still holds snow. "
            "Microspikes recommended above 10,000 ft. Trailhead parking fills by 7:15 — carpool if you can."
        ),
        "images": [],
        "video": None,
        "link": {
            "url": "https://www.facebook.com/ridgeandriver/posts/conditions",
            "title": "Current trail conditions",
            "desc": "Updated every Thursday through October.",
        },
        "reactions": {"like": 311, "care": 41},
        "commentsCount": 19,
        "shares": 44,
        "url": "https://www.facebook.com/ridgeandriver/posts/122084712345678903",
    },
    {
        "id": "122084712345678904",
        "at": days_ago(4.0),
        "text": "Sunrise, no filter, one thermos between six of us. See you Saturday.",
        "images": [f"{ASSET_BASE}/photos/coast.jpg"],
        "video": f"{ASSET_BASE}/videos/demo.mp4",
        "link": None,
        "reactions": {"like": 2204, "love": 1330, "wow": 210, "haha": 12},
        "commentsCount": 261,
        "shares": 301,
        "url": "https://www.facebook.com/ridgeandriver/posts/122084712345678904",
    },
    {
        "id": "122084712345678905",
        "at": days_ago(6.2),
        "text": (
            "Our guide team is growing. We’re looking for two people who know these mountains, can read weather, "
            "and will happily explain why the last mile is the best mile. Details in the listing."
        ),
        "images": [f"{ASSET_BASE}/photos/bike.jpg"],
        "video": None,
        "link": {
            "url": "https://www.facebook.com/ridgeandriver/jobs",
            "title": "Seasonal guide positions — San Juan Mountains",
            "desc": "Applications close the end of the month.",
        },
        "reactions": {"like": 402, "love": 61, "wow": 8},
        "commentsCount": 54,
        "shares": 71,
        "url": "https://www.facebook.com/ridgeandriver/posts/122084712345678905",
    },
    {
        "id": "122084712345678906",
        "at": days_ago(9.5),
        "text": (
            "Throwback to the first trip we ever ran: four people, borrowed tents, and a rainstorm that "
            "lasted exactly as long as breakfast. Thank you to everyone who has come out since."
        ),
        "images": [f"{ASSET_BASE}/photos/lake.jpg", f"{ASSET_BASE}/photos/garden.jpg"],
        "video": None,
        "link": None,
        "reactions": {"like": 1204, "love": 388, "care": 92},
        "commentsCount": 176,
        "shares": 38,
        "url": "https://www.facebook.com/ridgeandriver/posts/122084712345678906",
    },
]

bundle = {
    "format": "junction-fb-bundle",
    "version": 1,
    "source": "facebook-scraper",
    "generatedAt": now.isoformat(timespec="seconds"),
    "query": {"kind": "page", "target": "ridgeandriver", "pages": 2},
    "page": {
        "id": "ridgeandriver",
        "name": "Ridge & River",
        "handle": "ridgeandriver",
        "avatar": f"{ASSET_BASE}/avatars/daniel.jpg",
        "url": "https://www.facebook.com/ridgeandriver",
        "likes": 48712,
        "followers": 51003,
        "about": "Guided hikes, trip reports and camp recipes from the San Juan Mountains. Sample bundle for Junction.",
    },
    "posts": posts,
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {len(posts)} posts -> {OUT.relative_to(ROOT)}")
