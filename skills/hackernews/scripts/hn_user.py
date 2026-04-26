#!/usr/bin/env python3
"""Get a Hacker News user profile and optional submissions."""

import argparse
import json
import sys

import requests
from hn_client import HN_API_BASE, fetch_items, parse_user


def get_user(username, include_submissions=False):
    """Fetch a user profile and optionally their recent submissions."""
    resp = requests.get(f"{HN_API_BASE}/user/{username}.json", timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if not data:
        return {"error": "NOT_FOUND", "message": f"User '{username}' not found"}
    user = parse_user(data)
    result = {"user": user}
    if include_submissions:
        submitted_ids = data.get("submitted", [])[:30]
        result["submissions"] = fetch_items(submitted_ids, limit=30)
    return result


def main():
    parser = argparse.ArgumentParser(description="Get Hacker News user profile")
    parser.add_argument("--username", required=True, help="HN username")
    parser.add_argument("--include-submissions", action="store_true", help="Also fetch recent submissions")
    args = parser.parse_args()

    try:
        result = get_user(args.username, args.include_submissions)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
