#!/usr/bin/env python3
"""Search Hacker News via the Algolia API."""

import argparse
import json
import sys

import requests
from hn_client import ALGOLIA_BASE


def search(query, search_type=None, sort="relevance", limit=30, author=None, points_min=None):
    """Search HN via Algolia and return normalized results."""
    endpoint = "/search_by_date" if sort == "date" else "/search"
    params = {"query": query, "hitsPerPage": min(limit, 50)}

    tags = []
    if search_type:
        tags.append(search_type)
    if author:
        tags.append(f"author_{author}")
    if tags:
        params["tags"] = ",".join(tags)

    if points_min is not None:
        params["numericFilters"] = f"points>{points_min}"

    resp = requests.get(f"{ALGOLIA_BASE}{endpoint}", params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    hits = []
    for h in data.get("hits", []):
        hits.append({
            "id": h.get("objectID"),
            "title": h.get("title", ""),
            "url": h.get("url", ""),
            "author": h.get("author", ""),
            "points": h.get("points", 0),
            "num_comments": h.get("num_comments", 0),
            "created_at": h.get("created_at", ""),
            "story_text": (h.get("story_text") or "")[:200],
        })

    return {
        "total": data.get("nbHits", 0),
        "count": len(hits),
        "hits": hits,
    }


def main():
    parser = argparse.ArgumentParser(description="Search Hacker News via Algolia")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--type", dest="search_type", choices=["story", "comment", "ask_hn", "show_hn"], help="Filter by type")
    parser.add_argument("--sort", default="relevance", choices=["relevance", "date"], help="Sort order (default: relevance)")
    parser.add_argument("--limit", type=int, default=30, help="Max results (default: 30)")
    parser.add_argument("--author", help="Filter by author username")
    parser.add_argument("--points-min", type=int, help="Minimum points filter")
    args = parser.parse_args()

    try:
        result = search(args.query, args.search_type, args.sort, args.limit, args.author, args.points_min)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "SEARCH_ERROR", "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
