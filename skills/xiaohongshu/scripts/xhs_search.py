#!/usr/bin/env python3
"""Search Xiaohongshu notes by keyword.

Usage:
    python3 xhs_search.py --keyword "旅行" [--limit 10] [--page 1] [--sort general] [--note-type 0]

Sort options: general (default), popularity, time
Note type: 0=all (default), 1=image, 2=video
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time

from xhs_client import XhsApiError, XhsClient, error_response, parse_note_brief

SEARCH_PATH = "/api/sns/web/v1/search/notes"
ONEBOX_PATH = "/api/sns/web/v1/search/onebox"
FILTER_PATH = "/api/sns/web/v1/search/filter"

SORT_MAP = {
    "general": "general",
    "popularity": "popularity_descending",
    "time": "time_descending",
}

# Default filters matching the web client behavior
_SEARCH_DEFAULT_FILTERS = [
    {"tags": ["general"], "type": "sort_type"},
    {"tags": ["\u4e0d\u9650"], "type": "filter_note_type"},
    {"tags": ["\u4e0d\u9650"], "type": "filter_note_time"},
    {"tags": ["\u4e0d\u9650"], "type": "filter_note_range"},
    {"tags": ["\u4e0d\u9650"], "type": "filter_pos_distance"},
]


def _generate_search_id() -> str:
    """Generate a unique search ID (base36 of timestamp << 64 + random)."""
    e = int(time.time() * 1000) << 64
    t = random.randint(0, 2147483646)
    num = e + t

    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if num == 0:
        return "0"
    result = ""
    while num > 0:
        result = alphabet[num % 36] + result
        num //= 36
    return result


def _search_request_id() -> str:
    return f"{random.randint(1_000_000_000, 2_147_483_647)}-{int(time.time() * 1000)}"


def _prewarm_search(client: XhsClient, keyword: str, search_id: str) -> None:
    """Initialize search session with onebox + filter calls (required for first search)."""
    try:
        client.post(ONEBOX_PATH, {
            "keyword": keyword,
            "search_id": search_id,
            "biz_type": "web_search_user",
            "request_id": _search_request_id(),
        })
    except XhsApiError:
        pass  # Prewarm failure is non-fatal

    try:
        client.get(FILTER_PATH, {"keyword": keyword, "search_id": search_id})
    except XhsApiError:
        pass  # Prewarm failure is non-fatal


def search_notes(
    client: XhsClient,
    keyword: str,
    page: int = 1,
    page_size: int = 20,
    sort: str = "general",
    note_type: int = 0,
    search_id: str = "",
) -> dict:
    """Search notes and return parsed results."""
    if not search_id:
        search_id = _generate_search_id()
        _prewarm_search(client, keyword, search_id)

    # XHS API requires page_size >= 10; fetch at least 20 and trim client-side
    request_size = max(page_size, 20)
    payload = {
        "keyword": keyword,
        "page": page,
        "page_size": request_size,
        "search_id": search_id,
        "sort": SORT_MAP.get(sort, sort),
        "note_type": note_type,
        "ext_flags": [],
        "filters": _SEARCH_DEFAULT_FILTERS,
        "geo": "",
        "image_formats": ["jpg", "webp", "avif"],
    }
    data = client.post(SEARCH_PATH, payload)
    items = data.get("items", [])
    notes = [parse_note_brief(item) for item in items if item.get("model_type") == "note"]
    # Trim to requested limit
    if len(notes) > page_size:
        notes = notes[:page_size]
    return {
        "keyword": keyword,
        "notes": notes,
        "has_more": data.get("has_more", False),
        "search_id": search_id,
    }


def main():
    parser = argparse.ArgumentParser(description="Search Xiaohongshu notes")
    parser.add_argument("--keyword", required=True, help="Search keyword")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1)")
    parser.add_argument("--sort", default="general", choices=["general", "popularity", "time"], help="Sort order")
    parser.add_argument("--note-type", type=int, default=0, choices=[0, 1, 2], help="0=all, 1=image, 2=video")
    parser.add_argument("--search-id", default="", help="Search ID for pagination (from previous results)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = search_notes(
            client,
            keyword=args.keyword,
            page=args.page,
            page_size=args.limit,
            sort=args.sort,
            note_type=args.note_type,
            search_id=args.search_id,
        )
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
