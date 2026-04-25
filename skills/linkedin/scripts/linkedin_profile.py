#!/usr/bin/env python3
"""Get a LinkedIn user profile by username."""

import argparse
import json
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient, parse_profile, resolve_profile_id

DECORATION_ID = "com.linkedin.voyager.dash.deco.identity.profile.WebTopCardCore-20"


def get_profile(client: LinkedInClient, username: str) -> dict:
    params = {"q": "memberIdentity", "memberIdentity": username, "decorationId": DECORATION_ID}
    data = client.voyager_get("/identity/dash/profiles", params=params)
    profile = parse_profile(data, target_username=username)
    if not profile:
        raise LinkedInApiError("NOT_FOUND", f"Profile not found: {username}")
    return profile


def main():
    parser = argparse.ArgumentParser(description="Get a LinkedIn user profile")
    parser.add_argument("--username", required=True, help="LinkedIn username or profile URL")
    parser.add_argument("--cookie", default="", help="LinkedIn session cookie")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie) if args.cookie else LinkedInClient.create()
        username = resolve_profile_id(args.username)
        result = get_profile(client, username)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
