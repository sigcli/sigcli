#!/usr/bin/env python3
"""Get a Hacker News item with its comment tree."""

import argparse
import json
import sys

import requests
from hn_client import HN_API_BASE, parse_item


def fetch_comment_tree(item_id, depth, comments_limit, current_depth=0, counter=None):
    """Recursively fetch a comment and its replies up to *depth* levels."""
    if counter is None:
        counter = [0]
    if counter[0] >= comments_limit:
        return None
    resp = requests.get(f"{HN_API_BASE}/item/{item_id}.json", timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data or data.get("deleted") or data.get("dead"):
        return None
    counter[0] += 1
    comment = {
        "id": data.get("id"),
        "by": data.get("by", ""),
        "text": data.get("text", ""),
        "time": data.get("time"),
        "replies": [],
    }
    if current_depth < depth:
        for kid_id in data.get("kids", []):
            if counter[0] >= comments_limit:
                break
            reply = fetch_comment_tree(kid_id, depth, comments_limit, current_depth + 1, counter)
            if reply:
                comment["replies"].append(reply)
    return comment


def get_item(item_id, depth=2, comments_limit=20):
    """Fetch an item and its comment tree."""
    resp = requests.get(f"{HN_API_BASE}/item/{item_id}.json", timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data:
        return {"error": "NOT_FOUND", "message": f"Item {item_id} not found"}
    item = parse_item(data)
    comments = []
    counter = [0]
    for kid_id in data.get("kids", []):
        if counter[0] >= comments_limit:
            break
        comment = fetch_comment_tree(kid_id, depth, comments_limit, current_depth=1, counter=counter)
        if comment:
            comments.append(comment)
    return {
        "item": item,
        "comments": comments,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Hacker News item with comments")
    parser.add_argument("--id", required=True, help="Item ID")
    parser.add_argument("--depth", type=int, default=2, help="Max comment tree depth (default: 2)")
    parser.add_argument("--comments-limit", type=int, default=20, help="Max comments to fetch (default: 20)")
    args = parser.parse_args()

    try:
        result = get_item(args.id, args.depth, args.comments_limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
