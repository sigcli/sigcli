#!/usr/bin/env python3
"""Manage messages: mark read/unread, move, delete, flag/unflag via Microsoft Graph."""

import argparse
import json
import sys

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _headers(token):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    return h


def manage_message(graph_token, message_id, action, folder=None):
    base_url = GRAPH_BASE + "/me/messages/" + message_id

    if action == "read":
        resp = requests.patch(base_url, headers=_headers(graph_token), json={"isRead": True}, timeout=15)
    elif action == "unread":
        resp = requests.patch(base_url, headers=_headers(graph_token), json={"isRead": False}, timeout=15)
    elif action == "flag":
        resp = requests.patch(
            base_url, headers=_headers(graph_token), json={"flag": {"flagStatus": "flagged"}}, timeout=15
        )
    elif action == "unflag":
        resp = requests.patch(
            base_url, headers=_headers(graph_token), json={"flag": {"flagStatus": "notFlagged"}}, timeout=15
        )
    elif action == "move":
        if not folder:
            return {"error": "MISSING_ARGS", "message": "--folder is required for move action"}
        resp = requests.post(
            base_url + "/move", headers=_headers(graph_token), json={"destinationId": folder}, timeout=15
        )
    elif action == "delete":
        resp = requests.delete(base_url, headers=_headers(graph_token), timeout=15)
    else:
        return {"error": "INVALID_ACTION", "message": "Unknown action: " + action}

    resp.raise_for_status()

    return {
        "success": True,
        "action": action,
        "messageId": message_id,
    }


def main():
    parser = argparse.ArgumentParser(description="Manage email messages")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--message-id", required=True, help="Message ID")
    parser.add_argument(
        "--action",
        required=True,
        choices=["read", "unread", "move", "delete", "flag", "unflag"],
        help="Action to perform",
    )
    parser.add_argument("--folder", help="Destination folder name or ID (for move)")
    args = parser.parse_args()

    try:
        result = manage_message(args.graph_token, args.message_id, args.action, args.folder)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
