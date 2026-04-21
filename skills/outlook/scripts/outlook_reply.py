#!/usr/bin/env python3
"""Create reply/forward draft via Microsoft Graph (user sends manually from Outlook)."""

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


def _parse_recipients(addresses):
    if not addresses:
        return []
    return [{"emailAddress": {"address": addr.strip()}} for addr in addresses.split(",") if addr.strip()]


def create_reply_draft(graph_token, message_id, action, body, to=None):
    base_url = GRAPH_BASE + "/me/messages/" + message_id
    headers = _headers(graph_token)

    # Create draft
    if action == "forward":
        draft_resp = requests.post(
            base_url + "/createForward", headers=headers, json={"comment": body or ""}, timeout=15
        )
    elif action == "replyAll":
        draft_resp = requests.post(
            base_url + "/createReplyAll", headers=headers, json={"comment": body or ""}, timeout=15
        )
    else:
        draft_resp = requests.post(base_url + "/createReply", headers=headers, json={"comment": body or ""}, timeout=15)
    draft_resp.raise_for_status()
    draft = draft_resp.json()
    draft_id = draft.get("id")

    # Update draft body and recipients if needed
    patch_body = {}
    if body:
        patch_body["body"] = {"contentType": "Text", "content": body}
    if action == "forward" and to:
        patch_body["toRecipients"] = _parse_recipients(to)

    if patch_body:
        patch_resp = requests.patch(
            GRAPH_BASE + "/me/messages/" + draft_id,
            headers=headers,
            json=patch_body,
            timeout=15,
        )
        patch_resp.raise_for_status()
        draft = patch_resp.json()

    result = {
        "success": True,
        "action": action,
        "draftId": draft_id,
        "webLink": draft.get("webLink", ""),
        "originalMessageId": message_id,
        "message": "Draft created. Open Outlook to review and send.",
    }
    if action == "forward" and to:
        result["to"] = [a.strip() for a in to.split(",") if a.strip()]

    return result


def main():
    parser = argparse.ArgumentParser(description="Create reply/forward draft")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--message-id", required=True, help="Original message ID")
    parser.add_argument(
        "--action", required=True, choices=["reply", "replyAll", "forward"], help="Action: reply, replyAll, or forward"
    )
    parser.add_argument("--body", required=True, help="Reply/forward body content")
    parser.add_argument("--to", help="Recipient addresses for forward (comma-separated)")
    args = parser.parse_args()

    try:
        result = create_reply_draft(args.graph_token, args.message_id, args.action, args.body, args.to)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
