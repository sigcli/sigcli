#!/usr/bin/env python3
"""Get comments on a Xiaohongshu note.

Usage:
    python3 xhs_comments.py --note-id <id> --xsec-token <token> [--cursor ""] [--limit 20]
"""

from __future__ import annotations

import argparse
import json
import sys

from xhs_client import XhsApiError, XhsClient, error_response, parse_comment

COMMENTS_PATH = "/api/sns/web/v2/comment/page"


def get_comments(
    client: XhsClient,
    note_id: str,
    xsec_token: str,
    cursor: str = "",
    limit: int = 20,
) -> dict:
    """Fetch and parse comments for a note."""
    params = {
        "note_id": note_id,
        "cursor": cursor,
        "top_comment_id": "",
        "image_formats": "jpg,webp,avif",
        "xsec_token": xsec_token,
    }
    data = client.get(COMMENTS_PATH, params)
    comments_raw = data.get("comments", [])
    comments = [parse_comment(c) for c in comments_raw[:limit]]
    return {
        "comments": comments,
        "cursor": data.get("cursor", ""),
        "has_more": data.get("has_more", False),
    }


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu note comments")
    parser.add_argument("--note-id", required=True, help="Note ID")
    parser.add_argument("--xsec-token", required=True, help="xsec_token for the note")
    parser.add_argument("--cursor", default="", help="Pagination cursor (default: empty)")
    parser.add_argument("--limit", type=int, default=20, help="Max comments to return (default: 20)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = get_comments(client, args.note_id, args.xsec_token, args.cursor, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
