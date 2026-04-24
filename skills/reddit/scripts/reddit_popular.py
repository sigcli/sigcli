#!/usr/bin/env python3
"""Get popular posts from Reddit."""

import argparse
import json
import sys

import requests
from reddit_client import REDDIT_BASE, RedditClient, parse_post


def get_popular(client: RedditClient, limit: int, after: str = "") -> dict:
    """Fetch popular posts from /r/popular."""
    url = f"{REDDIT_BASE}/r/popular.json"
    params = {"limit": limit, "raw_json": 1}
    if after:
        params["after"] = after
    data = client.get(url, params=params)

    listing = data.get("data", {})
    posts = [parse_post(c["data"]) for c in listing.get("children", []) if c.get("kind") == "t3"]

    return {
        "count": len(posts),
        "posts": posts,
        "after": listing.get("after"),
    }


def main():
    parser = argparse.ArgumentParser(description="Get popular posts from Reddit")
    parser.add_argument("--limit", type=int, default=25, help="Max posts (default: 25)")
    parser.add_argument("--after", default="", help="Pagination token")
    args = parser.parse_args()

    try:
        client = RedditClient()
        result = get_popular(client, args.limit, args.after)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
