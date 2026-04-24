#!/usr/bin/env python3
"""View a Reddit user's profile and activity."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from reddit_client import REDDIT_BASE, RedditClient, parse_comment, parse_post


def parse_user(data: dict) -> dict:
    """Normalize a Reddit user data dict."""
    return {
        "name": data.get("name", ""),
        "link_karma": data.get("link_karma", 0),
        "comment_karma": data.get("comment_karma", 0),
        "created_utc": data.get("created_utc", 0),
        "is_gold": data.get("is_gold", False),
        "icon_img": data.get("icon_img", ""),
    }


def get_user(client: RedditClient, username: str, include_posts: bool, include_comments: bool) -> dict:
    """Fetch a user's profile and optionally their recent posts and comments."""
    # Fetch user profile
    url = f"{REDDIT_BASE}/user/{username}/about.json"
    data = client.get(url, params={"raw_json": 1})
    user = parse_user(data.get("data", {}))

    result: dict = {"user": user}

    # Fetch user's posts
    if include_posts:
        posts_url = f"{REDDIT_BASE}/user/{username}/submitted.json"
        posts_data = client.get(posts_url, params={"limit": 25, "raw_json": 1})
        posts = []
        for child in posts_data.get("data", {}).get("children", []):
            if child.get("kind") == "t3":
                posts.append(parse_post(child["data"]))
        result["posts"] = posts

    # Fetch user's comments
    if include_comments:
        comments_url = f"{REDDIT_BASE}/user/{username}/comments.json"
        comments_data = client.get(comments_url, params={"limit": 25, "raw_json": 1})
        comments = []
        for child in comments_data.get("data", {}).get("children", []):
            if child.get("kind") == "t1":
                comments.append(parse_comment(child["data"]))
        result["comments"] = comments

    return result


def main():
    parser = argparse.ArgumentParser(description="View a Reddit user's profile and activity")
    parser.add_argument("--username", required=True, help="Reddit username without u/ prefix")
    parser.add_argument("--include-posts", action="store_true", help="Include user's recent posts")
    parser.add_argument("--include-comments", action="store_true", help="Include user's recent comments")
    args = parser.parse_args()

    try:
        client = RedditClient()
        result = get_user(client, args.username, args.include_posts, args.include_comments)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
