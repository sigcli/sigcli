"""Tests for bilibili/scripts/bilibili_favorite.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_favorite")
client_mod = load_script("bilibili", "bilibili_client")


@responses.activate
def test_favorite_video_success():
    """favorite_video returns success for adding to favorites."""
    responses.post(
        url=re.compile(r"https://api\.bilibili\.com/x/v3/fav/resource/deal"),
        json={"code": 0, "message": "0"},
        status=200,
    )

    client = client_mod.BilibiliClient("SESSDATA=abc; bili_jct=csrf123")
    result = mod.favorite_video(client, 123456, 100)

    assert result["success"] is True
    assert result["action"] == "favorite"
    assert result["folder_id"] == 100


@responses.activate
def test_unfavorite_video():
    """favorite_video with undo removes from favorites."""
    responses.post(
        url=re.compile(r"https://api\.bilibili\.com/x/v3/fav/resource/deal"),
        json={"code": 0, "message": "0"},
        status=200,
    )

    client = client_mod.BilibiliClient("SESSDATA=abc; bili_jct=csrf123")
    result = mod.favorite_video(client, 123456, 100, undo=True)

    assert result["success"] is True
    assert result["action"] == "unfavorite"


def test_favorite_video_no_cookie():
    """favorite_video raises when no cookie provided."""
    client = client_mod.BilibiliClient()
    try:
        mod.favorite_video(client, 123456, 100)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "AUTH_REQUIRED"


@responses.activate
def test_favorite_video_api_error():
    """favorite_video raises on API error."""
    responses.post(
        url=re.compile(r"https://api\.bilibili\.com/x/v3/fav/resource/deal"),
        json={"code": -403, "message": "Access denied"},
        status=200,
    )

    client = client_mod.BilibiliClient("SESSDATA=abc; bili_jct=csrf123")
    try:
        mod.favorite_video(client, 123456, 100)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "API_ERROR"
