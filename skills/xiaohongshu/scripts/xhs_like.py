#!/usr/bin/env python3
"""Like or unlike a Xiaohongshu note.

Usage:
    python3 xhs_like.py --note-id <id> [--undo]
"""

from __future__ import annotations

import argparse
import json
import sys

from xhs_client import XhsApiError, XhsClient, error_response

LIKE_PATH = "/api/sns/web/v1/note/like"
DISLIKE_PATH = "/api/sns/web/v1/note/dislike"


def like_note(client: XhsClient, note_id: str) -> dict:
    """Like a note."""
    client.require_auth()
    client.post(LIKE_PATH, {"note_oid": note_id})
    return {"note_id": note_id, "action": "like", "success": True}


def unlike_note(client: XhsClient, note_id: str) -> dict:
    """Unlike (dislike) a note."""
    client.require_auth()
    client.post(DISLIKE_PATH, {"note_oid": note_id})
    return {"note_id": note_id, "action": "unlike", "success": True}


def main():
    parser = argparse.ArgumentParser(description="Like/unlike a Xiaohongshu note")
    parser.add_argument("--note-id", required=True, help="Note ID")
    parser.add_argument("--undo", action="store_true", help="Unlike instead of like")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        if args.undo:
            result = unlike_note(client, args.note_id)
        else:
            result = like_note(client, args.note_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
