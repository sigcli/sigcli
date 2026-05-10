#!/usr/bin/env python3
"""Get Xiaohongshu user profile information.

Usage:
    python3 xhs_user.py [--user-id USER_ID]

If --user-id is omitted, returns the current authenticated user's profile.
"""

from __future__ import annotations

import argparse
import json
import sys

from xhs_client import XhsApiError, XhsClient, error_response, parse_user

SELF_INFO_PATH = "/api/sns/web/v2/user/me"
OTHER_INFO_PATH = "/api/sns/web/v1/user/otherinfo"


def get_user_info(client: XhsClient, user_id: str | None = None) -> dict:
    """Get user profile. If user_id is None, get current user."""
    if user_id:
        data = client.get(OTHER_INFO_PATH, {"target_user_id": user_id})
    else:
        data = client.get(SELF_INFO_PATH)
    return parse_user(data)


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu user profile")
    parser.add_argument("--user-id", default=None, help="Target user ID (omit for self)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = get_user_info(client, user_id=args.user_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
