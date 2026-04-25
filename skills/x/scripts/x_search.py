#!/usr/bin/env python3
"""Search tweets on X (Twitter)."""

import argparse
import json
import sys

import requests
from x_client import FEATURES_TIMELINE, XApiError, XClient, parse_timeline_tweets


def search_tweets(client: XClient, query: str, limit: int = 20, product: str = "Latest") -> dict:
    """Search for tweets matching a query."""
    variables = {
        "rawQuery": query,
        "count": min(limit, 50),
        "querySource": "typed_query",
        "product": product,
    }
    data = client.graphql_get("SearchTimeline", variables, features=FEATURES_TIMELINE)
    instructions = (
        ((data.get("data") or {}).get("search_by_raw_query") or {}).get("search_timeline", {}).get("timeline", {}).get("instructions") or []
    )
    seen: set = set()
    tweets, _ = parse_timeline_tweets(instructions, seen)
    return {
        "query": query,
        "product": product,
        "count": len(tweets[:limit]),
        "tweets": tweets[:limit],
    }


def main():
    parser = argparse.ArgumentParser(description="Search tweets on X")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    parser.add_argument("--type", default="latest", choices=["latest", "top"], help="Result type (default: latest)")
    args = parser.parse_args()

    try:
        client = XClient.create()
        product = "Top" if args.type == "top" else "Latest"
        result = search_tweets(client, args.query, args.limit, product)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
