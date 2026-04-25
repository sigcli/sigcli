"""Tests for bilibili/scripts/bilibili_history.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_history")
client_mod = load_script("bilibili", "bilibili_client")

FAKE_COOKIE = "SESSDATA=fakesession; bili_jct=fakecsrf"

_HISTORY_RESPONSE = {
    "code": 0,
    "data": {
        "cursor": {"view_at": 1700000000, "business": "archive"},
        "list": [
            {
                "title": "Video One",
                "author_name": "Author1",
                "author_mid": 111,
                "progress": 120,
                "duration": 300,
                "view_at": 1700000000,
                "tag_name": "Technology",
                "history": {"bvid": "BV1test1111"},
            },
            {
                "title": "Video Two",
                "author_name": "Author2",
                "author_mid": 222,
                "progress": -1,
                "duration": 600,
                "view_at": 1699999000,
                "tag_name": "Music",
                "history": {"bvid": "BV1test2222"},
            },
        ],
    },
}


@responses.activate
def test_get_history():
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/history/cursor"), json=_HISTORY_RESPONSE, status=200)
    client = client_mod.BilibiliClient(FAKE_COOKIE)
    result = mod.get_history(client, limit=20)
    assert result["count"] == 2
    assert result["cursor_view_at"] == 1700000000
    item1 = result["items"][0]
    assert item1["rank"] == 1
    assert item1["title"] == "Video One"
    assert item1["bvid"] == "BV1test1111"
    assert "40%" in item1["progress"]
    item2 = result["items"][1]
    assert item2["progress"] == "finished"


@responses.activate
def test_get_history_empty():
    empty = {"code": 0, "data": {"cursor": {}, "list": []}}
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/history/cursor"), json=empty, status=200)
    client = client_mod.BilibiliClient(FAKE_COOKIE)
    result = mod.get_history(client, limit=10)
    assert result["count"] == 0
    assert result["items"] == []


def test_get_history_requires_auth():
    client = client_mod.BilibiliClient("")
    try:
        mod.get_history(client)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "AUTH_REQUIRED"
