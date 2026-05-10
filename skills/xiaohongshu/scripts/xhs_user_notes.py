#!/usr/bin/env python3
"""Get notes posted by a Xiaohongshu user.

Usage:
    python3 xhs_user_notes.py --user-id USER_ID [--cursor ""] [--limit 30]
"""

from __future__ import annotations

import argparse
import json
import sys

from xhs_client import XhsApiError, XhsClient, error_response, parse_note_brief

USER_POSTED_PATH = "/api/sns/web/v1/user_posted"


def get_user_notes(client: XhsClient, user_id: str, cursor: str = "", limit: int = 30) -> dict:
    """Get notes posted by a user with pagination."""
    data = client.get(USER_POSTED_PATH, {
        "num": limit,
        "cursor": cursor,
        "user_id": user_id,
        "image_scenes": "FD_WM_WEBP",
    })
    notes_raw = data.get("notes", [])
    notes = [parse_note_brief(item) for item in notes_raw]
    return {
        "user_id": user_id,
        "notes": notes,
        "cursor": data.get("cursor", ""),
        "has_more": data.get("has_more", False),
    }


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu user's posted notes")
    parser.add_argument("--user-id", required=True, help="Target user ID")
    parser.add_argument("--cursor", default="", help="Pagination cursor (from previous results)")
    parser.add_argument("--limit", type=int, default=30, help="Number of notes to fetch (default: 30)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = get_user_notes(client, user_id=args.user_id, cursor=args.cursor, limit=args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
