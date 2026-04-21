#!/usr/bin/env python3
"""Send a message or threaded reply in Teams."""

import argparse
import json
import os
import sys
import urllib.parse

import requests

DEFAULT_REGION = "apac"


def _get_chat_base(region: str) -> str:
    return f"https://teams.cloud.microsoft/api/chatsvc/{region}/v1/users/ME"


def _headers(token: str) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def send_message(token: str, conversation_id: str, message: str,
                 fmt: str = "html", parent_message_id: str = None, region: str = DEFAULT_REGION) -> dict:
    chat_base = _get_chat_base(region)
    encoded_id = urllib.parse.quote(conversation_id, safe="")

    if parent_message_id:
        encoded_parent = urllib.parse.quote(parent_message_id, safe="")
        url = f"{chat_base}/conversations/{encoded_id};messageid={encoded_parent}/messages"
    else:
        url = f"{chat_base}/conversations/{encoded_id}/messages"

    msg_type = "RichText/Html" if fmt == "html" else "Text"
    payload = {
        "content": message,
        "messagetype": msg_type,
        "contenttype": "text",
    }

    resp = requests.post(url, headers=_headers(token), json=payload, timeout=15)
    resp.raise_for_status()

    data = resp.json()
    return {
        "success": True,
        "messageId": data.get("id", ""),
        "conversationId": conversation_id,
        "isReply": parent_message_id is not None,
    }


def main():
    parser = argparse.ArgumentParser(description="Send Teams message or reply")
    parser.add_argument("--token", required=False, default="", help="Teams Chat API Bearer token (omit when using sig proxy)")
    parser.add_argument("--conversation-id", required=True, help="Conversation ID")
    parser.add_argument("--message", required=True, help="Message content")
    parser.add_argument("--format", choices=["html", "markdown"], default="html",
                        help="Message format (default: html)")
    parser.add_argument("--parent-message-id", help="Parent message ID for threaded reply")
    parser.add_argument("--region", default=os.environ.get("TEAMS_REGION", DEFAULT_REGION),
                        help="Teams region (default: $TEAMS_REGION or 'apac')")
    args = parser.parse_args()

    try:
        result = send_message(args.token, args.conversation_id, args.message,
                              args.format, args.parent_message_id, args.region)
        json.dump(result, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
