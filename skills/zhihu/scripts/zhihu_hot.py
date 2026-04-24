#!/usr/bin/env python3
"""Get Zhihu hot list (知乎热榜)."""

import argparse
import json
import sys

import requests
from zhihu_client import ZHIHU_HOT_LIST_URL, ZhihuClient


def get_hot(cookie="", limit=50):
    client = ZhihuClient(cookie)
    resp = client.get(ZHIHU_HOT_LIST_URL, params={"limit": limit})
    data = resp.json()
    items = []
    for entry in data.get("data", []):
        target = entry.get("target", {})
        items.append({
            "id": target.get("id"),
            "title": target.get("title", ""),
            "excerpt": target.get("excerpt", ""),
            "heat": entry.get("detail_text", ""),
            "answer_count": target.get("answer_count", 0),
        })
    return {"count": len(items), "items": items}


def main():
    parser = argparse.ArgumentParser(description="Get Zhihu hot list")
    parser.add_argument("--cookie", default="", help="Zhihu session cookie (optional)")
    parser.add_argument("--limit", type=int, default=50, help="Max items (default: 50)")
    args = parser.parse_args()

    try:
        result = get_hot(args.cookie, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
