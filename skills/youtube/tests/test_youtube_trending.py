"""Tests for youtube/scripts/youtube_trending.py"""

import json
import re

import responses

from test_helpers import load_script

mod = load_script("youtube", "youtube_trending")
client_mod = load_script("youtube", "youtube_client")

_SSR_VIDEO_DATA = {
    "contents": {
        "twoColumnBrowseResultsRenderer": {
            "tabs": [{
                "tabRenderer": {
                    "content": {
                        "richGridRenderer": {
                            "contents": [{
                                "richItemRenderer": {
                                    "content": {
                                        "videoRenderer": {
                                            "videoId": "trend1",
                                            "title": {"runs": [{"text": "Trending Video 1"}]},
                                            "ownerText": {"runs": [{"text": "Channel A"}]},
                                            "viewCountText": {"simpleText": "5M views"},
                                            "lengthText": {"simpleText": "8:15"},
                                            "publishedTimeText": {"simpleText": "1 day ago"},
                                        }
                                    }
                                }
                            }, {
                                "richItemRenderer": {
                                    "content": {
                                        "videoRenderer": {
                                            "videoId": "trend2",
                                            "title": {"runs": [{"text": "Trending Video 2"}]},
                                            "ownerText": {"runs": [{"text": "Channel B"}]},
                                            "viewCountText": {"simpleText": "3M views"},
                                            "lengthText": {"simpleText": "12:00"},
                                            "publishedTimeText": {"simpleText": "3 hours ago"},
                                        }
                                    }
                                }
                            }]
                        }
                    }
                }
            }]
        }
    }
}


def _html_with_data(data):
    return f'<html><script>var ytInitialData = {json.dumps(data)};</script></html>'


@responses.activate
def test_get_trending_returns_videos():
    responses.get(url=re.compile(r"https://www\.youtube\.com/feed/trending"), body=_html_with_data(_SSR_VIDEO_DATA), status=200)

    client = client_mod.YouTubeClient()
    result = mod.get_trending(client)

    assert result["count"] == 2
    assert len(result["videos"]) == 2
    v1 = result["videos"][0]
    assert v1["videoId"] == "trend1"
    assert v1["title"] == "Trending Video 1"
    assert v1["channel"] == "Channel A"


@responses.activate
def test_get_trending_empty_falls_back_to_search():
    empty_html = '<html><script>var ytInitialData = {"contents": {}};</script></html>'
    responses.get(url=re.compile(r"https://www\.youtube\.com/feed/trending"), body=empty_html, status=200)
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/search"),
        json={"contents": {"twoColumnSearchResultsRenderer": {"primaryContents": {"sectionListRenderer": {"contents": []}}}}},
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_trending(client)

    assert result["count"] == 0
    assert result["videos"] == []


@responses.activate
def test_get_trending_respects_limit():
    responses.get(url=re.compile(r"https://www\.youtube\.com/feed/trending"), body=_html_with_data(_SSR_VIDEO_DATA), status=200)

    client = client_mod.YouTubeClient()
    result = mod.get_trending(client, limit=1)

    assert result["count"] == 1
    assert len(result["videos"]) == 1
