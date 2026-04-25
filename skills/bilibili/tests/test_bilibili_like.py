"""Tests for bilibili/scripts/bilibili_like.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_like")
client_mod = load_script("bilibili", "bilibili_client")


@responses.activate
def test_like_video_success():
    """like_video returns success for valid like."""
    responses.post(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/archive/like"),
        json={"code": 0, "message": "0"},
        status=200,
    )

    client = client_mod.BilibiliClient("SESSDATA=abc; bili_jct=csrf123")
    result = mod.like_video(client, 123456)

    assert result["success"] is True
    assert result["action"] == "like"
    assert result["aid"] == 123456


@responses.activate
def test_unlike_video():
    """like_video with undo returns unlike action."""
    responses.post(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/archive/like"),
        json={"code": 0, "message": "0"},
        status=200,
    )

    client = client_mod.BilibiliClient("SESSDATA=abc; bili_jct=csrf123")
    result = mod.like_video(client, 123456, undo=True)

    assert result["success"] is True
    assert result["action"] == "unlike"


def test_like_video_no_cookie():
    """like_video raises when no cookie provided."""
    client = client_mod.BilibiliClient()
    try:
        mod.like_video(client, 123456)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "AUTH_REQUIRED"


def test_like_video_no_csrf():
    """like_video raises when cookie has no bili_jct."""
    client = client_mod.BilibiliClient("SESSDATA=abc")
    try:
        mod.like_video(client, 123456)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "NO_CSRF"
