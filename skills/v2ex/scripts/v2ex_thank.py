#!/usr/bin/env python3
"""Thank a V2EX topic or reply (costs coins, irreversible)."""

import argparse
import json
import sys

import requests
from v2ex_client import V2EX_BASE, V2exClient, V2exError


def thank(cookie, target_type, target_id):
    client = V2exClient(cookie)
    client.require_cookie()

    once, _ = client.get_once()

    if target_type == "topic":
        url = V2EX_BASE + "/thank/topic/" + str(target_id) + "?once=" + once
    elif target_type == "reply":
        url = V2EX_BASE + "/thank/reply/" + str(target_id) + "?once=" + once
    else:
        raise V2exError("INVALID_TYPE", "Type must be 'topic' or 'reply'")

    resp = client.post(url)

    if resp.status_code == 200:
        try:
            data = resp.json()
            if data.get("success"):
                return {
                    "success": True,
                    "type": target_type,
                    "id": int(target_id),
                    "message": f"Thanked {target_type} successfully",
                }
        except ValueError:
            pass

    if resp.status_code in (200, 302):
        return {
            "success": True,
            "type": target_type,
            "id": int(target_id),
            "message": f"Thanked {target_type} (or already thanked)",
        }

    raise V2exError("THANK_FAILED", f"Unexpected response (HTTP {resp.status_code})")


def main():
    parser = argparse.ArgumentParser(description="Thank a V2EX topic or reply")
    parser.add_argument("--cookie", required=True, help="V2EX session cookie")
    parser.add_argument("--type", required=True, choices=["topic", "reply"], help="Target type")
    parser.add_argument("--id", required=True, help="Topic ID or Reply ID")
    args = parser.parse_args()

    try:
        result = thank(args.cookie, args.type, args.id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except V2exError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
