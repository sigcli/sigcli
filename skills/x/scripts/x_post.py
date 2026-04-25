#!/usr/bin/env python3
"""Create a tweet on X (Twitter)."""

import argparse
import json
import sys

import requests
from x_client import FEATURES_TIMELINE, XApiError, XClient


def create_tweet(cookie: str, text: str, reply_to: str = "") -> dict:
    """Post a new tweet or reply."""
    client = XClient(cookie)
    client.require_cookie()

    variables: dict = {
        "tweet_text": text,
        "dark_request": False,
        "media": {"media_entities": [], "possibly_sensitive": False},
        "semantic_annotation_ids": [],
    }
    if reply_to:
        variables["reply"] = {
            "in_reply_to_tweet_id": reply_to,
            "exclude_reply_user_ids": [],
        }

    data = client.graphql_post("CreateTweet", variables, features=FEATURES_TIMELINE)
    result = (data.get("data") or {}).get("create_tweet", {}).get("tweet_results", {}).get("result")
    if not result:
        raise XApiError("POST_FAILED", "Tweet creation failed — check response or try again")

    tweet_id = result.get("rest_id") or ""
    return {
        "success": True,
        "tweet_id": tweet_id,
        "text": text,
        "url": f"https://x.com/i/status/{tweet_id}" if tweet_id else "",
        "message": "Tweet posted successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Create a tweet on X")
    parser.add_argument("--cookie", required=True, help="X session cookie")
    parser.add_argument("--text", required=True, help="Tweet text content")
    parser.add_argument("--reply-to", default="", help="Tweet ID to reply to (optional)")
    args = parser.parse_args()

    try:
        result = create_tweet(args.cookie, args.text, args.reply_to)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
