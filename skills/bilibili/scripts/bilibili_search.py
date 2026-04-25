#!/usr/bin/env python3
"""Search Bilibili videos or users (requires WBI signing)."""

import argparse
import json
import re
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient


def search_videos(client: BilibiliClient, keyword: str, page: int = 1, limit: int = 20) -> dict:
    """Search for videos by keyword (WBI signed)."""
    payload = client.get(
        "/x/web-interface/wbi/search/type",
        params={"search_type": "video", "keyword": keyword, "page": page},
        signed=True,
    )
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    results = payload.get("data", {}).get("result", []) or []
    videos = []
    for item in results[:limit]:
        title = re.sub(r"<[^>]+>", "", item.get("title", ""))
        videos.append({
            "bvid": item.get("bvid", ""),
            "aid": item.get("aid", 0),
            "title": title,
            "author": item.get("author", ""),
            "author_mid": item.get("mid", 0),
            "description": item.get("description", ""),
            "duration": item.get("duration", ""),
            "thumbnail": item.get("pic", ""),
            "view": item.get("play", 0),
            "danmaku": item.get("danmaku", 0),
        })
    return {
        "keyword": keyword,
        "page": page,
        "count": len(videos),
        "videos": videos,
    }


def search_users(client: BilibiliClient, keyword: str, page: int = 1, limit: int = 20) -> dict:
    """Search for users by keyword (WBI signed)."""
    payload = client.get(
        "/x/web-interface/wbi/search/type",
        params={"search_type": "bili_user", "keyword": keyword, "page": page},
        signed=True,
    )
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    results = payload.get("data", {}).get("result", []) or []
    users = []
    for item in results[:limit]:
        users.append({
            "mid": item.get("mid", 0),
            "uname": re.sub(r"<[^>]+>", "", item.get("uname", "")),
            "usign": item.get("usign", ""),
            "fans": item.get("fans", 0),
            "videos": item.get("videos", 0),
            "level": item.get("level", 0),
        })
    return {
        "keyword": keyword,
        "page": page,
        "count": len(users),
        "users": users,
    }


def main():
    parser = argparse.ArgumentParser(description="Search Bilibili videos or users")
    parser.add_argument("--keyword", required=True, help="Search keyword")
    parser.add_argument("--type", default="video", choices=["video", "user"], help="Search type (default: video)")
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1)")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    args = parser.parse_args()

    try:
        client = BilibiliClient.create()
        if args.type == "user":
            result = search_users(client, args.keyword, args.page, args.limit)
        else:
            result = search_videos(client, args.keyword, args.page, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
