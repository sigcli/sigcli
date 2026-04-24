#!/usr/bin/env python3
"""Get Zhihu topic detail and best content."""

import argparse
import json
import sys

import requests
from zhihu_client import ZHIHU_API_V4, ZhihuClient, parse_topic


def get_topic(topic_id, include_essence=False, limit=10, cookie=""):
    client = ZhihuClient(cookie)
    resp = client.get(f"{ZHIHU_API_V4}/topics/{topic_id}")
    topic = parse_topic(resp.json())

    result = {"topic": topic}

    if include_essence:
        resp = client.get(f"{ZHIHU_API_V4}/topics/{topic_id}/feeds/essence", params={"limit": limit, "offset": 0})
        essence_data = resp.json()
        items = []
        for entry in essence_data.get("data", []):
            target = entry.get("target", {})
            items.append({
                "id": target.get("id"),
                "type": target.get("type", ""),
                "title": target.get("title") or target.get("question", {}).get("title", ""),
                "excerpt": target.get("excerpt", ""),
                "voteup_count": target.get("voteup_count", 0),
            })
        result["essence"] = items

    return result


def main():
    parser = argparse.ArgumentParser(description="Get Zhihu topic detail")
    parser.add_argument("--cookie", default="", help="Zhihu session cookie (optional)")
    parser.add_argument("--id", required=True, help="Topic ID")
    parser.add_argument("--include-essence", action="store_true", help="Also fetch topic best content")
    parser.add_argument("--limit", type=int, default=10, help="Max essence items (default: 10)")
    args = parser.parse_args()

    try:
        result = get_topic(args.id, args.include_essence, args.limit, args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
