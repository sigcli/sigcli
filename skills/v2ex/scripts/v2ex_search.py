#!/usr/bin/env python3
"""Search V2EX topics via SOV2EX full-text search."""

import argparse
import json
import sys

import requests
from v2ex_client import SOV2EX_API


def search(query, size=20, sort="sumup", node=None, username=None):
    params = {"q": query, "size": min(size, 50), "sort": sort, "order": 0}
    if node:
        params["node"] = node
    if username:
        params["username"] = username

    resp = requests.get(SOV2EX_API, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    hits = []
    for h in data.get("hits", []):
        source = h.get("_source", {})
        hits.append(
            {
                "id": source.get("id"),
                "title": source.get("title", ""),
                "content_preview": (source.get("content", "") or "")[:200],
                "node": source.get("node"),
                "member": source.get("member"),
                "replies": source.get("replies", 0),
                "created": source.get("created"),
            }
        )

    return {
        "total": data.get("total", 0),
        "took": data.get("took", 0),
        "count": len(hits),
        "hits": hits,
    }


def main():
    parser = argparse.ArgumentParser(description="Search V2EX topics")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--size", type=int, default=20, help="Max results (default: 20)")
    parser.add_argument("--sort", default="sumup", choices=["sumup", "created"], help="Sort by (default: sumup)")
    parser.add_argument("--node", help="Filter by node name")
    parser.add_argument("--username", help="Filter by author")
    args = parser.parse_args()

    try:
        result = search(args.query, args.size, args.sort, args.node, args.username)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "SEARCH_ERROR", "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
