"""Tests for youtube/scripts/youtube_trending.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("youtube", "youtube_trending")
client_mod = load_script("youtube", "youtube_client")

_TRENDING_RESPONSE = {
    "contents": {
        "twoColumnBrowseResultsRenderer": {
            "tabs": [
                {
                    "tabRenderer": {
                        "content": {
                            "sectionListRenderer": {
                                "contents": [
                                    {
                                        "itemSectionRenderer": {
                                            "contents": [
                                                {
                                                    "shelfRenderer": {
                                                        "content": {
                                                            "expandedShelfContentsRenderer": {
                                                                "items": [
                                                                    {
                                                                        "videoRenderer": {
                                                                            "videoId": "trend1",
                                                                            "title": {"runs": [{"text": "Trending Video 1"}]},
                                                                            "ownerText": {"runs": [{"text": "Channel A"}]},
                                                                            "viewCountText": {"simpleText": "5M views"},
                                                                            "lengthText": {"simpleText": "8:15"},
                                                                            "publishedTimeText": {"simpleText": "1 day ago"},
                                                                        }
                                                                    },
                                                                    {
                                                                        "videoRenderer": {
                                                                            "videoId": "trend2",
                                                                            "title": {"runs": [{"text": "Trending Video 2"}]},
                                                                            "ownerText": {"runs": [{"text": "Channel B"}]},
                                                                            "viewCountText": {"simpleText": "3M views"},
                                                                            "lengthText": {"simpleText": "12:00"},
                                                                            "publishedTimeText": {"simpleText": "3 hours ago"},
                                                                        }
                                                                    },
                                                                ]
                                                            }
                                                        }
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            ]
        }
    }
}


@responses.activate
def test_get_trending_returns_videos():
    """get_trending returns correctly formatted trending videos."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/browse"),
        json=_TRENDING_RESPONSE,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_trending(client)

    assert result["count"] == 2
    assert len(result["videos"]) == 2

    v1 = result["videos"][0]
    assert v1["videoId"] == "trend1"
    assert v1["title"] == "Trending Video 1"
    assert v1["channel"] == "Channel A"
    assert v1["views"] == "5M views"


@responses.activate
def test_get_trending_empty():
    """get_trending returns empty list when no trending videos."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/browse"),
        json={"contents": {"twoColumnBrowseResultsRenderer": {"tabs": []}}},
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_trending(client)

    assert result["count"] == 0
    assert result["videos"] == []


@responses.activate
def test_get_trending_respects_limit():
    """get_trending respects the limit parameter."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/browse"),
        json=_TRENDING_RESPONSE,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_trending(client, limit=1)

    assert result["count"] == 1
    assert len(result["videos"]) == 1
