#!/usr/bin/env python3
"""Get user profile and notes from Xiaohongshu."""

from __future__ import annotations

import argparse
import json
import sys

import requests
from xhs_client import XHS_WEB, XhsApiError, XhsClient, error_response, parse_initial_state, parse_user_id


def get_user(client: XhsClient, user_input: str, include_notes: bool = True) -> dict:
    """Fetch a user profile by ID or URL via SSR HTML parsing."""
    user_id = parse_user_id(user_input)
    url = f"{XHS_WEB}/user/profile/{user_id}"

    html = client.fetch_html(url)
    state = parse_initial_state(html)

    user_state = state.get("user") or {}
    page_data = user_state.get("userPageData") or user_state.get("user_page_data") or {}

    basic_info = page_data.get("basicInfo") or page_data.get("basic_info") or {}
    interactions = page_data.get("interactions") or []

    interaction_map = {}
    for item in interactions:
        interaction_map[item.get("type") or item.get("name", "")] = item.get("count", "0")

    result = {
        "user_id": user_id,
        "nickname": basic_info.get("nickname", ""),
        "desc": basic_info.get("desc", ""),
        "gender": basic_info.get("gender", ""),
        "ip_location": basic_info.get("ipLocation") or basic_info.get("ip_location", ""),
        "avatar": basic_info.get("imageb") or basic_info.get("image", ""),
        "follows": interaction_map.get("follows", "0"),
        "fans": interaction_map.get("fans", "0"),
        "interaction": interaction_map.get("interaction", "0"),
    }

    if include_notes:
        raw_notes = user_state.get("notes") or []
        notes = _flatten_notes(raw_notes, user_id)
        result["notes"] = notes
        result["note_count"] = len(notes)

    return result


def _flatten_notes(raw_notes, user_id: str) -> list[dict]:
    """Flatten nested note groups from user state."""
    notes = []
    items = raw_notes if isinstance(raw_notes, list) else []
    for group in items:
        if isinstance(group, list):
            for item in group:
                notes.append(_parse_user_note(item, user_id))
        elif isinstance(group, dict):
            notes.append(_parse_user_note(group, user_id))
    return notes


def _parse_user_note(item: dict, user_id: str) -> dict:
    card = item.get("noteCard") or item.get("note_card") or item
    interact = card.get("interactInfo") or card.get("interact_info") or {}
    note_id = item.get("noteId") or item.get("note_id") or item.get("id") or ""
    xsec_token = item.get("xsecToken") or item.get("xsec_token") or ""
    url = f"{XHS_WEB}/user/profile/{user_id}/{note_id}"
    if xsec_token:
        url += f"?xsec_token={xsec_token}&xsec_source=pc_user"
    return {
        "note_id": note_id,
        "title": card.get("displayTitle") or card.get("display_title") or "",
        "type": card.get("type", ""),
        "likes": _norm(interact.get("likedCount") or interact.get("liked_count") or "0"),
        "url": url,
    }


def _norm(val) -> str:
    if isinstance(val, int):
        return str(val)
    s = str(val).strip()
    return "0" if not s or s in ("赞",) else s


def main():
    parser = argparse.ArgumentParser(description="Get user profile from Xiaohongshu")
    parser.add_argument("--id", required=True, help="User ID or profile URL")
    parser.add_argument("--no-notes", action="store_true", help="Skip fetching user notes")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = get_user(client, args.id, include_notes=not args.no_notes)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump(error_response(f"HTTP_{e.response.status_code}", str(e)), sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
