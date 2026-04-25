#!/usr/bin/env python3
"""Get current LinkedIn user profile."""

import argparse
import json
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient


def get_me(client: LinkedInClient) -> dict:
    data = client.voyager_get("/me")
    mp = data.get("miniProfile") or data
    first = mp.get("firstName", "")
    last = mp.get("lastName", "")
    return {
        "firstName": first,
        "lastName": last,
        "headline": mp.get("headline", ""),
        "publicIdentifier": mp.get("publicIdentifier", ""),
        "entityUrn": data.get("entityUrn", ""),
    }


def main():
    parser = argparse.ArgumentParser(description="Get current LinkedIn user profile")
    parser.add_argument("--cookie", default="", help="LinkedIn session cookie")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie) if args.cookie else LinkedInClient.create()
        result = get_me(client)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
