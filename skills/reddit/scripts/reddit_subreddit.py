#!/usr/bin/env python3
"""Get information about a Reddit subreddit."""

import argparse
import json
import sys

import requests
from reddit_client import REDDIT_BASE, RedditClient, parse_subreddit


def get_subreddit(client: RedditClient, name: str) -> dict:
    """Fetch subreddit information."""
    url = f"{REDDIT_BASE}/r/{name}/about.json"
    data = client.get(url, params={"raw_json": 1})
    subreddit = parse_subreddit(data.get("data", {}))

    return {"subreddit": subreddit}


def main():
    parser = argparse.ArgumentParser(description="Get information about a Reddit subreddit")
    parser.add_argument("--name", required=True, help="Subreddit name without r/ prefix")
    args = parser.parse_args()

    try:
        client = RedditClient()
        result = get_subreddit(client, args.name)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
