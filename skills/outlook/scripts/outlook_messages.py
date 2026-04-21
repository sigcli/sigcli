#!/usr/bin/env python3
"""List messages from a mail folder via Microsoft Graph."""

import argparse
import json
import sys
import urllib.parse

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

SELECT_FIELDS = "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments,importance"


def _headers(token):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    return h


def _format_address(addr):
    ea = addr.get("emailAddress", {})
    return {"name": ea.get("name", ""), "address": ea.get("address", "")}


def list_messages(graph_token, folder="Inbox", limit=20, since=None, until=None, unread_only=False):
    filters = []
    if since:
        iso = since + "T00:00:00Z" if "T" not in since else since
        filters.append("receivedDateTime ge " + iso)
    if until:
        iso = until + "T23:59:59Z" if "T" not in until else until
        filters.append("receivedDateTime le " + iso)
    if unread_only:
        filters.append("isRead eq false")

    params = {
        "$select": SELECT_FIELDS,
        "$orderby": "receivedDateTime desc",
        "$top": str(min(limit, 50)),
    }
    if filters:
        params["$filter"] = " and ".join(filters)

    url = GRAPH_BASE + "/me/mailFolders/" + urllib.parse.quote(folder, safe="") + "/messages"
    resp = requests.get(url, headers=_headers(graph_token), params=params, timeout=15)
    resp.raise_for_status()

    data = resp.json()
    messages = []
    for m in data.get("value", []):
        messages.append(
            {
                "id": m.get("id", ""),
                "subject": m.get("subject", ""),
                "from": _format_address(m.get("from", {})),
                "to": [_format_address(r) for r in m.get("toRecipients", [])],
                "receivedDateTime": m.get("receivedDateTime", ""),
                "bodyPreview": (m.get("bodyPreview", "") or "")[:200],
                "isRead": m.get("isRead", True),
                "hasAttachments": m.get("hasAttachments", False),
                "importance": m.get("importance", "normal"),
            }
        )

    return {
        "count": len(messages),
        "folder": folder,
        "hasMore": "@odata.nextLink" in data,
        "messages": messages,
    }


def main():
    parser = argparse.ArgumentParser(description="List messages from a mail folder")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--folder", default="Inbox", help="Folder name or ID (default: Inbox)")
    parser.add_argument("--limit", type=int, default=20, help="Max messages (default: 20, max: 50)")
    parser.add_argument("--since", help="Only messages after this date (YYYY-MM-DD or ISO)")
    parser.add_argument("--until", help="Only messages before this date (YYYY-MM-DD or ISO)")
    parser.add_argument("--unread-only", action="store_true", help="Only show unread messages")
    args = parser.parse_args()

    try:
        result = list_messages(args.graph_token, args.folder, args.limit, args.since, args.until, args.unread_only)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
