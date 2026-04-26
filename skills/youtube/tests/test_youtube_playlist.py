"""Tests for youtube/scripts/youtube_playlist.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("youtube", "youtube_playlist")
client_mod = load_script("youtube", "youtube_client")

_PLAYLIST_RESPONSE = {
    "header": {
        "playlistHeaderRenderer": {
            "title": {"simpleText": "My Playlist"},
        }
    },
    "sidebar": {
        "playlistSidebarRenderer": {
            "items": [
                {},
                {
                    "playlistSidebarSecondaryInfoRenderer": {
                        "videoOwner": {
                            "videoOwnerRenderer": {
                                "title": {"runs": [{"text": "Playlist Creator"}]}
                            }
                        }
                    }
                },
            ]
        }
    },
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
                                                    "playlistVideoListRenderer": {
                                                        "contents": [
                                                            {
                                                                "playlistVideoRenderer": {
                                                                    "videoId": "vid1",
                                                                    "index": {"simpleText": "1"},
                                                                    "title": {"runs": [{"text": "First Video"}]},
                                                                    "shortBylineText": {"runs": [{"text": "Author 1"}]},
                                                                    "lengthText": {"simpleText": "5:30"},
                                                                    "videoInfo": {"runs": [{"text": "100K views"}]},
                                                                }
                                                            },
                                                            {
                                                                "playlistVideoRenderer": {
                                                                    "videoId": "vid2",
                                                                    "index": {"simpleText": "2"},
                                                                    "title": {"runs": [{"text": "Second Video"}]},
                                                                    "shortBylineText": {"runs": [{"text": "Author 2"}]},
                                                                    "lengthText": {"simpleText": "10:00"},
                                                                    "videoInfo": {"runs": [{"text": "50K views"}]},
                                                                }
                                                            },
                                                        ]
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
    },
}


@responses.activate
def test_get_playlist_returns_videos():
    """get_playlist returns correctly formatted playlist info and videos."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/browse"),
        json=_PLAYLIST_RESPONSE,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_playlist(client, "PLxxxxxxxx")

    assert result["playlistId"] == "PLxxxxxxxx"
    assert result["title"] == "My Playlist"
    assert result["channel"] == "Playlist Creator"
    assert result["count"] == 2
    assert len(result["videos"]) == 2

    v1 = result["videos"][0]
    assert v1["videoId"] == "vid1"
    assert v1["title"] == "First Video"
    assert v1["rank"] == 1
    assert v1["duration"] == "5:30"


@responses.activate
def test_get_playlist_empty():
    """get_playlist handles empty playlist."""
    empty = {
        "header": {"playlistHeaderRenderer": {"title": {"simpleText": "Empty"}}},
        "sidebar": {"playlistSidebarRenderer": {"items": []}},
        "contents": {
            "twoColumnBrowseResultsRenderer": {
                "tabs": [{
                    "tabRenderer": {
                        "content": {
                            "sectionListRenderer": {
                                "contents": [{
                                    "itemSectionRenderer": {
                                        "contents": [{"playlistVideoListRenderer": {"contents": []}}]
                                    }
                                }]
                            }
                        }
                    }
                }]
            }
        },
    }
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/browse"),
        json=empty,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_playlist(client, "PLempty")

    assert result["count"] == 0
    assert result["videos"] == []


@responses.activate
def test_get_playlist_url_parsing():
    """parse_playlist_id extracts ID from URL."""
    playlist_id = client_mod.parse_playlist_id("https://www.youtube.com/playlist?list=PLxxxxxxxx")
    assert playlist_id == "PLxxxxxxxx"

    playlist_id = client_mod.parse_playlist_id("PLbare")
    assert playlist_id == "PLbare"
