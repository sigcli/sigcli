#!/usr/bin/env python3
"""Get a single tweet with its thread/replies from X (Twitter)."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from x_client import FEATURES_TWEET_DETAIL, FIELD_TOGGLES_TWEET_DETAIL, XApiError, XClient, parse_timeline_tweets, resolve_tweet_id


def get_tweet(client: XClient, tweet_id: str, limit: int = 50) -> dict:
    """Fetch a tweet and its conversation thread."""
    seen: set = set()
    all_tweets: list = []
    cursor = None

    for _ in range(5):
        variables: dict = {
            "focalTweetId": tweet_id,
            "referrer": "tweet",
            "with_rux_injections": False,
            "includePromotedContent": False,
            "rankingMode": "Recency",
            "withCommunity": True,
            "withQuickPromoteEligibilityTweetFields": True,
            "withBirdwatchNotes": True,
            "withVoice": True,
        }
        if cursor:
            variables["cursor"] = cursor
        data = client.graphql_get("TweetDetail", variables, features=FEATURES_TWEET_DETAIL, field_toggles=FIELD_TOGGLES_TWEET_DETAIL)
        instructions = (
            (data.get("data") or {}).get("threaded_conversation_with_injections_v2", {}).get("instructions")
            or ((data.get("data") or {}).get("tweetResult", {}).get("result", {}).get("timeline", {}).get("instructions"))
            or []
        )
        tweets, next_cursor = parse_timeline_tweets(instructions, seen)
        all_tweets.extend(tweets)
        if not next_cursor or next_cursor == cursor:
            break
        cursor = next_cursor

    return {
        "tweet_id": tweet_id,
        "count": len(all_tweets[:limit]),
        "tweets": all_tweets[:limit],
    }


def main():
    parser = argparse.ArgumentParser(description="Get a tweet with its thread")
    parser.add_argument("--id", required=True, help="Tweet ID or URL")
    parser.add_argument("--limit", type=int, default=50, help="Max tweets in thread (default: 50)")
    args = parser.parse_args()

    try:
        client = XClient.create()
        tweet_id = resolve_tweet_id(args.id)
        result = get_tweet(client, tweet_id, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
