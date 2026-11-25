#!/usr/bin/env python3
"""
fb_import.py — turn a public Facebook page or group into a Junction import bundle.

Uses the `facebook-scraper` package, which reads public page HTML (no API key):

    pip install facebook-scraper

Usage
-----
    python tools/fb_import.py --page nasa --pages 2 --out public/data/imports/nasa.json
    python tools/fb_import.py --group 132544256152450 --pages 1 --out public/data/imports/group.json
    python tools/fb_import.py --page nasa --cookies cookies.txt --pages 3   # for posts that need login

Then, in Junction: Import from Facebook -> "Choose JSON file" -> pick the file.

Bundle format (v1)
------------------
    {
      "format": "junction-fb-bundle",
      "version": 1,
      "source": "facebook-scraper",
      "generatedAt": "2026-11-25T18:00:00Z",
      "page": { "id": "nasa", "name": "NASA", "avatar": "...", "url": "https://facebook.com/nasa", "handle": "nasa" },
      "posts": [
        {
          "id": "...", "at": 1700000000000, "text": "...",
          "images": ["..."], "video": null,
          "link": { "url": "...", "title": "...", "desc": "..." },
          "reactions": { "like": 1200, "love": 300, "wow": 20 },
          "commentsCount": 42, "shares": 8, "url": "..."
        }
      ]
    }

Only scrape public content you have the right to collect. facebook-scraper is an
unofficial client; Facebook's terms and rate limits still apply.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

REACTION_KEYS = ("like", "love", "care", "haha", "wow", "sad", "angry")


def _num(value: Any) -> int:
    """Parse Facebook's abbreviated counts: '1.2K' -> 1200, '3.4M' -> 3400000."""
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).strip().replace(",", "")
    m = re.match(r"^([\d.]+)\s*([KkMmBb]?)$", text)
    if not m:
        return 0
    n = float(m.group(1))
    mult = {"": 1, "k": 1_000, "m": 1_000_000, "b": 1_000_000_000}[m.group(2).lower()]
    return int(n * mult)


def _ts(post: dict[str, Any]) -> int:
    """Return epoch milliseconds from facebook-scraper's `time` field."""
    t = post.get("time")
    if isinstance(t, datetime):
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return int(t.timestamp() * 1000)
    if isinstance(t, (int, float)):
        return int(t * 1000 if t < 10_000_000_000 else t)
    return int(datetime.now(tz=timezone.utc).timestamp() * 1000)


def _clean_text(post: dict[str, Any]) -> str:
    text = post.get("text") or post.get("post_text") or ""
    # facebook-scraper returns a few NBSP / zero-width characters in post bodies
    return (
        str(text)
        .replace("\u00a0", " ")
        .replace("\u200b", "")
        .strip()
    )


def _image_list(post: dict[str, Any]) -> list[str]:
    images: list[str] = []
    for key in ("images", "image", "photo", "photos"):
        value = post.get(key)
        if isinstance(value, str):
            images.append(value)
        elif isinstance(value, (list, tuple)):
            images.extend(str(v) for v in value if v)
    seen: list[str] = []
    for url in images:
        if url not in seen:
            seen.append(url)
    return seen[:4]


def _normalise_post(post: dict[str, Any]) -> dict[str, Any] | None:
    text = _clean_text(post)
    images = _image_list(post)
    link = post.get("link")
    video = post.get("video")
    if not (text or images or link or video):
        return None

    reaction_counts = post.get("reaction_counts") or post.get("reactions") or {}
    reactions = {
        key: _num(reaction_counts.get(key))
        for key in REACTION_KEYS
        if reaction_counts.get(key)
    }
    if not reactions and post.get("likes"):
        reactions["like"] = _num(post["likes"])

    link_obj = None
    if isinstance(link, str) and link:
        link_obj = {"url": link, "title": post.get("link_title"), "desc": post.get("link_description")}
    elif isinstance(link, dict):
        link_obj = {"url": link.get("url"), "title": link.get("title"), "desc": link.get("desc")}

    return {
        "id": str(post.get("post_id") or post.get("id") or f"p{int(_ts(post))}"),
        "at": _ts(post),
        "text": text,
        "images": images,
        "video": video if isinstance(video, str) else None,
        "link": link_obj,
        "reactions": reactions,
        "commentsCount": _num(post.get("comments") or post.get("comment_count")),
        "shares": _num(post.get("shares")),
        "url": post.get("post_url") or post.get("url"),
    }


def _profile_avatar(handle: str) -> str:
    """Page avatars change over time; use the stable unavatar proxy (no API key)."""
    return f"https://unavatar.io/facebook/{handle}"


def scrape(args: argparse.Namespace) -> dict[str, Any]:
    try:
        from facebook_scraper import get_posts, get_page_info  # type: ignore
    except ImportError as err:  # pragma: no cover
        raise SystemExit(
            "facebook-scraper is not installed.\n\n    pip install facebook-scraper\n"
        ) from err

    target = args.page or args.group
    kind = "page" if args.page else "group"
    cookies = args.cookies

    page_info: dict[str, Any] = {}
    if kind == "page":
        try:
            page_info = get_page_info(target, cookies=cookies) or {}
        except Exception as err:  # noqa: BLE001 - page info is optional
            print(f"[fb_import] could not read page info: {err}", file=sys.stderr)

    raw: Iterable[dict[str, Any]] = get_posts(
        target,
        pages=args.pages,
        options={"comments": False, "allow_extra_requests": False},
        cookies=cookies,
        timeout=args.timeout,
        sleep=args.sleep,
    )

    posts: list[dict[str, Any]] = []
    for item in raw:
        normalised = _normalise_post(dict(item))
        if normalised:
            posts.append(normalised)
        if len(posts) >= args.limit:
            break

    name = page_info.get("Name") or target.replace("-", " ").replace("_", " ").title()
    return {
        "format": "junction-fb-bundle",
        "version": 1,
        "source": "facebook-scraper",
        "generatedAt": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "query": {"kind": kind, "target": target, "pages": args.pages},
        "page": {
            "id": target,
            "name": name,
            "handle": target,
            "avatar": _profile_avatar(target),
            "url": f"https://www.facebook.com/{target}",
            "likes": _num(page_info.get("Likes")),
            "followers": _num(page_info.get("Followers")),
            "about": page_info.get("About") or "",
        },
        "posts": posts,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Scrape a public Facebook page into a Junction bundle.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--page", help="public page handle or id, e.g. nasa")
    source.add_argument("--group", help="public group id or slug")
    parser.add_argument("--pages", type=int, default=2, help="how many result pages to walk (default 2)")
    parser.add_argument("--limit", type=int, default=24, help="max posts in the bundle (default 24)")
    parser.add_argument("--cookies", help="path to a Netscape cookies.txt for posts behind a login wall")
    parser.add_argument("--timeout", type=int, default=30, help="per-request timeout in seconds")
    parser.add_argument("--sleep", type=float, default=1.0, help="delay between pages in seconds")
    parser.add_argument("--out", default="bundle.json", help="output JSON path")
    parser.add_argument("--pretty", action="store_true", default=True, help="indent output (default on)")
    args = parser.parse_args(argv)

    bundle = scrape(args)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, indent=2 if args.pretty else None, ensure_ascii=False), encoding="utf-8")

    print(f"[fb_import] wrote {len(bundle['posts'])} posts for “{bundle['page']['name']}” -> {out}")
    print("[fb_import] open Junction -> #/import -> Choose JSON file to bring it into the feed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
