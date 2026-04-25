"""Tests for bilibili/scripts/bilibili_popular.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_popular")
client_mod = load_script("bilibili", "bilibili_client")

_POPULAR_RESPONSE = {
    "code": 0,
    "message": "0",
    "data": {
        "list": [
            {
                "bvid": "BVpop1",
                "aid": 333,
                "title": "Popular Video",
                "desc": "",
                "pic": "",
                "duration": 180,
                "pubdate": 1700000000,
                "owner": {"mid": 10, "name": "PopAuthor", "face": ""},
                "stat": {"view": 20000, "like": 1000, "coin": 500, "favorite": 300, "share": 100, "reply": 200, "danmaku": 80},
            },
        ],
        "no_more": False,
    },
}


@responses.activate
def test_get_popular_videos_returns_list():
    """get_popular_videos returns correctly formatted list."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/popular"),
        json=_POPULAR_RESPONSE,
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_popular_videos(client, 20)

    assert result["count"] == 1
    assert result["no_more"] is False
    assert result["videos"][0]["title"] == "Popular Video"
    assert result["videos"][0]["view"] == 20000


@responses.activate
def test_get_popular_videos_empty():
    """get_popular_videos returns empty list."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/popular"),
        json={"code": 0, "message": "0", "data": {"list": [], "no_more": True}},
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_popular_videos(client, 20)

    assert result["count"] == 0
    assert result["no_more"] is True
    assert result["videos"] == []


@responses.activate
def test_get_popular_videos_api_error():
    """get_popular_videos raises on API error."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/popular"),
        json={"code": -400, "message": "Bad request"},
        status=200,
    )

    client = client_mod.BilibiliClient()
    try:
        mod.get_popular_videos(client, 20)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError:
        pass
