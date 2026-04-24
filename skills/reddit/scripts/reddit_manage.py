#!/usr/bin/env python3
"""Edit or delete a Reddit post or comment."""

import argparse
import json
import sys

import requests
from reddit_client import RedditApiError, RedditClient, to_fullname


def edit_post(cookie: str, target_id: str, text: str) -> dict:
    """Edit the text of a self post or comment."""
    client = RedditClient(cookie)
    client.require_cookie()

    if not target_id.startswith("t1_") and not target_id.startswith("t3_"):
        target_id = to_fullname(target_id, "t3")

    data = {"thing_id": target_id, "text": text, "api_type": "json"}
    resp = client.oauth_post("/api/editusertext", data=data)

    json_data = resp.get("json", {})
    errors = json_data.get("errors", [])
    if errors:
        raise RedditApiError("EDIT_FAILED", str(errors))

    return {
        "success": True,
        "id": target_id,
        "action": "edited",
        "message": "Content edited successfully",
    }


def delete_post(cookie: str, target_id: str) -> dict:
    """Delete a post or comment."""
    client = RedditClient(cookie)
    client.require_cookie()

    if not target_id.startswith("t1_") and not target_id.startswith("t3_"):
        target_id = to_fullname(target_id, "t3")

    client.oauth_post("/api/del", data={"id": target_id})

    return {
        "success": True,
        "id": target_id,
        "action": "deleted",
        "message": "Content deleted successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Edit or delete a Reddit post/comment")
    parser.add_argument("--cookie", required=True, help="Reddit session cookie")
    parser.add_argument("--id", required=True, help="Post/comment ID or fullname")
    parser.add_argument("--action", required=True, choices=["edit", "delete"], help="Action to perform")
    parser.add_argument("--text", default="", help="New text content (required for edit)")
    args = parser.parse_args()

    try:
        if args.action == "edit":
            if not args.text:
                json.dump({"error": "MISSING_ARGS", "message": "--text is required for edit"}, sys.stdout, indent=2)
                return
            result = edit_post(args.cookie, args.id, args.text)
        else:
            result = delete_post(args.cookie, args.id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except RedditApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
