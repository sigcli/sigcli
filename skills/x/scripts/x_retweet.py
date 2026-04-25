#!/usr/bin/env python3
"""Retweet or undo retweet on X (Twitter)."""

import argparse
import json
import sys

import requests
from x_client import XApiError, XClient, resolve_tweet_id


def retweet(cookie: str, tweet_id: str, undo: bool = False) -> dict:
    """Retweet or undo a retweet."""
    client = XClient(cookie)
    client.require_cookie()

    if undo:
        variables = {"source_tweet_id": tweet_id}
        client.graphql_post("DeleteRetweet", variables)
    else:
        variables = {"tweet_id": tweet_id, "dark_request": False}
        client.graphql_post("CreateRetweet", variables)

    action = "unretweeted" if undo else "retweeted"
    return {
        "success": True,
        "tweet_id": tweet_id,
        "action": action,
        "message": f"Tweet {action} successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Retweet or undo retweet on X")
    parser.add_argument("--cookie", required=True, help="X session cookie")
    parser.add_argument("--id", required=True, help="Tweet ID or URL")
    parser.add_argument("--undo", action="store_true", help="Undo retweet")
    args = parser.parse_args()

    try:
        tweet_id = resolve_tweet_id(args.id)
        result = retweet(args.cookie, tweet_id, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
