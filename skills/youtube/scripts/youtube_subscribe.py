#!/usr/bin/env python3
"""Subscribe or unsubscribe to a YouTube channel via InnerTube subscription API."""

import argparse
import json
import sys

import requests
from youtube_client import YouTubeApiError, YouTubeClient, parse_channel_id

ENDPOINT_MAP = {
    "subscribe": "subscription/subscribe",
    "unsubscribe": "subscription/unsubscribe",
}


def subscribe_channel(cookie: str, channel_input: str, action: str = "subscribe") -> dict:
    """Subscribe or unsubscribe to a channel."""
    client = YouTubeClient(cookie)
    client.require_cookie()

    channel_id = channel_input
    if channel_input.startswith("@"):
        resolve_data = client.post("navigation/resolve_url", {"url": f"https://www.youtube.com/{channel_input}"})
        channel_id = resolve_data.get("endpoint", {}).get("browseEndpoint", {}).get("browseId", channel_input)

    if not channel_id.startswith("UC"):
        raise YouTubeApiError("INVALID_CHANNEL", f"Could not resolve channel ID from: {channel_input}")

    endpoint = ENDPOINT_MAP[action]
    client.auth_post(endpoint, {"channelIds": [channel_id]})

    return {
        "success": True,
        "channelId": channel_id,
        "action": action,
        "message": f"{action.capitalize()}d: {channel_id}",
    }


def main():
    parser = argparse.ArgumentParser(description="Subscribe or unsubscribe to a YouTube channel")
    parser.add_argument("--cookie", required=True, help="YouTube session cookie")
    parser.add_argument("--channel", required=True, help="Channel ID (UCxxxx), handle (@name), or URL")
    parser.add_argument("--action", default="subscribe", choices=["subscribe", "unsubscribe"], help="Action (default: subscribe)")
    args = parser.parse_args()

    try:
        channel_input = parse_channel_id(args.channel)
        result = subscribe_channel(args.cookie, channel_input, args.action)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except YouTubeApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
