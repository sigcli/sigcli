#!/usr/bin/env python3
"""Post a comment on a Xiaohongshu note."""

import argparse
import json
import sys

from xhs_client import XhsClient, XhsApiError


def post_comment(cookie, note_id, text):
    client = XhsClient(cookie)
    client.require_cookie()

    payload = {"note_id": note_id, "content": text}
    result = client.post("/api/sns/web/v1/comment/post", payload)
    comment = result.get("data", {}).get("comment", {})

    return {
        "success": True,
        "note_id": note_id,
        "comment_id": comment.get("id", ""),
        "content": text,
    }


def main():
    parser = argparse.ArgumentParser(description="Post a comment on a Xiaohongshu note")
    parser.add_argument("--cookie", required=True, help="Session cookie")
    parser.add_argument("--note-id", required=True, help="Note ID to comment on")
    parser.add_argument("--text", required=True, help="Comment text")
    args = parser.parse_args()

    try:
        result = post_comment(args.cookie, args.note_id, args.text)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump({"error": f"XHS_{e.code}", "message": e.msg}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
