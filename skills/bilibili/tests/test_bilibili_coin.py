"""Tests for bilibili/scripts/bilibili_coin.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_coin")
client_mod = load_script("bilibili", "bilibili_client")


@responses.activate
def test_coin_video_success():
    """coin_video returns success for valid coin."""
    responses.post(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/coin/add"),
        json={"code": 0, "message": "0"},
        status=200,
    )

    client = client_mod.BilibiliClient("SESSDATA=abc; bili_jct=csrf123")
    result = mod.coin_video(client, 123456, multiply=1)

    assert result["success"] is True
    assert result["multiply"] == 1
    assert result["aid"] == 123456


@responses.activate
def test_coin_video_two_coins():
    """coin_video works with multiply=2."""
    responses.post(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/coin/add"),
        json={"code": 0, "message": "0"},
        status=200,
    )

    client = client_mod.BilibiliClient("SESSDATA=abc; bili_jct=csrf123")
    result = mod.coin_video(client, 123456, multiply=2)

    assert result["success"] is True
    assert result["multiply"] == 2


def test_coin_video_invalid_multiply():
    """coin_video raises on invalid multiply value."""
    client = client_mod.BilibiliClient("SESSDATA=abc; bili_jct=csrf123")
    try:
        mod.coin_video(client, 123456, multiply=3)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "INVALID_PARAM"


def test_coin_video_no_cookie():
    """coin_video raises when no cookie provided."""
    client = client_mod.BilibiliClient()
    try:
        mod.coin_video(client, 123456)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "AUTH_REQUIRED"
