#!/usr/bin/env python3
"""Get LinkedIn home feed posts."""

import argparse
import json
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient, parse_feed_post


def get_feed(client: LinkedInClient, limit: int = 10) -> dict:
    data = client.voyager_get("/voyagerFeedDashMainFeed", params={"q": "mainFeed", "count": min(limit, 50)})
    included = data.get("included", [])
    posts = []
    for item in included:
        if item.get("$type", "").endswith("feed.Update"):
            post = parse_feed_post(item, included)
            if post.get("text") or post.get("author"):
                posts.append(post)
            if len(posts) >= limit:
                break
    return {"count": len(posts), "posts": posts}


def main():
    parser = argparse.ArgumentParser(description="Get LinkedIn home feed")
    parser.add_argument("--limit", type=int, default=10, help="Max posts (default: 10)")
    parser.add_argument("--cookie", default="", help="LinkedIn session cookie")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie) if args.cookie else LinkedInClient.create()
        result = get_feed(client, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
