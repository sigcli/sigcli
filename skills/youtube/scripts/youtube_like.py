#!/usr/bin/env python3
"""Like or unlike a YouTube video via InnerTube like API."""

import argparse
import json
import sys

import requests
from youtube_client import YouTubeApiError, YouTubeClient, parse_video_id

ENDPOINT_MAP = {
    "like": "like/like",
    "unlike": "like/removelike",
}


def like_video(cookie: str, video_id: str, action: str = "like") -> dict:
    """Like or unlike a video."""
    client = YouTubeClient(cookie)
    client.require_cookie()

    endpoint = ENDPOINT_MAP[action]
    client.auth_post(endpoint, {"target": {"videoId": video_id}})

    return {
        "success": True,
        "videoId": video_id,
        "action": action,
        "message": f"Video {action}d: {video_id}",
    }


def main():
    parser = argparse.ArgumentParser(description="Like or unlike a YouTube video")
    parser.add_argument("--cookie", required=True, help="YouTube session cookie")
    parser.add_argument("--video", required=True, help="YouTube video URL or video ID")
    parser.add_argument("--action", default="like", choices=["like", "unlike"], help="Action (default: like)")
    args = parser.parse_args()

    try:
        video_id = parse_video_id(args.video)
        result = like_video(args.cookie, video_id, args.action)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except YouTubeApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
