#!/usr/bin/env python3
"""Get V2EX notifications."""

import argparse
import json
import sys

import requests
from v2ex_client import V2EX_BASE, V2exClient, V2exError, parse_notifications_page


def get_notifications(cookie, page=1):
    client = V2exClient(cookie)
    client.require_cookie()

    url = V2EX_BASE + "/notifications"
    if page > 1:
        url += "?p=" + str(page)

    resp = client.get(url)
    notifications = parse_notifications_page(resp.text)

    return {
        "page": page,
        "count": len(notifications),
        "notifications": notifications,
    }


def main():
    parser = argparse.ArgumentParser(description="Get V2EX notifications")
    parser.add_argument("--cookie", required=True, help="V2EX session cookie")
    parser.add_argument("--page", type=int, default=1, help="Page number (default: 1)")
    args = parser.parse_args()

    try:
        result = get_notifications(args.cookie, args.page)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except V2exError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
