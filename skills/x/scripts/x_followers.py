#!/usr/bin/env python3
"""Get followers or following list for an X (Twitter) user."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from x_client import FEATURES_TIMELINE, FEATURES_USER, XApiError, XClient, resolve_username


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


def _parse_user_entries(instructions: list, seen: set) -> tuple[list[dict], str | None]:
    users: list[dict] = []
    next_cursor: str | None = None
    for inst in instructions:
        for entry in inst.get("entries") or []:
            entry_id = entry.get("entryId") or ""
            content = entry.get("content") or {}
            if entry_id.startswith("cursor-bottom-"):
                next_cursor = content.get("value") or (content.get("itemContent") or {}).get("value")
                continue
            if not entry_id.startswith("user-"):
                continue
            item = (content.get("itemContent") or {}).get("user_results", {}).get("result")
            if not item or item.get("__typename") != "User":
                continue
            core = item.get("core") or {}
            legacy = item.get("legacy") or {}
            screen_name = core.get("screen_name") or legacy.get("screen_name") or "unknown"
            if screen_name in seen:
                continue
            seen.add(screen_name)
            users.append({
                "screen_name": screen_name,
                "name": core.get("name") or legacy.get("name") or "",
                "bio": legacy.get("description") or (item.get("profile_bio") or {}).get("description") or "",
                "followers": legacy.get("followers_count") or legacy.get("normal_followers_count") or 0,
            })
    return users, next_cursor


def get_followers(client: XClient, username: str, limit: int = 50, mode: str = "followers") -> dict:
    """Fetch followers or following for a user."""
    client.require_cookie()
    user_id = _get_user_id(client, username)
    operation = "Followers" if mode == "followers" else "Following"
    seen: set = set()
    all_users: list = []
    cursor = None

    for _ in range(5):
        if len(all_users) >= limit:
            break
        variables: dict = {
            "userId": user_id,
            "count": min(50, limit - len(all_users) + 10),
            "includePromotedContent": False,
        }
        if cursor:
            variables["cursor"] = cursor
        data = client.graphql_get(operation, variables, features=FEATURES_TIMELINE)
        instructions = (
            (((data.get("data") or {}).get("user") or {}).get("result") or {}).get("timeline", {}).get("timeline", {}).get("instructions") or []
        )
        users, next_cursor = _parse_user_entries(instructions, seen)
        all_users.extend(users)
        if not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor

    return {
        "username": username,
        "mode": mode,
        "count": len(all_users[:limit]),
        "users": all_users[:limit],
    }


def main():
    parser = argparse.ArgumentParser(description="Get followers or following for an X user")
    parser.add_argument("--username", required=True, help="Screen name (without @)")
    parser.add_argument("--limit", type=int, default=50, help="Max users to return (default: 50)")
    parser.add_argument("--mode", default="followers", choices=["followers", "following"], help="List type (default: followers)")
    args = parser.parse_args()

    try:
        client = XClient.create()
        username = resolve_username(args.username)
        result = get_followers(client, username, args.limit, args.mode)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
