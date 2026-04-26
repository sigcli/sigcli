#!/usr/bin/env python3
"""Get best stories from Hacker News, with support for Ask HN, Show HN, and Jobs."""

import argparse
import json
import sys

import requests
from hn_client import HN_API_BASE, fetch_items

STORY_TYPE_ENDPOINTS = {
    "best": "/beststories.json",
    "ask": "/askstories.json",
    "show": "/showstories.json",
    "job": "/jobstories.json",
}


def get_best(limit=30, story_type="best"):
    """Fetch story IDs for the given type and return detailed items."""
    endpoint = STORY_TYPE_ENDPOINTS.get(story_type, "/beststories.json")
    resp = requests.get(f"{HN_API_BASE}{endpoint}", timeout=15)
    resp.raise_for_status()
    ids = resp.json()
    stories = fetch_items(ids, limit)
    return {
        "type": story_type,
        "count": len(stories),
        "stories": stories,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Hacker News best/ask/show/job stories")
    parser.add_argument("--limit", type=int, default=30, help="Max stories to fetch (default: 30)")
    parser.add_argument("--type", dest="story_type", default="best", choices=["best", "ask", "show", "job"], help="Story type (default: best)")
    args = parser.parse_args()

    try:
        result = get_best(args.limit, args.story_type)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
