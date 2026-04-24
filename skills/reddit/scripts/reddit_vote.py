#!/usr/bin/env python3
"""Upvote, downvote, or remove vote on a Reddit post or comment."""

import argparse
import json
import sys

import requests
from reddit_client import RedditApiError, RedditClient, to_fullname

DIRECTION_MAP = {"up": 1, "down": -1, "none": 0}


def vote(cookie: str, target_id: str, direction: str) -> dict:
    """Vote on a post or comment."""
    client = RedditClient(cookie)
    client.require_cookie()

    if not target_id.startswith("t1_") and not target_id.startswith("t3_"):
        target_id = to_fullname(target_id, "t3")

    dir_value = DIRECTION_MAP[direction]
    client.oauth_post("/api/vote", data={"id": target_id, "dir": dir_value})

    return {
        "success": True,
        "id": target_id,
        "direction": direction,
        "message": f"Vote '{direction}' applied",
    }


def main():
    parser = argparse.ArgumentParser(description="Vote on a Reddit post or comment")
    parser.add_argument("--cookie", required=True, help="Reddit session cookie")
    parser.add_argument("--id", required=True, help="Post/comment ID or fullname (t3_xxx / t1_xxx)")
    parser.add_argument("--direction", required=True, choices=["up", "down", "none"], help="Vote direction")
    args = parser.parse_args()

    try:
        result = vote(args.cookie, args.id, args.direction)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except RedditApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
