#!/usr/bin/env python3
"""Search Xiaohongshu notes."""

import argparse
import json
import sys
import urllib.parse

from xhs_client import XhsClient, XhsApiError


def search_notes(query="", limit=10, sort="general"):
    client = XhsClient()
    client.connect()
    try:
        uri = "/api/sns/web/v1/search/notes"
        payload = {
            "keyword": query,
            "page": 1,
            "page_size": min(limit, 20),
            "search_id": "",
            "sort": sort,
            "note_type": 0,
        }
        result = client.post(uri, payload)
        items = result.get("data", {}).get("items", [])

        notes = []
        for item in items[:limit]:
            card = item.get("note_card", {})
            user = card.get("user", {})
            interact = card.get("interact_info", {})
            notes.append({
                "id": card.get("note_id", item.get("id", "")),
                "title": card.get("display_title", ""),
                "type": card.get("type", ""),
                "author": user.get("nickname", ""),
                "author_id": user.get("user_id", ""),
                "likes": interact.get("liked_count", "0"),
            })

        return {"query": query, "sort": sort, "count": len(notes), "notes": notes}
    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(description="Search Xiaohongshu notes")
    parser.add_argument("--query", required=True, help="Search keyword")
    parser.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--sort", default="general", choices=["general", "time_descending", "popularity_descending"])
    args = parser.parse_args()

    try:
        result = search_notes(args.query, args.limit, args.sort)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump({"error": f"XHS_{e.code}", "message": e.msg}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
