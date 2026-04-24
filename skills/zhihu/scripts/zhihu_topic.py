#!/usr/bin/env python3
"""Get Zhihu topic info via search."""

import argparse
import json
import sys

import requests
from zhihu_client import ZHIHU_API_V4, ZhihuClient


def search_topic(query, limit=10, cookie=""):
    client = ZhihuClient(cookie)
    params = {"q": query, "t": "topic", "limit": limit, "offset": 0}
    resp = client.get(f"{ZHIHU_API_V4}/search_v3", params=params)
    data = resp.json()

    topics = []
    for item in data.get("data", []):
        obj = item.get("object", {})
        topics.append({
            "id": obj.get("id"),
            "name": obj.get("name", ""),
            "introduction": obj.get("introduction", ""),
            "followers_count": obj.get("followers_count", 0),
            "questions_count": obj.get("questions_count", 0),
            "avatar_url": obj.get("avatar_url", ""),
        })

    return {"count": len(topics), "topics": topics}


def main():
    parser = argparse.ArgumentParser(description="Search Zhihu topics")
    parser.add_argument("--cookie", default="", help="Zhihu session cookie (optional)")
    parser.add_argument("--query", required=True, help="Topic search query")
    parser.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    args = parser.parse_args()

    try:
        result = search_topic(args.query, args.limit, args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
