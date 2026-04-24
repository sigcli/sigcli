#!/usr/bin/env python3
"""Get topic detail and replies from V2EX."""

import argparse
import json
import sys

import requests
from v2ex_client import V2EX_BASE, V2exClient, parse_reply_item, parse_topic_item, parse_topic_page


def get_topic(topic_id, page=1, cookie=""):
    client = V2exClient(cookie)

    if cookie:
        url = V2EX_BASE + "/t/" + str(topic_id)
        if page > 1:
            url += "?p=" + str(page)
        resp = client.get(url)
        topic, replies = parse_topic_page(resp.text)
        topic["id"] = int(topic_id)
        topic["url"] = V2EX_BASE + "/t/" + str(topic_id)
        return {
            "topic": topic,
            "replies": {"page": page, "count": len(replies), "items": replies},
        }

    topic_data = client.api_v1("/topics/show.json", params={"id": topic_id})
    topic = parse_topic_item(topic_data[0]) if topic_data else {}

    replies_data = client.api_v1("/replies/show.json", params={"topic_id": topic_id, "page": page, "page_size": 100})
    replies = [parse_reply_item(r) for r in replies_data]

    return {
        "topic": topic,
        "replies": {"page": page, "count": len(replies), "items": replies},
    }


def main():
    parser = argparse.ArgumentParser(description="Get V2EX topic detail and replies")
    parser.add_argument("--cookie", default="", help="V2EX session cookie (optional)")
    parser.add_argument("--id", required=True, help="Topic ID")
    parser.add_argument("--page", type=int, default=1, help="Reply page (default: 1)")
    args = parser.parse_args()

    try:
        result = get_topic(args.id, args.page, args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
