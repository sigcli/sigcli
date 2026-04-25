"""Tests for youtube/scripts/youtube_video.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("youtube", "youtube_video")
client_mod = load_script("youtube", "youtube_client")

_PLAYER_RESPONSE = {
    "videoDetails": {
        "videoId": "dQw4w9WgXcQ",
        "title": "Rick Astley - Never Gonna Give You Up",
        "author": "Rick Astley",
        "channelId": "UCuAXFkgsw1L7xaCfnd5JJOw",
        "viewCount": "1500000000",
        "lengthSeconds": "212",
        "shortDescription": "The official video for Rick Astley",
        "keywords": ["rick astley", "never gonna give you up"],
        "isLiveContent": False,
        "thumbnail": {"thumbnails": [{"url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", "width": 480, "height": 360}]},
    },
    "microformat": {
        "playerMicroformatRenderer": {
            "publishDate": "2009-10-25",
            "category": "Music",
        }
    },
}


@responses.activate
def test_get_video_returns_details():
    """get_video returns correctly formatted video details."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/player"),
        json=_PLAYER_RESPONSE,
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_video(client, "dQw4w9WgXcQ")

    assert result["videoId"] == "dQw4w9WgXcQ"
    assert result["title"] == "Rick Astley - Never Gonna Give You Up"
    assert result["author"] == "Rick Astley"
    assert result["channelId"] == "UCuAXFkgsw1L7xaCfnd5JJOw"
    assert result["viewCount"] == "1500000000"
    assert result["lengthSeconds"] == "212"
    assert result["category"] == "Music"
    assert result["publishDate"] == "2009-10-25"
    assert result["isLive"] is False
    assert "hqdefault" in result["thumbnail"]


@responses.activate
def test_get_video_minimal_response():
    """get_video handles minimal player response."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/player"),
        json={"videoDetails": {"videoId": "abc123", "title": "Test"}, "microformat": {}},
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_video(client, "abc123")

    assert result["videoId"] == "abc123"
    assert result["title"] == "Test"
    assert result["author"] == ""
    assert result["thumbnail"] == ""


@responses.activate
def test_get_video_with_url_parsing():
    """get_video works when given a full URL."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/player"),
        json=_PLAYER_RESPONSE,
        status=200,
    )

    client = client_mod.YouTubeClient()
    video_id = client_mod.parse_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    result = mod.get_video(client, video_id)

    assert result["videoId"] == "dQw4w9WgXcQ"
    assert result["title"] == "Rick Astley - Never Gonna Give You Up"


@responses.activate
def test_get_video_live_content():
    """get_video correctly reports live content."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/player"),
        json={
            "videoDetails": {"videoId": "live123", "title": "Live Stream", "isLiveContent": True, "lengthSeconds": "0"},
            "microformat": {},
        },
        status=200,
    )

    client = client_mod.YouTubeClient()
    result = mod.get_video(client, "live123")

    assert result["isLive"] is True
    assert result["lengthSeconds"] == "0"
