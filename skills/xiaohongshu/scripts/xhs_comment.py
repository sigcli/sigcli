#!/usr/bin/env python3
"""Post a comment on a Xiaohongshu note."""

import argparse
import json
import sys

import requests
from xhs_client import XhsApiError, XhsClient, error_response, parse_note_id


def post_comment(cookie: str, note_input: str, text: str) -> dict:
    """Post a comment on a note via the web API."""
    client = XhsClient(cookie)
    client.require_cookie()
    note_id = parse_note_id(note_input)

    if not text.strip():
        raise XhsApiError("EMPTY_COMMENT", "Comment text cannot be empty")

    path = "/api/sns/web/v1/comment/post"
    payload = {"note_id": note_id, "content": text.strip()}

    data = client.api_post(path, json_data=payload)
    comment_data = data.get("data") or data.get("comment") or {}

    return {
        "success": True,
        "note_id": note_id,
        "comment_id": comment_data.get("id", ""),
        "content": text.strip(),
        "message": "Comment posted successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Post a comment on a Xiaohongshu note")
    parser.add_argument("--cookie", required=True, help="Xiaohongshu session cookie")
    parser.add_argument("--id", required=True, help="Note ID or URL")
    parser.add_argument("--text", required=True, help="Comment text")
    args = parser.parse_args()

    try:
        result = post_comment(args.cookie, args.id, args.text)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump(error_response(f"HTTP_{e.response.status_code}", str(e)), sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
