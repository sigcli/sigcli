#!/usr/bin/env python3
"""Like or unlike a Xiaohongshu note."""

import argparse
import json
import sys

import requests
from xhs_client import XhsApiError, XhsClient, error_response, parse_note_id


def like_note(cookie: str, note_input: str, undo: bool = False) -> dict:
    """Like or unlike a note via the web API."""
    client = XhsClient(cookie)
    client.require_cookie()
    note_id = parse_note_id(note_input)

    if undo:
        path = "/api/sns/web/v1/note/dislike"
    else:
        path = "/api/sns/web/v1/note/like"

    data = client.api_post(path, json_data={"note_oid": note_id})
    success = data.get("success", False) or data.get("code") == 0 or data.get("result") is not None

    action = "unliked" if undo else "liked"
    return {
        "success": success,
        "note_id": note_id,
        "action": action,
        "message": f"Note {action} successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Like or unlike a Xiaohongshu note")
    parser.add_argument("--cookie", required=True, help="Xiaohongshu session cookie")
    parser.add_argument("--id", required=True, help="Note ID or URL")
    parser.add_argument("--undo", action="store_true", help="Unlike instead of like")
    args = parser.parse_args()

    try:
        result = like_note(args.cookie, args.id, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump(error_response(f"HTTP_{e.response.status_code}", str(e)), sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
