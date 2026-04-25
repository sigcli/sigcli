#!/usr/bin/env python3
"""Get YouTube video details via InnerTube player API."""

import argparse
import json
import sys

import requests
from youtube_client import YouTubeClient, parse_video_id


def get_video(client: YouTubeClient, video_id: str) -> dict:
    """Fetch video details from the InnerTube player endpoint."""
    data = client.post("player", {"videoId": video_id})

    details = data.get("videoDetails", {})
    microformat = data.get("microformat", {}).get("playerMicroformatRenderer", {})

    thumbnails = details.get("thumbnail", {}).get("thumbnails", [])
    thumbnail = thumbnails[-1]["url"] if thumbnails else ""

    return {
        "videoId": details.get("videoId", video_id),
        "title": details.get("title", ""),
        "author": details.get("author", ""),
        "channelId": details.get("channelId", ""),
        "viewCount": details.get("viewCount", "0"),
        "lengthSeconds": details.get("lengthSeconds", "0"),
        "description": details.get("shortDescription", ""),
        "keywords": details.get("keywords", []),
        "publishDate": microformat.get("publishDate", microformat.get("uploadDate", "")),
        "category": microformat.get("category", ""),
        "isLive": details.get("isLiveContent", False),
        "thumbnail": thumbnail,
    }


def main():
    parser = argparse.ArgumentParser(description="Get YouTube video details")
    parser.add_argument("--video", required=True, help="YouTube video URL or video ID")
    args = parser.parse_args()

    try:
        client = YouTubeClient()
        video_id = parse_video_id(args.video)
        result = get_video(client, video_id)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
