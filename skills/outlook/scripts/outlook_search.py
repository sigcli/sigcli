#!/usr/bin/env python3
"""Search emails using KQL via Microsoft Graph."""

import argparse
import json
import sys
import urllib.parse

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

SELECT_FIELDS = "id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments,importance"


def _headers(token):
    h = {
        "Content-Type": "application/json",
        "Prefer": 'outlook.body-content-type="text"',
    }
    if token:
        h["Authorization"] = "Bearer " + token
    return h


def _format_address(addr):
    ea = addr.get("emailAddress", {})
    return {"name": ea.get("name", ""), "address": ea.get("address", "")}


def search_messages(graph_token, query, folder=None, limit=20):
    if folder:
        base = GRAPH_BASE + "/me/mailFolders/" + urllib.parse.quote(folder, safe="") + "/messages"
    else:
        base = GRAPH_BASE + "/me/messages"

    params = {
        "$search": '"' + query + '"',
        "$select": SELECT_FIELDS,
        "$top": str(min(limit, 50)),
    }

    resp = requests.get(base, headers=_headers(graph_token), params=params, timeout=15)
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
        "query": query,
        "folder": folder,
        "hasMore": "@odata.nextLink" in data,
        "messages": messages,
    }


def main():
    parser = argparse.ArgumentParser(description="Search emails with KQL")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--query", required=True, help="KQL search query (e.g. from:jane subject:report)")
    parser.add_argument("--folder", help="Restrict to folder (optional)")
    parser.add_argument("--limit", type=int, default=20, help="Max results (default: 20, max: 50)")
    args = parser.parse_args()

    try:
        result = search_messages(args.graph_token, args.query, args.folder, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
