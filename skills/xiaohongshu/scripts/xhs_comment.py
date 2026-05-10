#!/usr/bin/env python3
"""Post a comment on a Xiaohongshu note.

Usage:
    python3 xhs_comment.py --note-id <id> --content "Great post!"
    python3 xhs_comment.py --note-id <id> --content "Reply" --reply-to <comment_id>
"""

from __future__ import annotations

import argparse
import json
import sys

from xhs_client import XhsApiError, XhsClient, error_response

COMMENT_PATH = "/api/sns/web/v1/comment/post"


def post_comment(
    client: XhsClient,
    note_id: str,
    content: str,
    target_comment_id: str = "",
) -> dict:
    """Post a comment (or reply to an existing comment) on a note."""
    client.require_auth()
    if not content.strip():
        raise XhsApiError("INVALID_INPUT", "Comment content cannot be empty")
    payload = {
        "note_id": note_id,
        "content": content,
        "at_users": [],
    }
    if target_comment_id:
        payload["target_comment_id"] = target_comment_id
    data = client.post(COMMENT_PATH, payload)
    return {
        "note_id": note_id,
        "comment_id": data.get("comment", {}).get("id", "") if isinstance(data, dict) else "",
        "content": content,
        "action": "reply" if target_comment_id else "comment",
        "success": True,
    }


def main():
    parser = argparse.ArgumentParser(description="Post a comment on a Xiaohongshu note")
    parser.add_argument("--note-id", required=True, help="Note ID")
    parser.add_argument("--content", required=True, help="Comment text")
    parser.add_argument("--reply-to", default="", help="Comment ID to reply to (optional)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = post_comment(client, args.note_id, args.content, args.reply_to)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
