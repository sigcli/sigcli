#!/usr/bin/env python3
"""Save or unsave a Reddit post."""

import argparse
import json
import sys

import requests
from reddit_client import REDDIT_BASE, RedditApiError, RedditClient, to_fullname


def save_post(cookie: str, target_id: str, undo: bool = False) -> dict:
    """Save or unsave a post."""
    client = RedditClient(cookie)
    client.require_cookie()

    if not target_id.startswith("t1_") and not target_id.startswith("t3_"):
        target_id = to_fullname(target_id, "t3")

    modhash = client.get_modhash()
    endpoint = "/api/unsave" if undo else "/api/save"

    data = {
        "id": target_id,
        "uh": modhash,
    }
    client.post(f"{REDDIT_BASE}{endpoint}", data=data)

    action = "unsaved" if undo else "saved"
    return {
        "success": True,
        "id": target_id,
        "action": action,
        "message": f"Post {action} successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Save or unsave a Reddit post")
    parser.add_argument("--cookie", required=True, help="Reddit session cookie")
    parser.add_argument("--id", required=True, help="Post/comment ID or fullname")
    parser.add_argument("--undo", action="store_true", help="Unsave instead of save")
    args = parser.parse_args()

    try:
        result = save_post(args.cookie, args.id, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except RedditApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
