#!/usr/bin/env python3
"""Like or unlike a Bilibili video."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient


def like_video(client: BilibiliClient, aid: int, undo: bool = False) -> dict:
    """Like or unlike a video by aid."""
    csrf = client.get_csrf()
    like_val = 2 if undo else 1
    payload = client.post("/x/web-interface/archive/like", data={"aid": aid, "like": like_val, "csrf": csrf})
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    return {
        "success": True,
        "aid": aid,
        "action": "unlike" if undo else "like",
        "message": f"Video {'unliked' if undo else 'liked'} successfully",
    }


def main():
    parser = argparse.ArgumentParser(description="Like or unlike a Bilibili video")
    parser.add_argument("--cookie", required=True, help="Bilibili session cookie")
    parser.add_argument("--aid", required=True, type=int, help="Video aid (numeric ID)")
    parser.add_argument("--undo", action="store_true", help="Unlike instead of like")
    args = parser.parse_args()

    try:
        client = BilibiliClient(args.cookie)
        result = like_video(client, args.aid, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
