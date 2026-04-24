#!/usr/bin/env python3
"""Get a Reddit post with its comments."""

import argparse
import json
import sys

import requests
from reddit_client import REDDIT_BASE, RedditClient, parse_comment, parse_post


def get_post(client: RedditClient, post_id: str, comments_limit: int, sort: str) -> dict:
    """Fetch a post and its comments by post ID."""
    url = f"{REDDIT_BASE}/comments/{post_id}.json"
    data = client.get(url, params={"sort": sort, "limit": comments_limit, "raw_json": 1})

    if not isinstance(data, list) or len(data) < 2:
        raise ValueError("Unexpected response structure from Reddit")

    # First element is the post listing
    post_listing = data[0].get("data", {}).get("children", [])
    if not post_listing:
        raise ValueError("Post not found")
    post = parse_post(post_listing[0]["data"])

    # Second element is the comments listing
    comments_listing = data[1].get("data", {}).get("children", [])
    comments = []
    for child in comments_listing:
        if child.get("kind") == "t1":
            comments.append(parse_comment(child["data"], depth=0))

    return {
        "post": post,
        "comments": {
            "count": len(comments),
            "items": comments,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Get a Reddit post with comments")
    parser.add_argument("--id", required=True, help="Post ID (e.g. 1k2x3y)")
    parser.add_argument("--comments-limit", type=int, default=20, help="Max top-level comments (default: 20)")
    parser.add_argument("--sort", default="best", choices=["best", "top", "new"], help="Comment sort order (default: best)")
    args = parser.parse_args()

    try:
        client = RedditClient()
        result = get_post(client, args.id, args.comments_limit, args.sort)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
