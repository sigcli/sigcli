#!/usr/bin/env python3
"""Create a new topic on V2EX."""

import argparse
import json
import re
import sys

import requests
from v2ex_client import V2EX_BASE, V2exClient, V2exError


def create_topic(cookie, node, title, content, syntax="default"):
    client = V2exClient(cookie)
    client.require_cookie()

    once, _ = client.get_once(V2EX_BASE + "/new/" + node)

    data = {
        "title": title,
        "content": content,
        "node_name": node,
        "syntax": syntax,
        "once": once,
    }

    resp = client.post(V2EX_BASE + "/write", data=data)

    if resp.status_code in (301, 302):
        location = resp.headers.get("Location", "")
        match = re.search(r"/t/(\d+)", location)
        if match:
            topic_id = match.group(1)
            return {
                "success": True,
                "topic_id": int(topic_id),
                "url": V2EX_BASE + "/t/" + topic_id,
                "message": "Topic created successfully",
            }

    if resp.status_code == 200:
        if "你上一次发布主题是在" in resp.text:
            raise V2exError("RATE_LIMITED", "Too soon since last topic — V2EX enforces a cooldown between posts")
        if "请输入主题标题" in resp.text:
            raise V2exError("VALIDATION_ERROR", "Title is required")

    raise V2exError("CREATE_FAILED", f"Unexpected response (HTTP {resp.status_code})")


def main():
    parser = argparse.ArgumentParser(description="Create a new V2EX topic")
    parser.add_argument("--cookie", required=True, help="V2EX session cookie")
    parser.add_argument("--node", required=True, help="Target node name (e.g., python)")
    parser.add_argument("--title", required=True, help="Topic title")
    parser.add_argument("--content", required=True, help="Topic body content")
    parser.add_argument("--syntax", default="default", choices=["default", "markdown"], help="Content syntax")
    args = parser.parse_args()

    try:
        result = create_topic(args.cookie, args.node, args.title, args.content, args.syntax)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except V2exError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
