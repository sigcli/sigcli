#!/usr/bin/env python3
"""Create a LinkedIn post."""

import argparse
import json
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient


def create_post(client: LinkedInClient, text: str) -> dict:
    payload = {
        "visibleToConnectionsOnly": False,
        "externalAudienceProviders": [],
        "commentaryV2": {"text": text, "attributes": []},
        "origin": "FEED",
        "allowedCommentersScope": "ALL",
        "mediaCategory": "NONE",
    }
    data = client.voyager_post("/contentcreation/normShares", json_data=payload)
    urn = data.get("urn") or data.get("value", {}).get("urn", "")
    return {
        "success": True,
        "urn": urn,
        "url": f"https://www.linkedin.com/feed/update/{urn}" if urn else "",
        "message": "Post created successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Create a LinkedIn post")
    parser.add_argument("--cookie", required=True, help="LinkedIn session cookie")
    parser.add_argument("--text", required=True, help="Post text content")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie)
        result = create_post(client, args.text)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
