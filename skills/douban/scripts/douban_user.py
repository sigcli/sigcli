#!/usr/bin/env python3
"""Get Douban user profile."""

import argparse
import json
import sys

import requests
from douban_client import DoubanClient, parse_user


def get_user(uid):
    client = DoubanClient()
    data = client.frodo_get(f"/user/{uid}")
    user = parse_user(data)
    return {"user": user}


def main():
    parser = argparse.ArgumentParser(description="Get Douban user profile")
    parser.add_argument("--uid", required=True, help="Douban user uid or numeric ID")
    args = parser.parse_args()

    try:
        result = get_user(args.uid)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
