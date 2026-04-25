#!/usr/bin/env python3
"""Search YouTube videos via InnerTube search API."""

import argparse
import json
import sys

import requests
from youtube_client import YouTubeClient


def search_videos(client: YouTubeClient, query: str, limit: int = 20) -> dict:
    """Search YouTube and return a list of video results."""
    data = client.post("search", {"query": query})

    sections = (
        data.get("contents", {})
        .get("twoColumnSearchResultsRenderer", {})
        .get("primaryContents", {})
        .get("sectionListRenderer", {})
        .get("contents", [])
    )

    videos = []
    for section in sections:
        items = section.get("itemSectionRenderer", {}).get("contents", [])
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
        "query": query,
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
    parser = argparse.ArgumentParser(description="Search YouTube videos")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    args = parser.parse_args()

    try:
        client = YouTubeClient()
        result = search_videos(client, args.query, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
