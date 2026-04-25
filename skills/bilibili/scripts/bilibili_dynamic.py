#!/usr/bin/env python3
"""Get Bilibili dynamic feed (动态)."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient


def parse_dynamic(item: dict) -> dict:
    modules = item.get("modules", {})
    author = modules.get("module_author", {})
    dynamic = modules.get("module_dynamic", {})
    stat = modules.get("module_stat", {})

    text = ""
    desc = dynamic.get("desc")
    if desc and desc.get("text"):
        text = desc["text"]
    major = dynamic.get("major")
    if not text and major:
        archive = major.get("archive", {})
        if archive.get("title"):
            text = archive["title"]

    id_str = item.get("id_str", "")
    return {
        "id": id_str,
        "type": item.get("type", ""),
        "author": author.get("name", ""),
        "author_mid": author.get("mid", 0),
        "text": text,
        "likes": stat.get("like", {}).get("count", 0),
        "comments": stat.get("comment", {}).get("count", 0),
        "forwards": stat.get("forward", {}).get("count", 0),
        "time": author.get("pub_ts", 0),
        "url": f"https://t.bilibili.com/{id_str}" if id_str else "",
    }


def get_dynamic_feed(client: BilibiliClient, limit: int = 20, offset: str = "") -> dict:
    """Fetch the authenticated user's dynamic feed."""
    client.require_cookie()
    params = {"type": "all"}
    if offset:
        params["offset"] = offset
    payload = client.get("/x/polymer/web-dynamic/v1/feed/all", params=params)
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    data = payload.get("data", {})
    items = data.get("items", [])
    dynamics = [parse_dynamic(item) for item in items[:limit]]
    return {
        "count": len(dynamics),
        "has_more": data.get("has_more", False),
        "offset": data.get("offset", ""),
        "dynamics": dynamics,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Bilibili dynamic feed")
    parser.add_argument("--limit", type=int, default=20, help="Max items to return (default: 20)")
    parser.add_argument("--offset", default="", help="Pagination offset from previous response")
    parser.add_argument("--cookie", default="", help="Bilibili session cookie")
    args = parser.parse_args()

    try:
        client = BilibiliClient(args.cookie) if args.cookie else BilibiliClient.create()
        result = get_dynamic_feed(client, args.limit, args.offset)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
