#!/usr/bin/env python3
"""Get Xiaohongshu user profile and notes."""

import argparse
import json
import sys

from xhs_client import XhsClient, XhsApiError


def get_user(cookie="", user_id="", limit=10):
    client = XhsClient(cookie) if cookie else XhsClient.create()

    # Get user info
    result = client.get(f"/api/sns/web/v1/user/otherinfo", params={"target_user_id": user_id})
    user_data = result.get("data", {})

    user = {
        "id": user_id,
        "nickname": user_data.get("basic_info", {}).get("nickname", ""),
        "desc": user_data.get("basic_info", {}).get("desc", ""),
        "gender": user_data.get("basic_info", {}).get("gender", ""),
        "ip_location": user_data.get("basic_info", {}).get("ip_location", ""),
        "follows": user_data.get("interactions", [{}])[0].get("count", "0") if user_data.get("interactions") else "0",
        "fans": user_data.get("interactions", [{}])[1].get("count", "0") if len(user_data.get("interactions", [])) > 1 else "0",
        "notes_count": user_data.get("interactions", [{}])[2].get("count", "0") if len(user_data.get("interactions", [])) > 2 else "0",
    }

    # Get user notes
    notes = []
    try:
        notes_result = client.get(
            "/api/sns/web/v1/user_posted",
            params={"user_id": user_id, "cursor": "", "num": min(limit, 30), "image_formats": "jpg,webp,avif"},
        )
        for n in notes_result.get("data", {}).get("notes", [])[:limit]:
            interact = n.get("interact_info", {})
            notes.append(
                {
                    "id": n.get("note_id", ""),
                    "title": n.get("display_title", ""),
                    "type": n.get("type", ""),
                    "likes": interact.get("liked_count", "0"),
                    "cover": n.get("cover", {}).get("url", ""),
                }
            )
    except XhsApiError:
        pass

    user["notes"] = notes
    return user


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu user profile")
    parser.add_argument("--cookie", default="", help="Session cookie (or use env var)")
    parser.add_argument("--user-id", required=True, help="User ID")
    parser.add_argument("--limit", type=int, default=10, help="Max notes (default: 10)")
    args = parser.parse_args()

    try:
        result = get_user(args.cookie, args.user_id, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump({"error": f"XHS_{e.code}", "message": e.msg}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
