#!/usr/bin/env python3
"""Search Douban movies, books, and music."""

import argparse
import json
import sys

import requests
from douban_client import DoubanClient, parse_book, parse_movie, parse_music

PARSERS = {
    "movie": parse_movie,
    "book": parse_book,
    "music": parse_music,
}


def search(query, search_type="movie", limit=20):
    client = DoubanClient()
    data = client.frodo_get("/search", params={"q": query, "type": search_type, "start": 0, "count": min(limit, 50)})
    items = []
    for entry in data.get("items", []):
        target_type = entry.get("target_type", "")
        target = entry.get("target")
        parser = PARSERS.get(target_type)
        if parser and target:
            parsed = parser(target)
            if parsed:
                parsed["target_type"] = target_type
                items.append(parsed)
    return {
        "total": data.get("total", 0),
        "count": len(items),
        "items": items,
    }


def main():
    parser = argparse.ArgumentParser(description="Search Douban movies/books/music")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--type", default="movie", choices=["movie", "book", "music"], help="Content type (default: movie)")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    args = parser.parse_args()

    try:
        result = search(args.query, args.type, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
