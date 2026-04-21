#!/usr/bin/env python3
"""List or search Teams conversations."""

import argparse
import json
import os
import re
import sys

import requests

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


def list_conversations(token: str, search: str = None, limit: int = 20,
                       since: str = None, until: str = None, region: str = DEFAULT_REGION) -> dict:
    chat_base = _get_chat_base(region)
    url = f"{chat_base}/conversations?view=msnp24Equivalent&pageSize={min(limit * 2, 200)}"
    resp = requests.get(url, headers=_headers(token), timeout=15)
    resp.raise_for_status()

    conversations = resp.json().get("conversations", [])
    results = []

    for c in conversations:
        props = c.get("threadProperties", {})
        last_msg = c.get("lastMessage", {})
        compose_time = last_msg.get("composetime", "")

        # Time filtering
        if since and compose_time and compose_time < since:
            continue
        if until and compose_time and compose_time > until:
            continue

        topic = props.get("topic") or props.get("spaceThreadTopic") or ""
        content = _strip_html(last_msg.get("content", ""))
        sender = last_msg.get("imdisplayname", "")

        # Search filtering
        if search:
            search_lower = search.lower()
            if not any(search_lower in x.lower() for x in [topic, content, sender]):
                continue

        results.append({
            "id": c.get("id", ""),
            "type": c.get("conversationType", ""),
            "topic": topic,
            "lastMessage": content[:200],
            "lastSender": sender,
            "lastTime": compose_time,
        })

        if len(results) >= limit:
            break

    return {"count": len(results), "conversations": results}


def main():
    parser = argparse.ArgumentParser(description="List/search Teams conversations")
    parser.add_argument("--token", required=False, default="", help="Teams Chat API Bearer token (omit when using sig proxy)")
    parser.add_argument("--search", help="Filter by topic, content, or sender")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20)")
    parser.add_argument("--since", help="Only activity after this ISO date")
    parser.add_argument("--until", help="Only activity before this ISO date")
    parser.add_argument("--region", default=os.environ.get("TEAMS_REGION", DEFAULT_REGION),
                        help="Teams region (default: $TEAMS_REGION or 'apac')")
    args = parser.parse_args()

    try:
        result = list_conversations(args.token, args.search, args.limit, args.since, args.until, args.region)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else "Unknown"
        json.dump({"error": f"HTTP_{status}", "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
