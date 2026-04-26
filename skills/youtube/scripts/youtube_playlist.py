#!/usr/bin/env python3
"""Get YouTube playlist videos via InnerTube browse API."""

import argparse
import json
import sys

import requests
from youtube_client import YouTubeClient, parse_playlist_id


def get_playlist(client: YouTubeClient, playlist_id: str, limit: int = 50) -> dict:
    """Fetch playlist info and video list."""
    browse_id = f"VL{playlist_id}"
    data = client.post("browse", {"browseId": browse_id})

    header = data.get("header", {}).get("playlistHeaderRenderer", data.get("header", {}).get("pageHeaderRenderer", {}))
    title = header.get("title", {}).get("simpleText", "") or header.get("pageTitle", "")

    sidebar_items = data.get("sidebar", {}).get("playlistSidebarRenderer", {}).get("items", [])
    channel_name = ""
    for item in sidebar_items:
        secondary = item.get("playlistSidebarSecondaryInfoRenderer", {})
        owner = secondary.get("videoOwner", {}).get("videoOwnerRenderer", {})
        channel_name = _text(owner.get("title"))
        if channel_name:
            break

    tabs = data.get("contents", {}).get("twoColumnBrowseResultsRenderer", {}).get("tabs", [])
    list_contents = []
    if tabs:
        list_contents = (
            tabs[0]
            .get("tabRenderer", {})
            .get("content", {})
            .get("sectionListRenderer", {})
            .get("contents", [{}])[0]
            .get("itemSectionRenderer", {})
            .get("contents", [{}])[0]
            .get("playlistVideoListRenderer", {})
            .get("contents", [])
        )

    videos = _extract_playlist_videos(list_contents)

    cont_item = list_contents[-1] if list_contents else {}
    while len(videos) < limit and cont_item.get("continuationItemRenderer"):
        token = (
            cont_item["continuationItemRenderer"]
            .get("continuationEndpoint", {})
            .get("continuationCommand", {})
            .get("token")
        )
        if not token:
            break
        cont_data = client.post("browse", {"continuation": token})
        new_items = cont_data.get("onResponseReceivedActions", [{}])[0].get("appendContinuationItemsAction", {}).get("continuationItems", [])
        if not new_items:
            break
        videos.extend(_extract_playlist_videos(new_items))
        cont_item = new_items[-1] if new_items else {}

    return {
        "playlistId": playlist_id,
        "title": title,
        "channel": channel_name,
        "count": len(videos[:limit]),
        "videos": videos[:limit],
    }


def _extract_playlist_videos(items: list) -> list:
    videos = []
    for item in items:
        renderer = item.get("playlistVideoRenderer")
        if not renderer:
            continue
        info_runs = renderer.get("videoInfo", {}).get("runs", [])
        videos.append({
            "rank": int(renderer.get("index", {}).get("simpleText", "0") or "0"),
            "videoId": renderer.get("videoId", ""),
            "title": _text(renderer.get("title")),
            "channel": _text(renderer.get("shortBylineText")),
            "duration": renderer.get("lengthText", {}).get("simpleText", ""),
            "views": info_runs[0].get("text", "") if info_runs else "",
            "url": "https://www.youtube.com/watch?v=" + renderer.get("videoId", ""),
        })
    return videos


def _text(obj=None) -> str:
    if not obj:
        return ""
    if "simpleText" in obj:
        return obj["simpleText"]
    runs = obj.get("runs", [])
    return "".join(r.get("text", "") for r in runs)


def main():
    parser = argparse.ArgumentParser(description="Get YouTube playlist videos")
    parser.add_argument("--playlist", required=True, help="Playlist URL or ID (PLxxxxxx)")
    parser.add_argument("--limit", type=int, default=50, help="Max videos (default: 50)")
    args = parser.parse_args()

    try:
        client = YouTubeClient()
        playlist_id = parse_playlist_id(args.playlist)
        result = get_playlist(client, playlist_id, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
