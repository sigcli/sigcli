#!/usr/bin/env python3
"""Get Xiaohongshu trending/explore feed."""

import argparse
import json
import sys

from xhs_client import XhsClient, XhsApiError


def get_trending(cookie="", category="", limit=10):
    client = XhsClient(cookie) if cookie else XhsClient.create()

    payload = {"num": min(limit, 20), "cursor_score": "", "image_formats": ["jpg", "webp", "avif"]}
    if category:
        payload["category"] = category

    result = client.post("/api/sns/web/v1/homefeed", payload)
    items = result.get("data", {}).get("items", [])

    notes = []
    for item in items[:limit]:
        card = item.get("note_card", {})
        user = card.get("user", {})
        interact = card.get("interact_info", {})
        notes.append(
            {
                "id": card.get("note_id", item.get("id", "")),
                "title": card.get("display_title", ""),
                "type": card.get("type", ""),
                "author": user.get("nickname", ""),
                "author_id": user.get("user_id", ""),
                "likes": interact.get("liked_count", "0"),
                "cover": card.get("cover", {}).get("url", ""),
            }
        )

    return {"category": category or "default", "count": len(notes), "notes": notes}


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu explore feed")
    parser.add_argument("--cookie", default="", help="Session cookie (or use env var)")
    parser.add_argument("--category", default="", help="Feed category (optional)")
    parser.add_argument("--limit", type=int, default=10, help="Max notes (default: 10)")
    args = parser.parse_args()

    try:
        result = get_trending(args.cookie, args.category, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump({"error": f"XHS_{e.code}", "message": e.msg}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
