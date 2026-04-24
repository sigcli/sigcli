#!/usr/bin/env python3
"""Get latest topics from V2EX."""

import argparse
import json
import sys

import requests

from v2ex_client import V2exClient, parse_topic_item


def get_latest(cookie=""):
    client = V2exClient(cookie)
    topics = client.api_v1("/topics/latest.json")
    return {
        "count": len(topics),
        "topics": [parse_topic_item(t) for t in topics],
    }


def main():
    parser = argparse.ArgumentParser(description="Get V2EX latest topics")
    parser.add_argument("--cookie", default="", help="V2EX session cookie (optional)")
    args = parser.parse_args()

    try:
        result = get_latest(args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
