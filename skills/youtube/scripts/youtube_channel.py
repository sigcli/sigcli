#!/usr/bin/env python3
"""Get YouTube channel info via InnerTube browse API."""

import argparse
import json
import sys

import requests
from youtube_client import YouTubeClient, parse_channel_id


def get_channel(client: YouTubeClient, channel_input: str, limit: int = 10) -> dict:
    """Fetch channel metadata and recent videos."""
    browse_id = channel_input

    if channel_input.startswith("@"):
        resolve_data = client.post("navigation/resolve_url", {"url": f"https://www.youtube.com/{channel_input}"})
        browse_id = resolve_data.get("endpoint", {}).get("browseEndpoint", {}).get("browseId", channel_input)

    data = client.post("browse", {"browseId": browse_id})

    metadata = data.get("metadata", {}).get("channelMetadataRenderer", {})
    header = data.get("header", {}).get("pageHeaderRenderer", data.get("header", {}).get("c4TabbedHeaderRenderer", {}))

    subscriber_count = ""
    rows = header.get("content", {}).get("pageHeaderViewModel", {}).get("metadata", {}).get("contentMetadataViewModel", {}).get("metadataRows", [])
    for row in rows:
        for part in row.get("metadataParts", []):
            text = part.get("text", {}).get("content", "")
            if "subscriber" in text.lower():
                subscriber_count = text
    if not subscriber_count:
        subscriber_count = header.get("subscriberCountText", {}).get("simpleText", "")

    tabs = data.get("contents", {}).get("twoColumnBrowseResultsRenderer", {}).get("tabs", [])
    recent_videos = _extract_videos_from_tabs(tabs, limit)

    return {
        "name": metadata.get("title", ""),
        "channelId": metadata.get("externalId", browse_id),
        "handle": (metadata.get("vanityChannelUrl", "") or "").split("/")[-1] or "",
        "description": (metadata.get("description", "") or "")[:500],
        "subscribers": subscriber_count,
        "url": metadata.get("channelUrl", f"https://www.youtube.com/channel/{browse_id}"),
        "keywords": metadata.get("keywords", ""),
        "recentVideos": recent_videos,
    }


def _extract_videos_from_tabs(tabs: list, limit: int) -> list:
    videos = []
    home_tab = next((t for t in tabs if t.get("tabRenderer", {}).get("selected")), None)
    if home_tab:
        sections = home_tab.get("tabRenderer", {}).get("content", {}).get("sectionListRenderer", {}).get("contents", [])
        for section in sections:
            for shelf in section.get("itemSectionRenderer", {}).get("contents", []):
                items = shelf.get("shelfRenderer", {}).get("content", {}).get("horizontalListRenderer", {}).get("items", [])
                for item in items:
                    if len(videos) >= limit:
                        return videos
                    lvm = item.get("lockupViewModel")
                    if lvm and lvm.get("contentType") == "LOCKUP_CONTENT_TYPE_VIDEO":
                        meta = lvm.get("metadata", {}).get("lockupMetadataViewModel", {})
                        videos.append({
                            "title": meta.get("title", {}).get("content", ""),
                            "videoId": lvm.get("contentId", ""),
                            "url": "https://www.youtube.com/watch?v=" + lvm.get("contentId", ""),
                        })
                    grid = item.get("gridVideoRenderer")
                    if grid:
                        title_obj = grid.get("title", {})
                        title = title_obj.get("simpleText", "") or _runs_text(title_obj)
                        videos.append({
                            "title": title,
                            "videoId": grid.get("videoId", ""),
                            "url": "https://www.youtube.com/watch?v=" + grid.get("videoId", ""),
                        })
    return videos


def _runs_text(obj: dict) -> str:
    return "".join(r.get("text", "") for r in obj.get("runs", []))


def main():
    parser = argparse.ArgumentParser(description="Get YouTube channel info")
    parser.add_argument("--channel", required=True, help="Channel ID (UCxxxx), handle (@name), or URL")
    parser.add_argument("--limit", type=int, default=10, help="Max recent videos (default: 10)")
    args = parser.parse_args()

    try:
        client = YouTubeClient()
        channel_input = parse_channel_id(args.channel)
        result = get_channel(client, channel_input, args.limit)
        json.dump(result, sys.stdout, indent=2, ensure_ascii=False)
    except requests.HTTPError as e:
        json.dump({"error": "HTTP_" + str(e.response.status_code), "message": str(e)}, sys.stdout, indent=2)
    except Exception as e:
        json.dump({"error": "ERROR", "message": str(e)}, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
