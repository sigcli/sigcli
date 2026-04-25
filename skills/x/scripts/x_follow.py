#!/usr/bin/env python3
"""Follow or unfollow a user on X (Twitter)."""

import argparse
import json
import sys

import requests
from x_client import FEATURES_USER, XApiError, XClient, resolve_username


def _get_user_id(client: XClient, username: str) -> str:
    variables = {"screen_name": username, "withSafetyModeUserFields": True}
    data = client.graphql_get("UserByScreenName", variables, features=FEATURES_USER)
    result = (data.get("data") or {}).get("user", {}).get("result")
    if not result:
        raise XApiError("NOT_FOUND", f"User @{username} not found")
    user_id = result.get("rest_id")
    if not user_id:
        raise XApiError("PARSE_ERROR", f"Could not resolve ID for @{username}")
    return user_id


def follow_user(cookie: str, username: str, undo: bool = False) -> dict:
    """Follow or unfollow a user."""
    client = XClient(cookie)
    client.require_cookie()

    user_id = _get_user_id(client, username)

    if undo:
        path = "/i/api/1.1/friendships/destroy.json"
    else:
        path = "/i/api/1.1/friendships/create.json"

    client.rest_post(path, data={"user_id": user_id})

    action = "unfollowed" if undo else "followed"
    return {
        "success": True,
        "username": username,
        "user_id": user_id,
        "action": action,
        "message": f"Successfully {action} @{username}",
    }


def main():
    parser = argparse.ArgumentParser(description="Follow or unfollow a user on X")
    parser.add_argument("--cookie", required=True, help="X session cookie")
    parser.add_argument("--username", required=True, help="Screen name (without @)")
    parser.add_argument("--undo", action="store_true", help="Unfollow instead of follow")
    args = parser.parse_args()

    try:
        username = resolve_username(args.username)
        result = follow_user(args.cookie, username, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
