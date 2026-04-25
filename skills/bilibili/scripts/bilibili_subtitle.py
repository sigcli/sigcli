#!/usr/bin/env python3
"""Get Bilibili video subtitles/captions."""

import argparse
import json
import sys

import requests
from bilibili_client import BilibiliApiError, BilibiliClient


def get_subtitle(client: BilibiliClient, bvid: str, lang: str = "") -> dict:
    """Fetch subtitles for a video by BV ID.

    1. Get video info to find the CID
    2. Call /x/player/wbi/v2 (WBI-signed) to get subtitle list
    3. Fetch the subtitle JSON from CDN
    """
    video_payload = client.get("/x/web-interface/view", params={"bvid": bvid})
    if video_payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Video not found: {video_payload.get('message', 'unknown')}")
    video_data = video_payload.get("data", {})
    cid = video_data.get("cid", 0)
    if not cid:
        pages = video_data.get("pages", [])
        if pages:
            cid = pages[0].get("cid", 0)
    if not cid:
        raise BilibiliApiError("NO_CID", "Cannot determine CID for this video")

    player_payload = client.get("/x/player/wbi/v2", params={"bvid": bvid, "cid": cid}, signed=True)
    if player_payload.get("code") != 0:
        raise BilibiliApiError("API_ERROR", f"Player API error: {player_payload.get('message', 'unknown')}")
    player_data = player_payload.get("data", {})
    subtitle_info = player_data.get("subtitle", {})
    subtitles_list = subtitle_info.get("subtitles", [])

    if not subtitles_list:
        need_login = player_data.get("need_login_subtitle", False)
        if need_login:
            raise BilibiliApiError("AUTH_REQUIRED", "Subtitles require login for this video")
        return {
            "bvid": bvid,
            "cid": cid,
            "title": video_data.get("title", ""),
            "subtitle_count": 0,
            "available_languages": [],
            "selected_language": "",
            "items": [],
        }

    available = [{"lan": s.get("lan", ""), "lan_doc": s.get("lan_doc", "")} for s in subtitles_list]

    target = subtitles_list[0]
    if lang:
        for s in subtitles_list:
            if s.get("lan") == lang:
                target = s
                break

    sub_url = target.get("subtitle_url", "")
    if not sub_url:
        raise BilibiliApiError("NO_SUBTITLE_URL", "Subtitle URL is empty — may be blocked by risk control")
    if sub_url.startswith("//"):
        sub_url = "https:" + sub_url

    resp = requests.get(sub_url, timeout=15, headers={"User-Agent": "sigcli-skill/1.0"})
    resp.raise_for_status()
    sub_data = resp.json()
    body = sub_data.get("body", [])

    items = []
    for i, entry in enumerate(body):
        items.append({
            "index": i + 1,
            "from": round(entry.get("from", 0), 2),
            "to": round(entry.get("to", 0), 2),
            "content": entry.get("content", ""),
        })

    return {
        "bvid": bvid,
        "cid": cid,
        "title": video_data.get("title", ""),
        "subtitle_count": len(subtitles_list),
        "available_languages": available,
        "selected_language": target.get("lan", ""),
        "items": items,
    }


def main():
    parser = argparse.ArgumentParser(description="Get Bilibili video subtitles")
    parser.add_argument("--bvid", required=True, help="Video BV ID (e.g., BV1xx411c7mD)")
    parser.add_argument("--lang", default="", help="Subtitle language code (e.g., zh-CN, en-US, ai-zh). Default: first available")
    parser.add_argument("--cookie", default="", help="Bilibili session cookie (may be needed for some videos)")
    args = parser.parse_args()

    try:
        client = BilibiliClient(args.cookie) if args.cookie else BilibiliClient.create()
        result = get_subtitle(client, args.bvid, args.lang)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except BilibiliApiError as e:
        json.dump({"error": e.code, "message": e.message}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
