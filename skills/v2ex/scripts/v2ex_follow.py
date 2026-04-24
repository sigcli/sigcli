#!/usr/bin/env python3
"""Follow, unfollow, block, or unblock a V2EX member."""

import argparse
import json
import sys

import requests

from v2ex_client import V2EX_BASE, V2exClient, V2exError

VALID_ACTIONS = ("follow", "unfollow", "block", "unblock")


def follow_action(cookie, action, member_id):
    client = V2exClient(cookie)
    client.require_cookie()

    if action not in VALID_ACTIONS:
        raise V2exError("INVALID_ACTION", f"Action must be one of: {', '.join(VALID_ACTIONS)}")

    once, _ = client.get_once()

    url = V2EX_BASE + "/" + action + "/" + str(member_id) + "?once=" + once
    resp = client.get(url)

    return {
        "success": True,
        "action": action,
        "member_id": int(member_id),
        "message": f"Successfully {action}ed member",
    }


def main():
    parser = argparse.ArgumentParser(description="Follow/unfollow/block/unblock a V2EX member")
    parser.add_argument("--cookie", required=True, help="V2EX session cookie")
    parser.add_argument("--action", required=True, choices=VALID_ACTIONS, help="Action to perform")
    parser.add_argument("--id", required=True, help="Member numeric ID")
    args = parser.parse_args()

    try:
        result = follow_action(args.cookie, args.action, args.id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except V2exError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
