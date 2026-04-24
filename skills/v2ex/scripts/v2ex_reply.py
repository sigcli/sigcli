#!/usr/bin/env python3
"""Reply to a V2EX topic."""

import argparse
import json
import sys

import requests

from v2ex_client import V2EX_BASE, V2exClient, V2exError


def reply_topic(cookie, topic_id, content):
    client = V2exClient(cookie)
    client.require_cookie()

    topic_url = V2EX_BASE + "/t/" + str(topic_id)
    once, _ = client.get_once(topic_url)

    data = {
        "content": content,
        "once": once,
    }

    resp = client.post(topic_url, data=data)

    if resp.status_code in (301, 302):
        return {
            "success": True,
            "topic_id": int(topic_id),
            "url": topic_url,
            "message": "Reply posted successfully",
        }

    if resp.status_code == 200:
        if "你上一次回复是在" in resp.text:
            raise V2exError("RATE_LIMITED", "Too soon since last reply — V2EX enforces a cooldown")

    raise V2exError("REPLY_FAILED", f"Unexpected response (HTTP {resp.status_code})")


def main():
    parser = argparse.ArgumentParser(description="Reply to a V2EX topic")
    parser.add_argument("--cookie", required=True, help="V2EX session cookie")
    parser.add_argument("--topic-id", required=True, help="Topic ID to reply to")
    parser.add_argument("--content", required=True, help="Reply content")
    args = parser.parse_args()

    try:
        result = reply_topic(args.cookie, args.topic_id, args.content)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except V2exError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
