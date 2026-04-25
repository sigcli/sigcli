#!/usr/bin/env python3
"""Get Bilibili watch history."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient


def _fmt_duration(seconds: int) -> str:
    m = seconds // 60
    s = seconds % 60
    return f"{m}:{s:02d}"


def parse_history_item(item: dict, rank: int) -> dict:
    progress = item.get("progress", 0)
    duration = item.get("duration", 0)
    if progress < 0 or (duration > 0 and progress >= duration):
        progress_text = "finished"
    elif duration > 0:
        pct = round(progress / duration * 100)
        progress_text = f"{_fmt_duration(progress)}/{_fmt_duration(duration)} ({pct}%)"
    else:
        progress_text = ""

    history = item.get("history", {})
    bvid = history.get("bvid", "")
    return {
        "rank": rank,
        "title": item.get("title", ""),
        "author": item.get("author_name", ""),
        "author_mid": item.get("author_mid", 0),
        "bvid": bvid,
        "progress": progress_text,
        "duration": duration,
        "view_at": item.get("view_at", 0),
        "tag_name": item.get("tag_name", ""),
        "url": f"https://www.bilibili.com/video/{bvid}" if bvid else "",
    }


def get_history(client: BilibiliClient, limit: int = 20, view_at: int = 0, business: str = "") -> dict:
    """Fetch watch history with cursor-based pagination."""
    client.require_cookie()
    params = {"ps": min(limit, 30), "type": "archive"}
    if view_at:
        params["view_at"] = view_at
    if business:
        params["business"] = business
    payload = client.get("/x/web-interface/history/cursor", params=params)
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    data = payload.get("data", {})
    items_raw = data.get("list", []) or []
    items = [parse_history_item(item, i + 1) for i, item in enumerate(items_raw[:limit])]
    cursor = data.get("cursor", {})
    return {
        "count": len(items),
        "cursor_view_at": cursor.get("view_at", 0),
        "cursor_business": cursor.get("business", ""),
        "items": items,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Bilibili watch history")
    parser.add_argument("--limit", type=int, default=20, help="Max items to return (default: 20)")
    parser.add_argument("--view-at", type=int, default=0, help="Cursor: view_at from previous response for pagination")
    parser.add_argument("--cookie", default="", help="Bilibili session cookie")
    args = parser.parse_args()

    try:
        client = BilibiliClient(args.cookie) if args.cookie else BilibiliClient.create()
        result = get_history(client, args.limit, args.view_at)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
