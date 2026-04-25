#!/usr/bin/env python3
"""Get an X (Twitter) user profile."""

import argparse
import json
import sys

import requests
from x_client import FEATURES_USER, XApiError, XClient, parse_user, resolve_username


def get_user(client: XClient, username: str) -> dict:
    """Fetch a user profile by screen name."""
    variables = {"screen_name": username, "withSafetyModeUserFields": True}
    data = client.graphql_get("UserByScreenName", variables, features=FEATURES_USER)
    result = (data.get("data") or {}).get("user", {}).get("result")
    if not result:
        raise XApiError("NOT_FOUND", f"User @{username} not found")
    user = parse_user(result)
    if not user:
        raise XApiError("PARSE_ERROR", f"Could not parse user @{username}")
    return user


def main():
    parser = argparse.ArgumentParser(description="Get an X user profile")
    parser.add_argument("--username", required=True, help="Screen name (without @)")
    args = parser.parse_args()

    try:
        client = XClient.create()
        username = resolve_username(args.username)
        result = get_user(client, username)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
