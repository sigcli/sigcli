#!/usr/bin/env python3
"""Favorite (collect) or unfavorite a Xiaohongshu note.

Usage:
    python3 xhs_favorite.py --note-id <id> [--undo]
"""

from __future__ import annotations

import argparse
import json
import sys

from xhs_client import XhsApiError, XhsClient, error_response

COLLECT_PATH = "/api/sns/web/v1/note/collect"
UNCOLLECT_PATH = "/api/sns/web/v1/note/uncollect"


def favorite_note(client: XhsClient, note_id: str) -> dict:
    """Favorite (collect) a note."""
    client.require_auth()
    client.post(COLLECT_PATH, {"note_id": note_id})
    return {"note_id": note_id, "action": "favorite", "success": True}


def unfavorite_note(client: XhsClient, note_id: str) -> dict:
    """Unfavorite (uncollect) a note."""
    client.require_auth()
    client.post(UNCOLLECT_PATH, {"note_ids": note_id})
    return {"note_id": note_id, "action": "unfavorite", "success": True}


def main():
    parser = argparse.ArgumentParser(description="Favorite/unfavorite a Xiaohongshu note")
    parser.add_argument("--note-id", required=True, help="Note ID")
    parser.add_argument("--undo", action="store_true", help="Unfavorite instead of favorite")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        if args.undo:
            result = unfavorite_note(client, args.note_id)
        else:
            result = favorite_note(client, args.note_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
