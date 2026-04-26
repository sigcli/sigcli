#!/usr/bin/env python3
"""Get top stories from Hacker News."""

import argparse
import json
import sys

import requests
from hn_client import HN_API_BASE, fetch_items


def get_top(limit=30):
    """Fetch top story IDs and return detailed items."""
    resp = requests.get(f"{HN_API_BASE}/topstories.json", timeout=15)
    resp.raise_for_status()
    ids = resp.json()
    stories = fetch_items(ids, limit)
    return {
        "count": len(stories),
        "stories": stories,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Hacker News top stories")
    parser.add_argument("--limit", type=int, default=30, help="Max stories to fetch (default: 30)")
    args = parser.parse_args()

    try:
        result = get_top(args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
