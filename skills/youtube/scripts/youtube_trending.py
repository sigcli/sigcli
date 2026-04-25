#!/usr/bin/env python3
"""Get YouTube trending videos via InnerTube browse API."""

import argparse
import json
import sys

import requests
from youtube_client import YouTubeClient


def get_trending(client: YouTubeClient, limit: int = 20) -> dict:
    """Fetch trending videos from YouTube."""
    data = client.post("browse", {"browseId": "FEtrending"})

    tabs = data.get("contents", {}).get("twoColumnBrowseResultsRenderer", {}).get("tabs", [])
    videos = []

    for tab in tabs:
        sections = tab.get("tabRenderer", {}).get("content", {}).get("sectionListRenderer", {}).get("contents", [])
        for section in sections:
            for shelf in section.get("itemSectionRenderer", {}).get("contents", []):
                items = shelf.get("shelfRenderer", {}).get("content", {}).get("expandedShelfContentsRenderer", {}).get("items", [])
                for item in items:
                    if len(videos) >= limit:
                        break
                    renderer = item.get("videoRenderer")
                    if not renderer:
                        continue
                    videos.append({
                        "videoId": renderer.get("videoId", ""),
                        "title": _text(renderer.get("title")),
                        "channel": _text(renderer.get("ownerText")),
                        "views": renderer.get("viewCountText", {}).get("simpleText", ""),
                        "duration": renderer.get("lengthText", {}).get("simpleText", ""),
                        "published": renderer.get("publishedTimeText", {}).get("simpleText", ""),
                        "url": "https://www.youtube.com/watch?v=" + renderer.get("videoId", ""),
                    })

    return {
        "count": len(videos),
        "videos": videos,
    }


def _text(obj=None) -> str:
    if not obj:
        return ""
    if "simpleText" in obj:
        return obj["simpleText"]
    runs = obj.get("runs", [])
    return "".join(r.get("text", "") for r in runs)


def main():
    parser = argparse.ArgumentParser(description="Get YouTube trending videos")
    parser.add_argument("--limit", type=int, default=20, help="Max videos (default: 20)")
    args = parser.parse_args()

    try:
        client = YouTubeClient()
        result = get_trending(client, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
