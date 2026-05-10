#!/usr/bin/env python3
"""Follow or unfollow a Xiaohongshu user.

Usage:
    python3 xhs_follow.py --user-id <id> [--undo]
"""

from __future__ import annotations

import argparse
import json
import sys

from xhs_client import XhsApiError, XhsClient, error_response

FOLLOW_PATH = "/api/sns/web/v1/user/follow"
UNFOLLOW_PATH = "/api/sns/web/v1/user/unfollow"


def follow_user(client: XhsClient, user_id: str) -> dict:
    """Follow a user."""
    client.require_auth()
    client.post(FOLLOW_PATH, {"target_user_id": user_id})
    return {"user_id": user_id, "action": "follow", "success": True}


def unfollow_user(client: XhsClient, user_id: str) -> dict:
    """Unfollow a user."""
    client.require_auth()
    client.post(UNFOLLOW_PATH, {"target_user_id": user_id})
    return {"user_id": user_id, "action": "unfollow", "success": True}


def main():
    parser = argparse.ArgumentParser(description="Follow/unfollow a Xiaohongshu user")
    parser.add_argument("--user-id", required=True, help="Target user ID")
    parser.add_argument("--undo", action="store_true", help="Unfollow instead of follow")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        if args.undo:
            result = unfollow_user(client, args.user_id)
        else:
            result = follow_user(client, args.user_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
