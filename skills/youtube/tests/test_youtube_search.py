"""Tests for youtube/scripts/youtube_search.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("youtube", "youtube_search")
client_mod = load_script("youtube", "youtube_client")

_SEARCH_RESPONSE = {
    "contents": {
        "twoColumnSearchResultsRenderer": {
            "primaryContents": {
                "sectionListRenderer": {
                    "contents": [
                        {
                            "itemSectionRenderer": {
                                "contents": [
                                    {
                                        "videoRenderer": {
                                            "videoId": "abc123",
                                            "title": {"runs": [{"text": "Python Tutorial"}]},
                                            "ownerText": {"runs": [{"text": "Tech Channel"}]},
                                            "viewCountText": {"simpleText": "1M views"},
                                            "lengthText": {"simpleText": "10:30"},
                                            "publishedTimeText": {"simpleText": "2 months ago"},
                                        }
                                    },
                                    {
                                        "videoRenderer": {
                                            "videoId": "def456",
                                            "title": {"runs": [{"text": "Python for Beginners"}]},
                                            "ownerText": {"runs": [{"text": "Code Academy"}]},
                                            "viewCountText": {"simpleText": "500K views"},
                                            "lengthText": {"simpleText": "45:00"},
                                            "publishedTimeText": {"simpleText": "1 year ago"},
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            }
        }
    }
}


@responses.activate
def test_search_returns_formatted_results():
    """search_videos returns correctly formatted search results."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/search"),
        json=_SEARCH_RESPONSE,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.search_videos(client, "python tutorial")

    assert result["query"] == "python tutorial"
    assert result["count"] == 2
    assert len(result["videos"]) == 2

    video1 = result["videos"][0]
    assert video1["videoId"] == "abc123"
    assert video1["title"] == "Python Tutorial"
    assert video1["channel"] == "Tech Channel"
    assert video1["views"] == "1M views"
    assert video1["duration"] == "10:30"


@responses.activate
def test_search_empty_results():
    """search_videos returns empty list for no results."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/search"),
        json={"contents": {"twoColumnSearchResultsRenderer": {"primaryContents": {"sectionListRenderer": {"contents": []}}}}},
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.search_videos(client, "xyznonexistent12345")

    assert result["query"] == "xyznonexistent12345"
    assert result["count"] == 0
    assert result["videos"] == []


@responses.activate
def test_search_respects_limit():
    """search_videos respects the limit parameter."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/search"),
        json=_SEARCH_RESPONSE,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.search_videos(client, "python", limit=1)

    assert result["count"] == 1
    assert len(result["videos"]) == 1
    assert result["videos"][0]["videoId"] == "abc123"
