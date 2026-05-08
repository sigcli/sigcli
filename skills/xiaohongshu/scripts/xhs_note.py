#!/usr/bin/env python3
"""Get Xiaohongshu note detail and comments."""

import argparse
import json
import sys

from xhs_client import XhsClient, XhsApiError


def get_note(cookie="", note_id="", comments_limit=10):
    client = XhsClient(cookie) if cookie else XhsClient.create()

    # Get note detail
    payload = {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": 1},
    }
    result = client.post("/api/sns/web/v1/feed", payload)
    items = result.get("data", {}).get("items", [])
    if not items:
        raise XhsApiError(-1, f"Note {note_id} not found")

    note_data = items[0].get("note_card", {})
    user = note_data.get("user", {})
    interact = note_data.get("interact_info", {})

    note = {
        "id": note_id,
        "title": note_data.get("title", ""),
        "desc": note_data.get("desc", ""),
        "type": note_data.get("type", ""),
        "author": user.get("nickname", ""),
        "author_id": user.get("user_id", ""),
        "likes": interact.get("liked_count", "0"),
        "collects": interact.get("collected_count", "0"),
        "comments_count": interact.get("comment_count", "0"),
        "shares": interact.get("share_count", "0"),
        "time": note_data.get("time", ""),
        "tags": [t.get("name", "") for t in note_data.get("tag_list", [])],
        "images": [img.get("url", "") for img in note_data.get("image_list", [])],
    }

    # Get comments
    comments = []
    if comments_limit > 0:
        try:
            comment_result = client.get(
                "/api/sns/web/v2/comment/page",
                params={"note_id": note_id, "cursor": "", "top_comment_id": "", "image_formats": "jpg,webp,avif"},
            )
            for c in comment_result.get("data", {}).get("comments", [])[:comments_limit]:
                comments.append(
                    {
                        "id": c.get("id", ""),
                        "user": c.get("user_info", {}).get("nickname", ""),
                        "content": c.get("content", ""),
                        "likes": c.get("like_count", 0),
                        "time": c.get("create_time", ""),
                    }
                )
        except XhsApiError:
            pass

    note["comments"] = comments
    return note


def main():
    parser = argparse.ArgumentParser(description="Get Xiaohongshu note detail")
    parser.add_argument("--cookie", default="", help="Session cookie (or use env var)")
    parser.add_argument("--id", required=True, help="Note ID")
    parser.add_argument("--comments-limit", type=int, default=10, help="Max comments (default: 10)")
    args = parser.parse_args()

    try:
        result = get_note(args.cookie, args.id, args.comments_limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump({"error": f"XHS_{e.code}", "message": e.msg}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
