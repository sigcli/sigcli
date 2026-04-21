#!/usr/bin/env python3
"""Get members of a Teams conversation."""

import argparse
import json
import os
import re
import sys
import urllib.parse

import requests

DEFAULT_REGION = "apac"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _get_chat_base(region: str) -> str:
    return f"https://teams.cloud.microsoft/api/chatsvc/{region}/v1"


def _chat_headers(token: str) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _graph_headers(token: str) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _extract_guid(member_id: str) -> str:
    m = re.search(r"orgid:([a-f0-9-]+)", member_id, re.IGNORECASE)
    return m.group(1) if m else member_id.split(":")[-1]


def _get_user_name(graph_token: str, user_id: str) -> str:
    try:
        resp = requests.get(f"{GRAPH_BASE}/users/{user_id}", headers=_graph_headers(graph_token), timeout=10)
        if resp.ok:
            return resp.json().get("displayName", user_id)
    except Exception:
        pass
    return user_id


def get_members(chat_token: str, graph_token: str, conversation_id: str, region: str = DEFAULT_REGION) -> dict:
    chat_base = _get_chat_base(region)
    encoded_id = urllib.parse.quote(conversation_id, safe="")
    url = f"{chat_base}/threads/{encoded_id}?view=msnp24Equivalent"
    resp = requests.get(url, headers=_chat_headers(chat_token), timeout=15)
    resp.raise_for_status()

    raw_members = resp.json().get("members", [])
    members = []
    for m in raw_members:
        guid = _extract_guid(m.get("id", ""))
        name = _get_user_name(graph_token, guid) if graph_token else guid
        members.append({
            "id": guid,
            "name": name,
            "role": m.get("role", ""),
        })

    return {"conversationId": conversation_id, "count": len(members), "members": members}


def main():
    parser = argparse.ArgumentParser(description="Get Teams conversation members")
    parser.add_argument("--token", required=False, default="", help="Teams Chat API Bearer token (omit when using sig proxy)")
    parser.add_argument("--graph-token", default="", help="Graph API Bearer token (for name resolution)")
    parser.add_argument("--conversation-id", required=True, help="Conversation ID")
    parser.add_argument("--region", default=os.environ.get("TEAMS_REGION", DEFAULT_REGION),
                        help="Teams region (default: $TEAMS_REGION or 'apac')")
    args = parser.parse_args()

    try:
        result = get_members(args.token, args.graph_token or None, args.conversation_id, args.region)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
