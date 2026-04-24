#!/usr/bin/env python3
"""Get V2EX member profile and topics."""

import argparse
import json
import sys

import requests
from v2ex_client import V2exClient, parse_topic_item


def get_member(username, include_topics=False, cookie=""):
    client = V2exClient(cookie)
    member = client.api_v1("/members/show.json", params={"username": username})

    result = {
        "member": {
            "id": member.get("id"),
            "username": member.get("username", ""),
            "url": member.get("url", ""),
            "website": member.get("website"),
            "twitter": member.get("twitter"),
            "github": member.get("github"),
            "location": member.get("location"),
            "tagline": member.get("tagline"),
            "bio": member.get("bio"),
            "avatar": member.get("avatar_large", member.get("avatar_normal", "")),
            "created": member.get("created"),
        },
    }

    if include_topics:
        topics_data = client.api_v1("/topics/show.json", params={"username": username})
        result["topics"] = {"count": len(topics_data), "items": [parse_topic_item(t) for t in topics_data]}

    return result


def main():
    parser = argparse.ArgumentParser(description="Get V2EX member profile")
    parser.add_argument("--cookie", default="", help="V2EX session cookie (optional)")
    parser.add_argument("--username", required=True, help="Member username")
    parser.add_argument("--include-topics", action="store_true", help="Also fetch member's recent topics")
    args = parser.parse_args()

    try:
        result = get_member(args.username, args.include_topics, args.cookie)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
