#!/usr/bin/env python3
"""List and download email attachments via Microsoft Graph."""

import argparse
import base64
import json
import os
import sys

import requests

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _headers(token):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = "Bearer " + token
    return h


def list_attachments(graph_token, message_id):
    url = GRAPH_BASE + "/me/messages/" + message_id + "/attachments?$select=id,name,contentType,size,isInline"
    resp = requests.get(url, headers=_headers(graph_token), timeout=15)
    resp.raise_for_status()

    attachments = []
    for a in resp.json().get("value", []):
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
        "messageId": message_id,
        "count": len(attachments),
        "attachments": attachments,
    }


def download_attachment(graph_token, message_id, attachment_id, output_dir="/tmp"):
    url = GRAPH_BASE + "/me/messages/" + message_id + "/attachments/" + attachment_id
    resp = requests.get(url, headers=_headers(graph_token), timeout=30)
    resp.raise_for_status()

    data = resp.json()
    filename = data.get("name", "attachment")
    content_bytes = data.get("contentBytes", "")

    if not content_bytes:
        return {"error": "NO_CONTENT", "message": "Attachment has no downloadable content"}

    file_path = os.path.join(output_dir, filename)
    counter = 1
    base, ext = os.path.splitext(file_path)
    while os.path.exists(file_path):
        file_path = base + "_" + str(counter) + ext
        counter += 1

    os.makedirs(output_dir, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(base64.b64decode(content_bytes))

    return {
        "success": True,
        "fileName": os.path.basename(file_path),
        "filePath": file_path,
        "size": data.get("size", 0),
    }


def main():
    parser = argparse.ArgumentParser(description="List or download email attachments")
    parser.add_argument("--graph-token", required=False, default="", help="Graph API Bearer token (omit when using sig proxy)")
    parser.add_argument("--message-id", required=True, help="Message ID")
    parser.add_argument("--download", help="Attachment ID to download")
    parser.add_argument("--output-dir", default="/tmp", help="Directory for downloaded file (default: /tmp)")
    args = parser.parse_args()

    try:
        if args.download:
            result = download_attachment(args.graph_token, args.message_id, args.download, args.output_dir)
        else:
            result = list_attachments(args.graph_token, args.message_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
