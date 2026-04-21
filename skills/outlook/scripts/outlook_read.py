#!/usr/bin/env python3
"""Read full email message via Microsoft Graph."""

import argparse
import html
import json
import re
import sys

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _headers(token):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    return h


def _html_to_text(content):
    if not content:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", content, flags=re.IGNORECASE)
    text = re.sub(r"</(?:p|div|li|tr|h[1-6])>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _format_address(addr):
    ea = addr.get("emailAddress", {})
    return {"name": ea.get("name", ""), "address": ea.get("address", "")}


def read_message(graph_token, message_id, fmt="text"):
    url = (
        GRAPH_BASE
        + "/me/messages/"
        + message_id
        + "?$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,replyTo,"
        "receivedDateTime,sentDateTime,body,hasAttachments,importance,isRead,"
        "conversationId,flag" + "&$expand=attachments($select=id,name,contentType,size,isInline)"
    )
    resp = requests.get(url, headers=_headers(graph_token), timeout=15)
    resp.raise_for_status()

    m = resp.json()
    body_obj = m.get("body", {})
    body_content = body_obj.get("content", "")
    body_type = body_obj.get("contentType", "text")

    if fmt == "text" and body_type.lower() == "html":
        body_content = _html_to_text(body_content)

    attachments = []
    for a in m.get("attachments", []):
        attachments.append(
            {
                "id": a.get("id", ""),
                "name": a.get("name", ""),
                "contentType": a.get("contentType", ""),
                "size": a.get("size", 0),
                "isInline": a.get("isInline", False),
            }
        )

    return {
        "id": m.get("id", ""),
        "subject": m.get("subject", ""),
        "from": _format_address(m.get("from", {})),
        "to": [_format_address(r) for r in m.get("toRecipients", [])],
        "cc": [_format_address(r) for r in m.get("ccRecipients", [])],
        "bcc": [_format_address(r) for r in m.get("bccRecipients", [])],
        "replyTo": [_format_address(r) for r in m.get("replyTo", [])],
        "receivedDateTime": m.get("receivedDateTime", ""),
        "sentDateTime": m.get("sentDateTime", ""),
        "body": body_content,
        "bodyFormat": fmt,
        "isRead": m.get("isRead", True),
        "importance": m.get("importance", "normal"),
        "conversationId": m.get("conversationId", ""),
        "hasAttachments": m.get("hasAttachments", False),
        "attachments": attachments,
        "flag": (m.get("flag") or {}).get("flagStatus", "notFlagged"),
    }


def main():
    parser = argparse.ArgumentParser(description="Read full email message")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--message-id", required=True, help="Message ID")
    parser.add_argument(
        "--format", choices=["text", "html"], default="text", help="Body format: text (default) or html"
    )
    args = parser.parse_args()

    try:
        result = read_message(args.graph_token, args.message_id, args.format)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
