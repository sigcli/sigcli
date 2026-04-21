#!/usr/bin/env python3
"""Get messages from a Teams conversation."""

import argparse
import json
import re
import sys
import urllib.parse
import requests

import os

DEFAULT_REGION = "apac"


def _get_chat_base(region: str) -> str:
    return f"https://teams.cloud.microsoft/api/chatsvc/{region}/v1/users/ME"


def _headers(token: str) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "")


def get_messages(token: str, conversation_id: str, search: str = None,
                 limit: int = 50, since: str = None, until: str = None, region: str = DEFAULT_REGION) -> dict:
    chat_base = _get_chat_base(region)
    encoded_id = urllib.parse.quote(conversation_id, safe="")
    fetch_limit = min(max(limit * 2, 100), 200) if search or since or until else min(limit, 200)
    url = f"{chat_base}/conversations/{encoded_id}/messages?pageSize={fetch_limit}"

    resp = requests.get(url, headers=_headers(token), timeout=15)
    resp.raise_for_status()

    messages = resp.json().get("messages", [])
    results = []

    for m in messages:
        compose_time = m.get("composetime", "")
        content = _strip_html(m.get("content", ""))
        sender = m.get("imdisplayname", "")
        msg_type = m.get("messagetype", "")

        # Skip system messages
        if msg_type not in ("Text", "RichText/Html", "RichText/Media_CallRecording"):
            continue

        if since and compose_time and compose_time < since:
            continue
        if until and compose_time and compose_time > until:
            continue
        if search and search.lower() not in content.lower():
            continue

        results.append({
            "id": m.get("id", ""),
            "time": compose_time,
            "sender": sender,
            "content": content[:500],
            "type": msg_type,
        })

        if len(results) >= limit:
            break

    return {"conversationId": conversation_id, "count": len(results), "messages": results}


def main():
    parser = argparse.ArgumentParser(description="Get messages from Teams conversation")
    parser.add_argument("--token", required=False, default="", help="Teams Chat API Bearer token (omit when using sig proxy)")
    parser.add_argument("--conversation-id", required=True, help="Conversation ID")
    parser.add_argument("--search", help="Filter messages by content")
    parser.add_argument("--limit", type=int, default=50, help="Max messages (default: 50)")
    parser.add_argument("--since", help="Only messages after this ISO date")
    parser.add_argument("--until", help="Only messages before this ISO date")
    parser.add_argument("--region", default=os.environ.get("TEAMS_REGION", DEFAULT_REGION),
                        help="Teams region (default: $TEAMS_REGION or 'apac')")
    args = parser.parse_args()

    try:
        result = get_messages(args.token, args.conversation_id, args.search,
                              args.limit, args.since, args.until, args.region)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
