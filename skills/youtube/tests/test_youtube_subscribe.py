"""Tests for youtube/scripts/youtube_subscribe.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("youtube", "youtube_subscribe")
client_mod = load_script("youtube", "youtube_client")

_FAKE_COOKIE = "SAPISID=abc123def; SID=otherstuff; HSID=morethings"


@responses.activate
def test_subscribe_success():
    """subscribe_channel subscribes to a channel."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/subscription/subscribe"),
        json={},
        status=200,
    )

    result = mod.subscribe_channel(_FAKE_COOKIE, "UCuAXFkgsw1L7xaCfnd5JJOw", "subscribe")

    assert result["success"] is True
    assert result["channelId"] == "UCuAXFkgsw1L7xaCfnd5JJOw"
    assert result["action"] == "subscribe"


@responses.activate
def test_unsubscribe_success():
    """subscribe_channel unsubscribes from a channel."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/subscription/unsubscribe"),
        json={},
        status=200,
    )

    result = mod.subscribe_channel(_FAKE_COOKIE, "UCuAXFkgsw1L7xaCfnd5JJOw", "unsubscribe")

    assert result["success"] is True
    assert result["action"] == "unsubscribe"


@responses.activate
def test_subscribe_resolves_handle():
    """subscribe_channel resolves @handle to channel ID."""
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/navigation/resolve_url"),
        json={"endpoint": {"browseEndpoint": {"browseId": "UCuAXFkgsw1L7xaCfnd5JJOw"}}},
        status=200,
    )
    responses.post(
        url=re.compile(r"https://www\.youtube\.com/youtubei/v1/subscription/subscribe"),
        json={},
        status=200,
    )

    result = mod.subscribe_channel(_FAKE_COOKIE, "@RickAstleyYT", "subscribe")

    assert result["success"] is True
    assert result["channelId"] == "UCuAXFkgsw1L7xaCfnd5JJOw"


def test_subscribe_requires_auth():
    """subscribe_channel raises error without cookie."""
    try:
        mod.subscribe_channel("", "UCuAXFkgsw1L7xaCfnd5JJOw", "subscribe")
        assert False, "Should have raised"
    except client_mod.YouTubeApiError as e:
        assert e.code == "AUTH_REQUIRED"
