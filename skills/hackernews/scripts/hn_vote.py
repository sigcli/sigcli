#!/usr/bin/env python3
"""Upvote a Hacker News item."""

import argparse
import json
import sys

import requests
from hn_client import HnApiError, HnClient


def upvote_item(client: HnClient, item_id: int) -> dict:
    return client.upvote(item_id)


def main():
    parser = argparse.ArgumentParser(description="Upvote a Hacker News item")
    parser.add_argument("--cookie", required=True, help="HN session cookie")
    parser.add_argument("--id", required=True, type=int, help="Item ID to upvote")
    args = parser.parse_args()
    try:
        client = HnClient(args.cookie)
        result = upvote_item(client, args.id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except HnApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
