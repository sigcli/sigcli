#!/usr/bin/env python3
"""Find or create a Teams chat (1:1 or group)."""

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

GUID_RE = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", re.IGNORECASE)


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


def _get_my_user_id(token: str) -> str:
    """Get current user's GUID from Graph API."""
    resp = requests.get(f"{GRAPH_BASE}/me", headers=_graph_headers(token), timeout=15)
    resp.raise_for_status()
    return resp.json().get("id", "")


def _search_people(graph_token: str, query: str) -> list:
    """Search for users by name or email."""
    encoded = urllib.parse.quote(f'"{query}"')
    url = f"{GRAPH_BASE}/me/people?$search={encoded}&$top=5"
    resp = requests.get(url, headers=_graph_headers(graph_token), timeout=15)
    resp.raise_for_status()
    results = []
    for u in resp.json().get("value", []):
        uid = u.get("id", "")
        if not GUID_RE.match(uid):
            continue
        results.append({
            "id": uid,
            "name": u.get("displayName", ""),
            "email": (u.get("scoredEmailAddresses") or [{}])[0].get("address", ""),
        })
    return results


def _thread_exists(chat_token: str, thread_id: str, chat_base: str) -> bool:
    encoded = urllib.parse.quote(thread_id, safe="")
    url = f"{chat_base}/threads/{encoded}?view=msnp24Equivalent"
    try:
        resp = requests.get(url, headers=_chat_headers(chat_token), timeout=10)
        return resp.ok
    except Exception:
        return False


def find_private_chat(chat_token: str, graph_token: str, query: str, region: str = DEFAULT_REGION) -> dict:
    """Find 1:1 private chat with a person."""
    chat_base = _get_chat_base(region)
    people = _search_people(graph_token, query)
    if not people:
        return {"error": "NOT_FOUND", "message": f"No user found matching '{query}'"}

    my_id = _get_my_user_id(graph_token)

    # Filter out self
    candidates = [p for p in people if p["id"] != my_id]
    if not candidates:
        return {"error": "NOT_FOUND", "message": "Only found yourself in results"}

    if len(candidates) == 1:
        target = candidates[0]
        # Try both orderings for 1:1 chat ID
        for id1, id2 in [(my_id, target["id"]), (target["id"], my_id)]:
            chat_id = f"19:{id1}_{id2}@unq.gbl.spaces"
            if _thread_exists(chat_token, chat_id, chat_base):
                return {"found": True, "conversationId": chat_id, "person": target}
        return {"found": False, "person": target, "message": "No existing 1:1 chat. Use teams_send.py after creating chat."}

    return {"found": False, "candidates": candidates, "message": "Multiple matches. Specify a more exact name."}


def create_group_chat(chat_token: str, graph_token: str, member_ids: list, topic: str = None, region: str = DEFAULT_REGION) -> dict:
    """Create a group chat with multiple members."""
    my_id = _get_my_user_id(graph_token)
    members = [{"id": f"8:orgid:{my_id}", "role": "Admin"}]
    for mid in member_ids:
        members.append({"id": f"8:orgid:{mid}", "role": "User"})

    payload = {"members": members, "properties": {"threadType": "chat"}}
    if topic:
        payload["properties"]["topic"] = topic

    chat_base = _get_chat_base(region)
    url = f"{chat_base}/threads"
    resp = requests.post(url, headers=_chat_headers(chat_token), json=payload, timeout=15)
    resp.raise_for_status()

    data = resp.json()
    chat_id = data.get("id") or resp.headers.get("Location", "").split("?")[0].rsplit("/", 1)[-1]
    return {"success": True, "conversationId": chat_id}


def main():
    parser = argparse.ArgumentParser(description="Find or create Teams chat")
    parser.add_argument("--token", required=False, default="", help="Teams Chat API Bearer token (omit when using sig proxy)")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--query", help="Person name/email to find 1:1 chat")
    parser.add_argument("--members", help="Comma-separated user GUIDs for group chat")
    parser.add_argument("--topic", help="Group chat topic (optional)")
    parser.add_argument("--region", default=os.environ.get("TEAMS_REGION", DEFAULT_REGION),
                        help="Teams region (default: $TEAMS_REGION or 'apac')")
    args = parser.parse_args()

    try:
        if args.query:
            result = find_private_chat(args.token, args.graph_token, args.query, args.region)
        elif args.members:
            member_list = [m.strip() for m in args.members.split(",")]
            result = create_group_chat(args.token, args.graph_token, member_list, args.topic, args.region)
        else:
            result = {"error": "MISSING_ARGS", "message": "Either --query or --members is required"}
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
