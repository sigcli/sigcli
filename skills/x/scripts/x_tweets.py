#!/usr/bin/env python3
"""Get a user's recent tweets from X (Twitter)."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from x_client import FEATURES_TIMELINE, FEATURES_USER, XApiError, XClient, parse_timeline_tweets, resolve_username


def get_user_id(client: XClient, username: str) -> str:
    variables = {"screen_name": username, "withSafetyModeUserFields": True}
    data = client.graphql_get("UserByScreenName", variables, features=FEATURES_USER)
    result = (data.get("data") or {}).get("user", {}).get("result")
    if not result:
        raise XApiError("NOT_FOUND", f"User @{username} not found")
    user_id = result.get("rest_id")
    if not user_id:
        raise XApiError("PARSE_ERROR", f"Could not resolve ID for @{username}")
    return user_id


def get_user_tweets(client: XClient, username: str, limit: int = 20) -> dict:
    """Fetch a user's recent tweets."""
    user_id = get_user_id(client, username)
    seen: set = set()
    all_tweets: list = []
    cursor = None

    for _ in range(5):
        if len(all_tweets) >= limit:
            break
        fetch_count = min(100, limit - len(all_tweets) + 10)
        variables: dict = {
            "userId": user_id,
            "count": fetch_count,
            "includePromotedContent": False,
            "withQuickPromoteEligibilityTweetFields": True,
            "withVoice": True,
        }
        if cursor:
            variables["cursor"] = cursor
        data = client.graphql_get("UserTweets", variables, features=FEATURES_TIMELINE)
        instructions = (
            (((data.get("data") or {}).get("user") or {}).get("result") or {}).get("timeline_v2", {}).get("timeline", {}).get("instructions")
            or (((data.get("data") or {}).get("user") or {}).get("result") or {}).get("timeline", {}).get("timeline", {}).get("instructions")
            or []
        )
        tweets, next_cursor = parse_timeline_tweets(instructions, seen)
        all_tweets.extend(tweets)
        if not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor

    return {
        "username": username,
        "user_id": user_id,
        "count": len(all_tweets[:limit]),
        "tweets": all_tweets[:limit],
    }


def main():
    parser = argparse.ArgumentParser(description="Get a user's recent tweets")
    parser.add_argument("--username", required=True, help="Screen name (with or without @)")
    parser.add_argument("--limit", type=int, default=20, help="Max tweets to return (default: 20)")
    args = parser.parse_args()

    try:
        client = XClient.create()
        username = resolve_username(args.username)
        result = get_user_tweets(client, username, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
