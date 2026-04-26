#!/usr/bin/env python3
"""Get YouTube trending videos via HTML page scraping with InnerTube API fallback."""

import argparse
import json
import re
import sys

import requests
from youtube_client import YouTubeClient

SOCS_COOKIE = "CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiACGgYIgJnSmgY"


def _text(obj=None) -> str:
    if not obj:
        return ""
    if isinstance(obj, str):
        return obj
    if "simpleText" in obj:
        return obj["simpleText"]
    runs = obj.get("runs", [])
    return "".join(r.get("text", "") for r in runs)


def _extract_videos_from_data(data: dict, limit: int) -> list:
    """Walk ytInitialData to find videoRenderer items."""
    videos = []

    def walk(obj, depth=0):
        if len(videos) >= limit or depth > 15:
            return
        if isinstance(obj, dict):
            vr = obj.get("videoRenderer")
            if vr and vr.get("videoId"):
                videos.append({
                    "videoId": vr["videoId"],
                    "title": _text(vr.get("title")),
                    "channel": _text(vr.get("ownerText") or vr.get("shortBylineText")),
                    "views": _text(vr.get("viewCountText")),
                    "duration": _text(vr.get("lengthText")),
                    "published": _text(vr.get("publishedTimeText")),
                    "url": "https://www.youtube.com/watch?v=" + vr["videoId"],
                })
                return
            for v in obj.values():
                walk(v, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, depth + 1)

    walk(data)
    return videos


def get_trending(client: YouTubeClient, limit: int = 20, region: str = "US") -> dict:
    """Fetch trending videos by scraping the trending page."""
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    session.headers["Accept-Language"] = "en-US,en;q=0.9"
    session.cookies.set("SOCS", SOCS_COOKIE, domain=".youtube.com")
    if client.cookie:
        session.headers["Cookie"] = client.cookie

    resp = session.get(f"https://www.youtube.com/feed/trending?gl={region}", timeout=15)
    resp.raise_for_status()

    m = re.search(r"var ytInitialData\s*=\s*({.+?});\s*</script>", resp.text, re.DOTALL)
    if m:
        data = json.loads(m.group(1))
        videos = _extract_videos_from_data(data, limit)
        if videos:
            return {"region": region, "count": len(videos), "videos": videos}

    # Fallback: search for trending content
    search_data = client.post("search", {"query": "trending today", "params": "EgIQAQ%3D%3D"})
    items = (search_data.get("contents", {}).get("twoColumnSearchResultsRenderer", {})
             .get("primaryContents", {}).get("sectionListRenderer", {}).get("contents", []))
    videos = []
    for section in items:
        for renderer in section.get("itemSectionRenderer", {}).get("contents", []):
            vr = renderer.get("videoRenderer")
            if vr and vr.get("videoId") and len(videos) < limit:
                videos.append({
                    "videoId": vr["videoId"],
                    "title": _text(vr.get("title")),
                    "channel": _text(vr.get("ownerText") or vr.get("shortBylineText")),
                    "views": _text(vr.get("viewCountText")),
                    "duration": _text(vr.get("lengthText")),
                    "published": _text(vr.get("publishedTimeText")),
                    "url": "https://www.youtube.com/watch?v=" + vr["videoId"],
                })
    return {"region": region, "count": len(videos), "videos": videos, "source": "search_fallback"}


def main():
    parser = argparse.ArgumentParser(description="Get YouTube trending videos")
    parser.add_argument("--limit", type=int, default=20, help="Max videos (default: 20)")
    parser.add_argument("--region", default="US", help="Region code (default: US)")
    args = parser.parse_args()

    try:
        client = YouTubeClient.create()
        result = get_trending(client, args.limit, args.region)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
