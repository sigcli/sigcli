#!/usr/bin/env python3
"""Search Reddit posts."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from reddit_client import REDDIT_BASE, RedditClient, parse_post


def search_posts(client: RedditClient, query: str, subreddit: str | None, sort: str, time_period: str, limit: int, after: str = "") -> dict:
    """Search Reddit for posts matching a query."""
    if subreddit:
        url = f"{REDDIT_BASE}/r/{subreddit}/search.json"
        params = {"q": query, "sort": sort, "t": time_period, "limit": limit, "restrict_sr": 1, "raw_json": 1}
    else:
        url = f"{REDDIT_BASE}/search.json"
        params = {"q": query, "sort": sort, "t": time_period, "limit": limit, "raw_json": 1}
    if after:
        params["after"] = after

    data = client.get(url, params=params)

    listing = data.get("data", {})
    posts = []
    for child in listing.get("children", []):
        if child.get("kind") == "t3":
            posts.append(parse_post(child["data"]))

    return {
        "query": query,
        "count": len(posts),
        "posts": posts,
        "after": listing.get("after"),
    }


def main():
    parser = argparse.ArgumentParser(description="Search Reddit posts")
    parser.add_argument("--query", required=True, help="Search query text")
    parser.add_argument("--subreddit", help="Search within a specific subreddit")
    parser.add_argument("--sort", default="relevance", choices=["relevance", "hot", "top", "new", "comments"], help="Sort order (default: relevance)")
    parser.add_argument("--time", default="all", choices=["hour", "day", "week", "month", "year", "all"], help="Time filter (default: all)")
    parser.add_argument("--limit", type=int, default=25, help="Max results (default: 25)")
    parser.add_argument("--after", default="", help="Pagination token from previous response")
    args = parser.parse_args()

    try:
        client = RedditClient()
        result = search_posts(client, args.query, args.subreddit, args.sort, args.time, args.limit, args.after)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
