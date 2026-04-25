#!/usr/bin/env python3
"""Get explore/home feed from Xiaohongshu."""

import argparse
import json
import sys

import requests
from xhs_client import XHS_WEB, XhsApiError, XhsClient, error_response, parse_initial_state, parse_note_card


def get_feed(client: XhsClient, limit: int = 20) -> dict:
    """Fetch the explore page feed via SSR HTML parsing."""
    url = f"{XHS_WEB}/explore"
    html = client.fetch_html(url)
    state = parse_initial_state(html)

    feed_state = state.get("feed") or {}
    feeds = feed_state.get("feeds") or feed_state.get("items") or []

    notes = []
    for item in feeds[:limit]:
        notes.append(parse_note_card(item))

    return {
        "source": "explore",
        "count": len(notes),
        "notes": notes,
    }


def main():
    parser = argparse.ArgumentParser(description="Get explore feed from Xiaohongshu")
    parser.add_argument("--limit", type=int, default=20, help="Max notes to return (default: 20)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = get_feed(client, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump(error_response(f"HTTP_{e.response.status_code}", str(e)), sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
