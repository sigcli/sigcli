#!/usr/bin/env python3
"""Get Bilibili hot/trending videos."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient, parse_video


def get_hot_videos(client: BilibiliClient, limit: int, page: int = 1) -> dict:
    """Fetch hot/trending videos."""
    payload = client.get("/x/web-interface/popular", params={"pn": page, "ps": limit})
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    videos = [parse_video(item) for item in payload.get("data", {}).get("list", [])]
    return {
        "count": len(videos),
        "page": page,
        "videos": videos,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Bilibili hot/trending videos")
    parser.add_argument("--limit", type=int, default=20, help="Max videos to return (default: 20)")
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1)")
    args = parser.parse_args()

    try:
        client = BilibiliClient.create()
        result = get_hot_videos(client, args.limit, args.page)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
