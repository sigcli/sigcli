#!/usr/bin/env python3
"""Post a comment on a Reddit post or reply to a comment."""

import argparse
import json
import sys

import requests
from reddit_client import RedditApiError, RedditClient, to_fullname


def post_comment(cookie: str, parent: str, text: str) -> dict:
    """Post a comment. Parent is a fullname (t3_xxx for post, t1_xxx for comment)."""
    client = RedditClient(cookie)
    client.require_cookie()

    if not parent.startswith("t1_") and not parent.startswith("t3_"):
        parent = to_fullname(parent, "t3")

    data = {"parent": parent, "text": text, "api_type": "json"}
    resp = client.oauth_post("/api/comment", data=data)

    json_data = resp.get("json", {})
    errors = json_data.get("errors", [])
    if errors:
        raise RedditApiError("COMMENT_FAILED", str(errors))

    things = json_data.get("data", {}).get("things", [])
    comment_id = things[0]["data"]["id"] if things else None

    return {
        "success": True,
        "comment_id": comment_id,
        "parent": parent,
        "message": "Comment posted successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Post a comment on Reddit")
    parser.add_argument("--cookie", required=True, help="Reddit session cookie")
    parser.add_argument("--parent", required=True, help="Parent fullname (t3_xxx for post, t1_xxx for comment reply)")
    parser.add_argument("--text", required=True, help="Comment text (markdown)")
    args = parser.parse_args()

    try:
        result = post_comment(args.cookie, args.parent, args.text)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except RedditApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
