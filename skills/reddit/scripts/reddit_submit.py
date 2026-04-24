#!/usr/bin/env python3
"""Create a new post on Reddit."""

import argparse
import json
import sys

import requests
from reddit_client import RedditApiError, RedditClient


def submit_post(cookie: str, subreddit: str, title: str, kind: str = "self", text: str = "", url: str = "", flair_id: str = "", flair_text: str = "") -> dict:
    """Submit a new post to a subreddit."""
    client = RedditClient(cookie)
    client.require_cookie()

    data = {
        "sr": subreddit,
        "kind": kind,
        "title": title,
        "api_type": "json",
    }
    if kind == "self":
        data["text"] = text
    elif kind == "link":
        data["url"] = url
    if flair_id:
        data["flair_id"] = flair_id
    if flair_text:
        data["flair_text"] = flair_text

    resp = client.oauth_post("/api/submit", data=data)

    json_data = resp.get("json", {})
    errors = json_data.get("errors", [])
    if errors:
        raise RedditApiError("SUBMIT_FAILED", str(errors))

    result_data = json_data.get("data", {})
    return {
        "success": True,
        "id": result_data.get("id"),
        "name": result_data.get("name"),
        "url": result_data.get("url", ""),
        "message": f"Post created in r/{subreddit}",
    }


def main():
    parser = argparse.ArgumentParser(description="Create a new Reddit post")
    parser.add_argument("--cookie", required=True, help="Reddit session cookie")
    parser.add_argument("--subreddit", required=True, help="Subreddit to post in")
    parser.add_argument("--title", required=True, help="Post title")
    parser.add_argument("--kind", default="self", choices=["self", "link"], help="Post type (default: self)")
    parser.add_argument("--text", default="", help="Post body text (for self posts)")
    parser.add_argument("--url", default="", help="URL to share (for link posts)")
    parser.add_argument("--flair-id", default="", help="Flair template ID (from subreddit flair list)")
    parser.add_argument("--flair-text", default="", help="Flair text")
    args = parser.parse_args()

    try:
        result = submit_post(args.cookie, args.subreddit, args.title, args.kind, args.text, args.url, args.flair_id, args.flair_text)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except RedditApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
