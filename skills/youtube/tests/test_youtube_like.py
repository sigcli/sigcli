"""Tests for youtube/scripts/youtube_like.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("youtube", "youtube_like")
client_mod = load_script("youtube", "youtube_client")

_FAKE_COOKIE = "SAPISID=abc123def; SID=otherstuff; HSID=morethings"


@responses.activate
def test_like_video_success():
    """like_video returns success on valid like."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/like/like"),
        json={},
        status=200,
    )

    result = mod.like_video(_FAKE_COOKIE, "dQw4w9WgXcQ", "like")

    assert result["success"] is True
    assert result["videoId"] == "dQw4w9WgXcQ"
    assert result["action"] == "like"


@responses.activate
def test_unlike_video_success():
    """like_video with unlike action calls removelike endpoint."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/like/removelike"),
        json={},
        status=200,
    )

    result = mod.like_video(_FAKE_COOKIE, "dQw4w9WgXcQ", "unlike")

    assert result["success"] is True
    assert result["action"] == "unlike"


def test_like_video_requires_auth():
    """like_video raises error without cookie."""
    try:
        mod.like_video("", "dQw4w9WgXcQ", "like")
        assert False, "Should have raised"
    except client_mod.YouTubeApiError as e:
        assert e.code == "AUTH_REQUIRED"


@responses.activate
def test_like_sends_auth_header():
    """like_video sends SAPISIDHASH Authorization header."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/like/like"),
        json={},
        status=200,
    )

    mod.like_video(_FAKE_COOKIE, "abc123", "like")

    assert len(responses.calls) == 1
    auth = responses.calls[0].request.headers.get("Authorization", "")
    assert auth.startswith("SAPISIDHASH ")
