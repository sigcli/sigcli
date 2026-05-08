#!/usr/bin/env python3
"""Favorite (collect) or unfavorite a Xiaohongshu note."""

import argparse
import json
import sys

from xhs_client import XhsClient, XhsApiError


def collect_note(cookie, note_id, undo=False):
    client = XhsClient(cookie)
    client.require_cookie()

    uri = "/api/sns/web/v1/note/collect" if not undo else "/api/sns/web/v1/note/uncollect"
    payload = {"note_id": note_id}

    result = client.post(uri, payload)
    return {"success": True, "note_id": note_id, "action": "uncollect" if undo else "collect"}


def main():
    parser = argparse.ArgumentParser(description="Favorite/unfavorite a Xiaohongshu note")
    parser.add_argument("--cookie", required=True, help="Session cookie")
    parser.add_argument("--note-id", required=True, help="Note ID")
    parser.add_argument("--undo", action="store_true", help="Unfavorite instead of favorite")
    args = parser.parse_args()

    try:
        result = collect_note(args.cookie, args.note_id, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump({"error": f"XHS_{e.code}", "message": e.msg}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
