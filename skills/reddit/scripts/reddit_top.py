#!/usr/bin/env python3
"""Get top posts from a Reddit subreddit."""

import argparse
import json
import sys

import requests
from reddit_client import REDDIT_BASE, RedditClient, parse_post


def get_top_posts(client: RedditClient, subreddit: str, time_period: str, limit: int, after: str = "") -> dict:
    """Fetch top posts from a subreddit for a given time period."""
    url = f"{REDDIT_BASE}/r/{subreddit}/top.json"
    params = {"t": time_period, "limit": limit, "raw_json": 1}
    if after:
        params["after"] = after
    data = client.get(url, params=params)

    listing = data.get("data", {})
    posts = []
    for child in listing.get("children", []):
        if child.get("kind") == "t3":
            posts.append(parse_post(child["data"]))

    return {
        "subreddit": subreddit,
        "time": time_period,
        "count": len(posts),
        "posts": posts,
        "after": listing.get("after"),
    }


def main():
    parser = argparse.ArgumentParser(description="Get top posts from a Reddit subreddit")
    parser.add_argument("--subreddit", default="all", help="Subreddit name without r/ prefix (default: all)")
    parser.add_argument("--time", default="day", choices=["hour", "day", "week", "month", "year", "all"], help="Time period (default: day)")
    parser.add_argument("--limit", type=int, default=25, help="Max posts to return (default: 25)")
    parser.add_argument("--after", default="", help="Pagination token from previous response")
    args = parser.parse_args()

    try:
        client = RedditClient()
        result = get_top_posts(client, args.subreddit, args.time, args.limit, args.after)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
