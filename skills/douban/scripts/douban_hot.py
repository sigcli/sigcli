#!/usr/bin/env python3
"""Get hot, now-showing, or coming-soon movies from Douban."""

import argparse
import json
import sys

import requests
from douban_client import DoubanClient, parse_movie

CATEGORY_PATHS = {
    "hot": "/movie/hot_gird",
    "showing": "/movie/movie_showing",
    "coming": "/movie/movie_soon",
}


def get_hot(category="hot", limit=20):
    client = DoubanClient()
    path = CATEGORY_PATHS.get(category, CATEGORY_PATHS["hot"])
    data = client.frodo_get(path, params={"start": 0, "count": min(limit, 50)})
    items = data.get("items") or data.get("subject_collection_items") or []
    movies = [parse_movie(m) for m in items if m]
    return {
        "category": category,
        "count": len(movies),
        "movies": movies,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Douban hot/showing/coming movies")
    parser.add_argument("--category", default="hot", choices=["hot", "showing", "coming"], help="Movie category (default: hot)")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    args = parser.parse_args()

    try:
        result = get_hot(args.category, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
