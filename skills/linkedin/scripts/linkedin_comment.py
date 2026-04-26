#!/usr/bin/env python3
"""Post a comment on a LinkedIn post."""

import argparse
import json
import sys

import requests
from linkedin_client import LinkedInApiError, LinkedInClient


def post_comment(client: LinkedInClient, urn: str, text: str) -> dict:
    payload = {"threadUrn": urn, "commentaryV2": {"text": text, "attributes": []}}
    data = client.voyager_post("/feed/comments", json_data=payload)
    comment_urn = data.get("urn", "")
    return {
        "success": True,
        "postUrn": urn,
        "commentUrn": comment_urn,
        "message": "Comment posted successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Comment on a LinkedIn post")
    parser.add_argument("--cookie", required=True, help="LinkedIn session cookie")
    parser.add_argument("--urn", required=True, help="Post URN to comment on")
    parser.add_argument("--text", required=True, help="Comment text")
    args = parser.parse_args()
    try:
        client = LinkedInClient(args.cookie)
        result = post_comment(client, args.urn, args.text)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except LinkedInApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
