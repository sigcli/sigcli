#!/usr/bin/env python3
"""Delete a tweet on X (Twitter)."""

import argparse
import json
import sys

import requests
from x_client import XApiError, XClient, resolve_tweet_id


def delete_tweet(cookie: str, tweet_id: str) -> dict:
    """Delete a tweet by ID."""
    client = XClient(cookie)
    client.require_cookie()

    variables = {"tweet_id": tweet_id, "dark_request": False}
    client.graphql_post("DeleteTweet", variables)
    return {
        "success": True,
        "tweet_id": tweet_id,
        "message": "Tweet deleted successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Delete a tweet on X")
    parser.add_argument("--cookie", required=True, help="X session cookie")
    parser.add_argument("--id", required=True, help="Tweet ID or URL to delete")
    args = parser.parse_args()

    tweet_id = resolve_tweet_id(args.id)
    try:
        result = delete_tweet(args.cookie, tweet_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
