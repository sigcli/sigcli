#!/usr/bin/env python3
"""Get Xiaohongshu note detail by ID.

Usage:
    python3 xhs_note.py --note-id <id> --xsec-token <token> [--xsec-source pc_search]
"""

from __future__ import annotations

import argparse
import json
import sys

from xhs_client import XhsApiError, XhsClient, error_response, parse_note_detail

FEED_PATH = "/api/sns/web/v1/feed"


def get_note(
    client: XhsClient,
    note_id: str,
    xsec_token: str,
    xsec_source: str = "pc_search",
) -> dict:
    """Fetch and parse a note detail."""
    payload = {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"},
        "xsec_source": xsec_source,
        "xsec_token": xsec_token,
    }
    data = client.post(FEED_PATH, payload)
    items = data.get("items", [])
    if not items:
        raise XhsApiError("NOT_FOUND", f"Note {note_id} not found")
    note_card = items[0].get("note_card", {})
    return parse_note_detail(note_card)


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu note detail")
    parser.add_argument("--note-id", required=True, help="Note ID")
    parser.add_argument("--xsec-token", required=True, help="xsec_token from search results")
    parser.add_argument("--xsec-source", default="pc_search", help="xsec_source (default: pc_search)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = get_note(client, args.note_id, args.xsec_token, args.xsec_source)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2)


if __name__ == "__main__":
    main()
