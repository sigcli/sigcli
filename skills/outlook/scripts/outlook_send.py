#!/usr/bin/env python3
"""Create an email draft via Microsoft Graph (user sends manually from Outlook)."""

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


def create_draft(graph_token, to, subject, body, cc=None, bcc=None, body_type="text", importance="normal"):
    message = {
        "subject": subject,
        "body": {
            "contentType": "HTML" if body_type == "html" else "Text",
            "content": body,
        },
        "toRecipients": _parse_recipients(to),
        "importance": importance,
        "isDraft": True,
    }
    if cc:
        message["ccRecipients"] = _parse_recipients(cc)
    if bcc:
        message["bccRecipients"] = _parse_recipients(bcc)

    resp = requests.post(
        GRAPH_BASE + "/me/messages",
        headers=_headers(graph_token),
        json=message,
        timeout=15,
    )
    resp.raise_for_status()

    draft = resp.json()
    to_list = [a.strip() for a in to.split(",") if a.strip()]
    return {
        "success": True,
        "draftId": draft.get("id", ""),
        "webLink": draft.get("webLink", ""),
        "to": to_list,
        "cc": [a.strip() for a in (cc or "").split(",") if a.strip()],
        "subject": subject,
        "message": "Draft created. Open Outlook to review and send.",
    }


def main():
    parser = argparse.ArgumentParser(description="Create an email draft")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--to", required=True, help="Comma-separated recipient email addresses")
    parser.add_argument("--subject", required=True, help="Email subject")
    parser.add_argument("--body", required=True, help="Email body content")
    parser.add_argument("--cc", help="Comma-separated CC addresses")
    parser.add_argument("--bcc", help="Comma-separated BCC addresses")
    parser.add_argument(
        "--body-type", choices=["text", "html"], default="text", help="Body format: text (default) or html"
    )
    parser.add_argument(
        "--importance", choices=["low", "normal", "high"], default="normal", help="Importance level (default: normal)"
    )
    args = parser.parse_args()

    try:
        result = create_draft(
            args.graph_token,
            args.to,
            args.subject,
            args.body,
            cc=args.cc,
            bcc=args.bcc,
            body_type=args.body_type,
            importance=args.importance,
        )
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
