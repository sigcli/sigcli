"""Tests for youtube/scripts/youtube_channel.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("youtube", "youtube_channel")
client_mod = load_script("youtube", "youtube_client")

_CHANNEL_RESPONSE = {
    "metadata": {
        "channelMetadataRenderer": {
            "title": "Rick Astley",
            "externalId": "UCuAXFkgsw1L7xaCfnd5JJOw",
            "description": "Official YouTube channel of Rick Astley",
            "vanityChannelUrl": "http://www.youtube.com/@RickAstleyYT",
            "channelUrl": "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw",
            "keywords": "rick astley music",
        }
    },
    "header": {
        "c4TabbedHeaderRenderer": {
            "subscriberCountText": {"simpleText": "3.5M subscribers"},
        }
    },
    "contents": {
        "twoColumnBrowseResultsRenderer": {
            "tabs": [
                {
                    "tabRenderer": {
                        "selected": True,
                        "content": {
                            "sectionListRenderer": {
                                "contents": [
                                    {
                                        "itemSectionRenderer": {
                                            "contents": [
                                                {
                                                    "shelfRenderer": {
                                                        "content": {
                                                            "horizontalListRenderer": {
                                                                "items": [
                                                                    {
                                                                        "gridVideoRenderer": {
                                                                            "videoId": "dQw4w9WgXcQ",
                                                                            "title": {"simpleText": "Never Gonna Give You Up"},
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
                                ]
                            }
                        },
                    }
                }
            ]
        }
    },
}


@responses.activate
def test_get_channel_returns_info():
    """get_channel returns correctly formatted channel info."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/browse"),
        json=_CHANNEL_RESPONSE,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_channel(client, "UCuAXFkgsw1L7xaCfnd5JJOw")

    assert result["name"] == "Rick Astley"
    assert result["channelId"] == "UCuAXFkgsw1L7xaCfnd5JJOw"
    assert result["handle"] == "@RickAstleyYT"
    assert result["subscribers"] == "3.5M subscribers"
    assert len(result["recentVideos"]) == 1
    assert result["recentVideos"][0]["videoId"] == "dQw4w9WgXcQ"


@responses.activate
def test_get_channel_resolves_handle():
    """get_channel resolves @handle to channel ID."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/navigation/resolve_url"),
        json={"endpoint": {"browseEndpoint": {"browseId": "UCuAXFkgsw1L7xaCfnd5JJOw"}}},
        status=200,
    )
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/browse"),
        json=_CHANNEL_RESPONSE,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_channel(client, "@RickAstleyYT")

    assert result["name"] == "Rick Astley"
    assert result["channelId"] == "UCuAXFkgsw1L7xaCfnd5JJOw"


@responses.activate
def test_get_channel_empty_videos():
    """get_channel returns empty recentVideos when none found."""
    bare_response = {
        "metadata": {"channelMetadataRenderer": {"title": "Empty Channel", "externalId": "UC000"}},
        "header": {"c4TabbedHeaderRenderer": {}},
        "contents": {
            "twoColumnBrowseResultsRenderer": {
                "tabs": [{"tabRenderer": {"selected": True, "content": {"sectionListRenderer": {"contents": []}}}}]
            }
        },
    }
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/browse"),
        json=bare_response,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_channel(client, "UC000")

    assert result["name"] == "Empty Channel"
    assert result["recentVideos"] == []
