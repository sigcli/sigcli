"""Tests for bilibili/scripts/bilibili_hot.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_hot")
client_mod = load_script("bilibili", "bilibili_client")

_HOT_RESPONSE = {
    "code": 0,
    "message": "0",
    "data": {
        "list": [
            {
                "bvid": "BV1abc",
                "aid": 111,
                "title": "Hot Video 1",
                "desc": "desc1",
                "pic": "https://pic1.jpg",
                "duration": 120,
                "pubdate": 1700000000,
                "owner": {"mid": 1, "name": "Author1", "face": ""},
                "stat": {"view": 5000, "like": 300, "coin": 100, "favorite": 50, "share": 20, "reply": 40, "danmaku": 15},
            },
            {
                "bvid": "BV2def",
                "aid": 222,
                "title": "Hot Video 2",
                "desc": "desc2",
                "pic": "https://pic2.jpg",
                "duration": 600,
                "pubdate": 1700001000,
                "owner": {"mid": 2, "name": "Author2", "face": ""},
                "stat": {"view": 8000, "like": 600, "coin": 200, "favorite": 80, "share": 30, "reply": 60, "danmaku": 25},
            },
        ],
    },
}


@responses.activate
def test_get_hot_videos_returns_list():
    """get_hot_videos returns correctly formatted video list."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/popular"),
        json=_HOT_RESPONSE,
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_hot_videos(client, 20)

    assert result["count"] == 2
    assert result["page"] == 1
    assert len(result["videos"]) == 2
    assert result["videos"][0]["title"] == "Hot Video 1"
    assert result["videos"][1]["view"] == 8000


@responses.activate
def test_get_hot_videos_empty():
    """get_hot_videos returns empty list when no videos."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/popular"),
        json={"code": 0, "message": "0", "data": {"list": []}},
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_hot_videos(client, 20)

    assert result["count"] == 0
    assert result["videos"] == []


@responses.activate
def test_get_hot_videos_api_error():
    """get_hot_videos raises on API error."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/popular"),
        json={"code": -500, "message": "Server error"},
        status=200,
    )

    client = client_mod.BilibiliClient()
    try:
        mod.get_hot_videos(client, 20)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "API_ERROR"
