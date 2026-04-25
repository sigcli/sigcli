#!/usr/bin/env python3
"""Get YouTube video comments via InnerTube next API."""

import argparse
import json
import sys

import requests
from youtube_client import YouTubeClient, parse_video_id


def get_comments(client: YouTubeClient, video_id: str, limit: int = 20) -> dict:
    """Fetch comments for a video using the InnerTube next endpoint."""
    next_data = client.post("next", {"videoId": video_id})

    results = next_data.get("contents", {}).get("twoColumnWatchNextResults", {}).get("results", {}).get("results", {}).get("contents", [])
    continuation_token = None
    for item in results:
        section = item.get("itemSectionRenderer", {})
        if section.get("targetId") == "comments-section":
            cont_items = section.get("contents", [])
            if cont_items:
                continuation_token = (
                    cont_items[0]
                    .get("continuationItemRenderer", {})
                    .get("continuationEndpoint", {})
                    .get("continuationCommand", {})
                    .get("token")
                )
            break

    if not continuation_token:
        return {"videoId": video_id, "count": 0, "comments": [], "message": "Comments may be disabled"}

    comment_data = client.post("next", {"continuation": continuation_token})

    mutations = comment_data.get("frameworkUpdates", {}).get("entityBatchUpdate", {}).get("mutations", [])
    comment_entities = [m for m in mutations if m.get("payload", {}).get("commentEntityPayload")]

    comments = []
    for m in comment_entities[:limit]:
        payload = m["payload"]["commentEntityPayload"]
        props = payload.get("properties", {})
        author = payload.get("author", {})
        toolbar = payload.get("toolbar", {})
        comments.append({
            "author": author.get("displayName", ""),
            "text": (props.get("content", {}).get("content", ""))[:500],
            "likes": toolbar.get("likeCountNotliked", "0"),
            "replyCount": toolbar.get("replyCount", "0"),
            "publishedTime": props.get("publishedTime", ""),
        })

    return {
        "videoId": video_id,
        "count": len(comments),
        "comments": comments,
    }


def main():
    parser = argparse.ArgumentParser(description="Get YouTube video comments")
    parser.add_argument("--video", required=True, help="YouTube video URL or video ID")
    parser.add_argument("--limit", type=int, default=20, help="Max comments (default: 20)")
    args = parser.parse_args()

    try:
        client = YouTubeClient()
        video_id = parse_video_id(args.video)
        result = get_comments(client, video_id, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
