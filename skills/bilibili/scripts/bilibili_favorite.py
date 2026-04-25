#!/usr/bin/env python3
"""Add or remove a Bilibili video from favorites."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient


def favorite_video(client: BilibiliClient, aid: int, folder_id: int, undo: bool = False) -> dict:
    """Add or remove a video from a favorites folder."""
    csrf = client.get_csrf()
    data = {
        "rid": aid,
        "type": 2,
        "csrf": csrf,
    }
    if undo:
        data["del_media_ids"] = folder_id
    else:
        data["add_media_ids"] = folder_id
    payload = client.post("/x/v3/fav/resource/deal", data=data)
    if payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Bilibili API error: {payload.get('message', 'unknown')} (code {payload.get('code')})")
    return {
        "success": True,
        "aid": aid,
        "folder_id": folder_id,
        "action": "unfavorite" if undo else "favorite",
        "message": f"Video {'removed from' if undo else 'added to'} favorites folder {folder_id}",
    }


def main():
    parser = argparse.ArgumentParser(description="Add or remove a Bilibili video from favorites")
    parser.add_argument("--cookie", required=True, help="Bilibili session cookie")
    parser.add_argument("--aid", required=True, type=int, help="Video aid (numeric ID)")
    parser.add_argument("--folder-id", required=True, type=int, help="Favorites folder ID")
    parser.add_argument("--undo", action="store_true", help="Remove from favorites instead of adding")
    args = parser.parse_args()

    try:
        client = BilibiliClient(args.cookie)
        result = favorite_video(client, args.aid, args.folder_id, args.undo)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
