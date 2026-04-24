#!/usr/bin/env python3
"""Get hot posts from a Reddit subreddit."""

import argparse
import json
import sys

import requests
from reddit_client import REDDIT_BASE, RedditClient, parse_post


def get_hot_posts(client: RedditClient, subreddit: str, limit: int) -> dict:
    """Fetch hot posts from a subreddit."""
    url = f"{REDDIT_BASE}/r/{subreddit}/hot.json"
    data = client.get(url, params={"limit": limit, "raw_json": 1})

    listing = data.get("data", {})
    posts = []
    for child in listing.get("children", []):
        if child.get("kind") == "t3":
            posts.append(parse_post(child["data"]))

    return {
        "subreddit": subreddit,
        "count": len(posts),
        "posts": posts,
        "after": listing.get("after"),
    }


def main():
    parser = argparse.ArgumentParser(description="Get hot posts from a Reddit subreddit")
    parser.add_argument("--subreddit", default="all", help="Subreddit name without r/ prefix (default: all)")
    parser.add_argument("--limit", type=int, default=25, help="Max posts to return (default: 25)")
    args = parser.parse_args()

    try:
        client = RedditClient()
        result = get_hot_posts(client, args.subreddit, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
