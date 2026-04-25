#!/usr/bin/env python3
"""Get comments on a Xiaohongshu note."""

import argparse
import json
import sys

import requests
from xhs_client import XhsApiError, XhsClient, error_response, parse_note_id


def get_comments(client: XhsClient, note_input: str, limit: int = 20) -> dict:
    """Fetch comments for a note via the web API."""
    note_id = parse_note_id(note_input)
    path = "/api/sns/web/v2/comment/page"
    params = {"note_id": note_id, "cursor": "", "top_comment_id": "", "image_formats": "jpg,webp,avif"}

    try:
        data = client.api_get(path, params=params)
    except XhsApiError:
        raise
    except Exception as e:
        raise XhsApiError("API_ERROR", f"Failed to fetch comments: {e}") from e

    comments_data = data.get("data") or {}
    raw_comments = comments_data.get("comments") or []

    comments = []
    for item in raw_comments[:limit]:
        user_info = item.get("user_info") or {}
        sub_comments = item.get("sub_comments") or []
        comment = {
            "comment_id": item.get("id", ""),
            "author": user_info.get("nickname", ""),
            "author_id": user_info.get("user_id", ""),
            "content": item.get("content", ""),
            "likes": item.get("like_count", 0),
            "create_time": item.get("create_time", 0),
            "is_reply": False,
            "reply_to": None,
            "sub_comment_count": item.get("sub_comment_count", 0),
        }
        comments.append(comment)
        for sub in sub_comments:
            sub_user = sub.get("user_info") or {}
            target_comment = sub.get("target_comment") or {}
            target_user = target_comment.get("user_info") or {}
            comments.append({
                "comment_id": sub.get("id", ""),
                "author": sub_user.get("nickname", ""),
                "author_id": sub_user.get("user_id", ""),
                "content": sub.get("content", ""),
                "likes": sub.get("like_count", 0),
                "create_time": sub.get("create_time", 0),
                "is_reply": True,
                "reply_to": target_user.get("nickname", ""),
                "sub_comment_count": 0,
            })

    return {
        "note_id": note_id,
        "count": len(comments),
        "comments": comments,
        "has_more": comments_data.get("has_more", False),
        "cursor": comments_data.get("cursor", ""),
    }


def main():
    parser = argparse.ArgumentParser(description="Get comments on a Xiaohongshu note")
    parser.add_argument("--id", required=True, help="Note ID or URL")
    parser.add_argument("--limit", type=int, default=20, help="Max top-level comments (default: 20)")
    args = parser.parse_args()

    try:
        client = XhsClient.create()
        result = get_comments(client, args.id, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except XhsApiError as e:
        json.dump(error_response(e.code, e.message), sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump(error_response(f"HTTP_{e.response.status_code}", str(e)), sys.stdout, indent=2, ensure_ascii=False)
    except Exception as e:
        json.dump(error_response("ERROR", str(e)), sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
