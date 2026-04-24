#!/usr/bin/env python3
"""Append a supplement to an existing V2EX topic."""

import argparse
import json
import sys

import requests

from v2ex_client import V2EX_BASE, V2exClient, V2exError


def append_topic(cookie, topic_id, content):
    client = V2exClient(cookie)
    client.require_cookie()

    append_url = V2EX_BASE + "/append/topic/" + str(topic_id)
    once, _ = client.get_once(V2EX_BASE + "/t/" + str(topic_id))

    data = {
        "content": content,
        "once": once,
    }

    resp = client.post(append_url, data=data)

    if resp.status_code in (301, 302):
        return {
            "success": True,
            "topic_id": int(topic_id),
            "url": V2EX_BASE + "/t/" + str(topic_id),
            "message": "Supplement appended successfully",
        }

    if resp.status_code == 200:
        if "不是你创建的主题" in resp.text:
            raise V2exError("NOT_OWNER", "You can only append to your own topics")

    raise V2exError("APPEND_FAILED", f"Unexpected response (HTTP {resp.status_code})")


def main():
    parser = argparse.ArgumentParser(description="Append supplement to a V2EX topic")
    parser.add_argument("--cookie", required=True, help="V2EX session cookie")
    parser.add_argument("--topic-id", required=True, help="Topic ID to append to")
    parser.add_argument("--content", required=True, help="Supplement content")
    args = parser.parse_args()

    try:
        result = append_topic(args.cookie, args.topic_id, args.content)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except V2exError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
