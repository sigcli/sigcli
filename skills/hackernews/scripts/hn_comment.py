#!/usr/bin/env python3
"""Post a comment on Hacker News."""

import argparse
import json
import sys

import requests
from hn_client import HnApiError, HnClient


def post_comment(client: HnClient, parent_id: int, text: str) -> dict:
    return client.comment(parent_id, text)


def main():
    parser = argparse.ArgumentParser(description="Post a comment on Hacker News")
    parser.add_argument("--cookie", required=True, help="HN session cookie")
    parser.add_argument("--parent", required=True, type=int, help="Parent item ID (story or comment)")
    parser.add_argument("--text", required=True, help="Comment text")
    args = parser.parse_args()
    try:
        client = HnClient(args.cookie)
        result = post_comment(client, args.parent, args.text)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except HnApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
