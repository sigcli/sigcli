"""Tests for bilibili/scripts/bilibili_user.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_user")
client_mod = load_script("bilibili", "bilibili_client")

_NAV_RESPONSE = {
    "code": 0,
    "data": {
        "wbi_img": {
            "img_url": "https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png",
            "sub_url": "https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png",
        },
    },
}

_CARD_RESPONSE = {
    "code": 0,
    "data": {
        "card": {
            "mid": "12345",
            "name": "TestUser",
            "face": "https://face.jpg",
            "sign": "Hello world",
            "level_info": {"current_level": 6},
            "sex": "male",
            "fans": 10000,
            "attention": 200,
        },
    },
}


@responses.activate
def test_get_user_returns_profile():
    """get_user returns correctly formatted user profile."""
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/card"), json=_CARD_RESPONSE, status=200)

    client = client_mod.BilibiliClient()
    result = mod.get_user(client, 12345)

    assert result["mid"] == "12345"
    assert result["name"] == "TestUser"
    assert result["level"] == 6
    assert result["fans"] == 10000
    assert "recent_videos" not in result


@responses.activate
def test_get_user_api_error():
    """get_user raises on API error."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/card"),
        json={"code": -404, "message": "User not found"},
        status=200,
    )

    client = client_mod.BilibiliClient()
    try:
        mod.get_user(client, 99999)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "API_ERROR"


@responses.activate
def test_get_user_with_videos():
    """get_user includes recent videos when requested."""
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/card"), json=_CARD_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json=_NAV_RESPONSE, status=200)
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/space/wbi/arc/search"),
        json={
            "code": 0,
            "data": {
                "list": {
                    "vlist": [
                        {
                            "bvid": "BVuser1", "aid": 777, "title": "User Video", "description": "",
                            "length": "3:20", "pic": "", "play": 5000, "created": 1700000000,
                        },
                    ],
                },
            },
        },
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_user(client, 12345, include_videos=True)

    assert result["name"] == "TestUser"
    assert len(result["recent_videos"]) == 1
    assert result["recent_videos"][0]["title"] == "User Video"
