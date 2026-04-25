#!/usr/bin/env python3
"""Search notes on Xiaohongshu."""

import argparse
import json
import sys

import requests
from xhs_client import XHS_WEB, XhsApiError, XhsClient, error_response, parse_initial_state, parse_note_card


def search_notes(client: XhsClient, keyword: str, limit: int = 20) -> dict:
    """Search notes by keyword via SSR HTML parsing."""
    url = f"{XHS_WEB}/search_result?keyword={requests.utils.quote(keyword)}&source=web_search_result_notes"

    html = client.fetch_html(url)
    state = parse_initial_state(html)

    search_state = state.get("search") or {}
    feeds = search_state.get("feeds") or search_state.get("notes") or []

    notes = []
    for item in feeds[:limit]:
        notes.append(parse_note_card(item))

    return {
        "keyword": keyword,
        "count": len(notes),
        "notes": notes,
    }


def main():
    parser = argparse.ArgumentParser(description="Search notes on Xiaohongshu")
    parser.add_argument("--keyword", required=True, help="Search keyword")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = search_notes(client, args.keyword, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump(error_response(f"HTTP_{e.response.status_code}", str(e)), sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
