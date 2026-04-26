#!/usr/bin/env python3
"""Subscribe or unsubscribe to a Reddit subreddit."""

import argparse
import json
import sys

import requests
from reddit_client import RedditApiError, RedditClient


def subscribe(cookie: str, subreddit: str, undo: bool = False) -> dict:
    """Subscribe or unsubscribe to a subreddit."""
    client = RedditClient(cookie)
    client.require_cookie()

    action = "unsub" if undo else "sub"
    client.oauth_post("/api/subscribe", data={"sr_name": subreddit, "action": action})

    verb = "Unsubscribed from" if undo else "Subscribed to"
    return {
        "success": True,
        "subreddit": subreddit,
        "action": action,
        "message": f"{verb} r/{subreddit}",
    }


def main():
    parser = argparse.ArgumentParser(description="Subscribe/unsubscribe to a subreddit")
    parser.add_argument("--cookie", required=True, help="Reddit session cookie")
    parser.add_argument("--subreddit", required=True, help="Subreddit name")
    parser.add_argument("--undo", action="store_true", help="Unsubscribe instead of subscribe")
    args = parser.parse_args()

    try:
        result = subscribe(args.cookie, args.subreddit, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except RedditApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
