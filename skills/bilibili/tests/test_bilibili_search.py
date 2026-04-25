"""Tests for bilibili/scripts/bilibili_search.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_search")
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

_SEARCH_VIDEO_RESPONSE = {
    "code": 0,
    "message": "0",
    "data": {
        "result": [
            {
                "bvid": "BVsearch1",
                "aid": 666,
                "title": "<em class=\"keyword\">Test</em> Search Result",
                "author": "SearchAuthor",
                "mid": 30,
                "description": "A search result",
                "duration": "5:30",
                "pic": "https://pic.jpg",
                "play": 15000,
                "danmaku": 45,
            },
        ],
    },
}

_SEARCH_USER_RESPONSE = {
    "code": 0,
    "message": "0",
    "data": {
        "result": [
            {
                "mid": 100,
                "uname": "<em class=\"keyword\">Test</em>User",
                "usign": "A test user",
                "fans": 5000,
                "videos": 42,
                "level": 5,
            },
        ],
    },
}


@responses.activate
def test_search_videos_strips_html():
    """search_videos strips HTML tags from title."""
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json=_NAV_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/wbi/search/type"), json=_SEARCH_VIDEO_RESPONSE, status=200)

    client = client_mod.BilibiliClient()
    result = mod.search_videos(client, "Test")

    assert result["keyword"] == "Test"
    assert result["count"] == 1
    assert result["videos"][0]["title"] == "Test Search Result"
    assert result["videos"][0]["bvid"] == "BVsearch1"
    assert result["videos"][0]["view"] == 15000


@responses.activate
def test_search_videos_empty():
    """search_videos returns empty list when no results."""
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json=_NAV_RESPONSE, status=200)
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/wbi/search/type"),
        json={"code": 0, "message": "0", "data": {"result": []}},
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.search_videos(client, "nonexistent")

    assert result["count"] == 0
    assert result["videos"] == []


@responses.activate
def test_search_users():
    """search_users returns correctly formatted user list."""
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json=_NAV_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/wbi/search/type"), json=_SEARCH_USER_RESPONSE, status=200)

    client = client_mod.BilibiliClient()
    result = mod.search_users(client, "Test")

    assert result["count"] == 1
    assert result["users"][0]["uname"] == "TestUser"
    assert result["users"][0]["fans"] == 5000


@responses.activate
def test_search_videos_api_error():
    """search_videos raises on API error."""
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json=_NAV_RESPONSE, status=200)
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/wbi/search/type"),
        json={"code": -412, "message": "Request blocked"},
        status=200,
    )

    client = client_mod.BilibiliClient()
    try:
        mod.search_videos(client, "blocked")
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "API_ERROR"
