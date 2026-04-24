#!/usr/bin/env python3
"""Favorite or unfavorite a V2EX topic or node."""

import argparse
import json
import sys

import requests
from v2ex_client import V2EX_BASE, V2exClient, V2exError


def favorite(cookie, target_type, target_id, undo=False):
    client = V2exClient(cookie)
    client.require_cookie()

    once, _ = client.get_once()

    action = "unfavorite" if undo else "favorite"

    if target_type == "topic":
        url = V2EX_BASE + "/" + action + "/topic/" + str(target_id) + "?once=" + once
    elif target_type == "node":
        url = V2EX_BASE + "/" + action + "/node/" + str(target_id) + "?once=" + once
    else:
        raise V2exError("INVALID_TYPE", "Type must be 'topic' or 'node'")

    client.get(url)

    return {
        "success": True,
        "action": action,
        "type": target_type,
        "id": int(target_id),
        "message": f"{'Unfavorited' if undo else 'Favorited'} {target_type} successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Favorite/unfavorite a V2EX topic or node")
    parser.add_argument("--cookie", required=True, help="V2EX session cookie")
    parser.add_argument("--type", required=True, choices=["topic", "node"], help="Target type")
    parser.add_argument("--id", required=True, help="Topic ID or Node ID")
    parser.add_argument("--undo", action="store_true", help="Unfavorite instead")
    args = parser.parse_args()

    try:
        result = favorite(args.cookie, args.type, args.id, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except V2exError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
