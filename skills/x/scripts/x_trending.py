#!/usr/bin/env python3
"""Get trending topics from X (Twitter)."""

import argparse
import json
import sys

import requests
from x_client import XApiError, XClient


def get_trending(client: XClient, limit: int = 20) -> dict:
    """Fetch trending topics via the guide API."""
    client.require_cookie()
    url = "https://x.com/i/api/2/guide.json"
    params = {"include_page_configuration": "true"}
    data = client._get(url, params=params)

    instructions = (data.get("timeline") or {}).get("instructions") or []
    trends: list[dict] = []
    for inst in instructions:
        entries = inst.get("addEntries", {}).get("entries") or inst.get("entries") or []
        for entry in entries:
            module = (entry.get("content") or {}).get("timelineModule")
            if not module:
                continue
            for item in module.get("items") or []:
                trend = ((item.get("item") or {}).get("content") or {}).get("trend")
                if not trend:
                    continue
                tweet_count = trend.get("tweetCount")
                category = ((trend.get("trendMetadata") or {}).get("domainContext")) or ""
                trends.append({
                    "rank": len(trends) + 1,
                    "topic": trend.get("name") or "",
                    "tweets": str(tweet_count) if tweet_count else "N/A",
                    "category": category,
                })

    return {
        "count": len(trends[:limit]),
        "trends": trends[:limit],
    }


def main():
    parser = argparse.ArgumentParser(description="Get trending topics on X")
    parser.add_argument("--limit", type=int, default=20, help="Number of trends (default: 20)")
    args = parser.parse_args()

    try:
        client = XClient.create()
        result = get_trending(client, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
