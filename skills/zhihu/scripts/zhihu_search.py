#!/usr/bin/env python3
"""Search Zhihu for questions, topics, or people."""

import argparse
import json
import sys

import requests
from zhihu_client import ZHIHU_API_V4, ZhihuClient


def search(query, search_type="general", limit=20, cookie=""):
    client = ZhihuClient(cookie)
    params = {"q": query, "t": search_type, "limit": limit, "offset": 0}
    resp = client.get(f"{ZHIHU_API_V4}/search_v3", params=params)
    data = resp.json()

    results = []
    for item in data.get("data", []):
        obj = item.get("object", {})
        results.append({
            "type": item.get("type", ""),
            "object": {
                "id": obj.get("id"),
                "title": obj.get("title") or obj.get("name", ""),
                "excerpt": obj.get("excerpt", ""),
                "url": obj.get("url", ""),
            },
        })

    paging = data.get("paging", {})
    return {
        "total": paging.get("totals", len(results)),
        "count": len(results),
        "results": results,
    }


def main():
    parser = argparse.ArgumentParser(description="Search Zhihu")
    parser.add_argument("--cookie", default="", help="Zhihu session cookie (optional)")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--type", default="general", choices=["general", "topic", "people"], help="Search type (default: general)")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    args = parser.parse_args()

    try:
        result = search(args.query, args.type, args.limit, args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
