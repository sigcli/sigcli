#!/usr/bin/env python3
"""Submit a story to Hacker News."""

import argparse
import json
import sys

import requests
from hn_client import HnApiError, HnClient


def submit_story(client: HnClient, title: str, url: str = "", text: str = "") -> dict:
    return client.submit(title, url, text)


def main():
    parser = argparse.ArgumentParser(description="Submit a story to Hacker News")
    parser.add_argument("--cookie", required=True, help="HN session cookie")
    parser.add_argument("--title", required=True, help="Story title")
    parser.add_argument("--url", default="", help="URL to submit (for link posts)")
    parser.add_argument("--text", default="", help="Text body (for Ask HN / text posts)")
    args = parser.parse_args()
    try:
        client = HnClient(args.cookie)
        result = submit_story(client, args.title, args.url, args.text)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except HnApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
