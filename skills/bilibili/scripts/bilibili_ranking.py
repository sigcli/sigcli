#!/usr/bin/env python3
"""Get Bilibili ranking videos by category."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient, parse_video

TID_MAP = {
    "all": 0,
    "anime": 1,
    "music": 3,
    "dance": 129,
    "game": 4,
    "tech": 188,
    "knowledge": 36,
    "life": 160,
    "food": 211,
    "animal": 217,
    "car": 223,
    "fashion": 155,
    "entertainment": 5,
    "movie": 181,
    "tv": 177,
}


def get_ranking(client: BilibiliClient, category: str = "all", limit: int = 20) -> dict:
    """Fetch ranking videos by category."""
    tid = TID_MAP.get(category, 0)
    payload = client.get("/x/web-interface/ranking/v2", params={"rid": tid, "type": "all"})
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    items = payload.get("data", {}).get("list", [])
    videos = [parse_video(item) for item in items[:limit]]
    return {
        "category": category,
        "tid": tid,
        "count": len(videos),
        "videos": videos,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Bilibili ranking videos")
    parser.add_argument("--category", default="all", help=f"Category: {', '.join(TID_MAP.keys())} (default: all)")
    parser.add_argument("--limit", type=int, default=20, help="Max videos to return (default: 20)")
    args = parser.parse_args()

    try:
        client = BilibiliClient.create()
        result = get_ranking(client, args.category, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
