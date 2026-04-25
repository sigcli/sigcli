#!/usr/bin/env python3
"""Get comments on a Bilibili video."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient, parse_comment


def get_comments(client: BilibiliClient, bvid: str, limit: int = 20, page: int = 1) -> dict:
    """Fetch comments for a video by BV ID."""
    view = client.get("/x/web-interface/view", params={"bvid": bvid})
    if view.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Cannot resolve video: {view.get('message', 'unknown')}")
    aid = view.get("data", {}).get("aid")
    if not aid:
        raise BilibiliApiError("API_ERROR", f"Cannot resolve aid for bvid: {bvid}")

    payload = client.get("/x/v2/reply", params={"type": 1, "oid": aid, "pn": page, "ps": limit})
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    replies = payload.get("data", {}).get("replies", []) or []
    comments = [parse_comment(r) for r in replies[:limit]]
    total = payload.get("data", {}).get("page", {}).get("count", 0)
    return {
        "bvid": bvid,
        "aid": aid,
        "total": total,
        "page": page,
        "count": len(comments),
        "comments": comments,
    }


def main():
    parser = argparse.ArgumentParser(description="Get comments on a Bilibili video")
    parser.add_argument("--bvid", required=True, help="Video BV ID (e.g. BV1xx411c7mD)")
    parser.add_argument("--limit", type=int, default=20, help="Max comments to return (default: 20)")
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1)")
    args = parser.parse_args()

    try:
        client = BilibiliClient.create()
        result = get_comments(client, args.bvid, args.limit, args.page)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
