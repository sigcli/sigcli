#!/usr/bin/env python3
"""Get Xiaohongshu home feed (recommended notes).

Usage:
    python3 xhs_homefeed.py [--category homefeed_recommend] [--limit 20]
"""

from __future__ import annotations

import argparse
import json
import sys

from xhs_client import XhsApiError, XhsClient, error_response, parse_note_brief

HOMEFEED_PATH = "/api/sns/web/v1/homefeed"


def get_homefeed(
    client: XhsClient,
    category: str = "homefeed_recommend",
    limit: int = 20,
) -> dict:
    """Fetch home feed notes."""
    payload = {
        "cursor_score": "",
        "num": 40,
        "refresh_type": 1,
        "note_index": 0,
        "unread_begin_note_id": "",
        "unread_end_note_id": "",
        "unread_note_count": 0,
        "category": category,
        "search_key": "",
        "need_num": 40,
        "image_scenes": ["FD_PRV_WEBP", "FD_WM_WEBP"],
    }
    data = client.post(HOMEFEED_PATH, payload)
    items = data.get("items", [])
    notes = [parse_note_brief(item) for item in items]
    if len(notes) > limit:
        notes = notes[:limit]
    return {
        "category": category,
        "notes": notes,
        "cursor_score": data.get("cursor_score", ""),
    }


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu home feed")
    parser.add_argument("--category", default="homefeed_recommend", help="Feed category (default: homefeed_recommend)")
    parser.add_argument("--limit", type=int, default=20, help="Max notes to return (default: 20)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = get_homefeed(client, category=args.category, limit=args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
