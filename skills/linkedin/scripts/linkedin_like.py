#!/usr/bin/env python3
"""Like or unlike a LinkedIn post."""

import argparse
import json
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient


def like_post(client: LinkedInClient, urn: str, undo: bool = False) -> dict:
    if undo:
        client.voyager_post("/voyagerSocialDashReactions", json_data={"action": "UNREACT", "entityUrn": urn})
        return {"success": True, "urn": urn, "action": "unliked", "message": "Post unliked"}
    payload = {"entityUrn": urn, "reactionType": "LIKE"}
    client.voyager_post("/voyagerSocialDashReactions", json_data=payload)
    return {"success": True, "urn": urn, "action": "liked", "message": "Post liked"}


def main():
    parser = argparse.ArgumentParser(description="Like or unlike a LinkedIn post")
    parser.add_argument("--cookie", required=True, help="LinkedIn session cookie")
    parser.add_argument("--urn", required=True, help="Post URN (e.g., urn:li:activity:1234567890)")
    parser.add_argument("--undo", action="store_true", help="Unlike instead of like")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie)
        result = like_post(client, args.urn, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
