#!/usr/bin/env python3
"""Get Bilibili user profile and recent videos."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient


def get_user(client: BilibiliClient, mid: int, include_videos: bool = False) -> dict:
    """Fetch user profile by mid (WBI signed)."""
    payload = client.get("/x/space/wbi/acc/info", params={"mid": mid}, signed=True)
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    data = payload.get("data", {})
    result = {
        "mid": data.get("mid", 0),
        "name": data.get("name", ""),
        "face": data.get("face", ""),
        "sign": data.get("sign", ""),
        "level": data.get("level", 0),
        "sex": data.get("sex", ""),
        "fans": data.get("fans", 0),
        "following": data.get("following") if data.get("following") is not None else 0,
    }
    if include_videos:
        vlist = client.get("/x/space/wbi/arc/search", params={"mid": mid, "pn": 1, "ps": 10}, signed=True)
        vdata = vlist.get("data", {}).get("list", {}).get("vlist", []) or []
        result["recent_videos"] = [parse_video_from_space(v) for v in vdata[:10]]
    return result


def parse_video_from_space(item: dict) -> dict:
    """Parse a video item from the space/arc/search response."""
    return {
        "bvid": item.get("bvid", ""),
        "aid": item.get("aid", 0),
        "title": item.get("title", ""),
        "description": item.get("description", ""),
        "duration": item.get("length", ""),
        "thumbnail": item.get("pic", ""),
        "view": item.get("play", 0),
        "created": item.get("created", 0),
    }


def main():
    parser = argparse.ArgumentParser(description="Get Bilibili user profile")
    parser.add_argument("--mid", required=True, type=int, help="User mid (numeric ID)")
    parser.add_argument("--include-videos", action="store_true", help="Include recent videos")
    args = parser.parse_args()

    try:
        client = BilibiliClient.create()
        result = get_user(client, args.mid, args.include_videos)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
