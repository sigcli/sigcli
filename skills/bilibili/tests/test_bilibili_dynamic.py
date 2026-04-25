"""Tests for bilibili/scripts/bilibili_dynamic.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_dynamic")
client_mod = load_script("bilibili", "bilibili_client")

FAKE_COOKIE = "SESSDATA=fakesession; bili_jct=fakecsrf"

_FEED_RESPONSE = {
    "code": 0,
    "data": {
        "items": [
            {
                "id_str": "900000001",
                "type": "DYNAMIC_TYPE_AV",
                "modules": {
                    "module_author": {"name": "TestUser", "mid": 123, "pub_ts": 1700000000},
                    "module_dynamic": {
                        "major": {"archive": {"title": "New Video Title"}},
                    },
                    "module_stat": {
                        "like": {"count": 50},
                        "comment": {"count": 10},
                        "forward": {"count": 5},
                    },
                },
            },
            {
                "id_str": "900000002",
                "type": "DYNAMIC_TYPE_WORD",
                "modules": {
                    "module_author": {"name": "Author2", "mid": 456, "pub_ts": 1700001000},
                    "module_dynamic": {
                        "desc": {"text": "Hello this is a text dynamic"},
                    },
                    "module_stat": {
                        "like": {"count": 20},
                        "comment": {"count": 3},
                        "forward": {"count": 0},
                    },
                },
            },
        ],
        "has_more": True,
        "offset": "900000002",
    },
}


@responses.activate
def test_get_dynamic_feed():
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/polymer/web-dynamic/v1/feed/all"), json=_FEED_RESPONSE, status=200)
    client = client_mod.BilibiliClient(FAKE_COOKIE)
    result = mod.get_dynamic_feed(client, limit=20)
    assert result["count"] == 2
    assert result["has_more"] is True
    assert result["offset"] == "900000002"
    d1 = result["dynamics"][0]
    assert d1["id"] == "900000001"
    assert d1["text"] == "New Video Title"
    assert d1["likes"] == 50
    d2 = result["dynamics"][1]
    assert d2["text"] == "Hello this is a text dynamic"


@responses.activate
def test_get_dynamic_feed_empty():
    empty = {"code": 0, "data": {"items": [], "has_more": False, "offset": ""}}
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/polymer/web-dynamic/v1/feed/all"), json=empty, status=200)
    client = client_mod.BilibiliClient(FAKE_COOKIE)
    result = mod.get_dynamic_feed(client, limit=10)
    assert result["count"] == 0
    assert result["dynamics"] == []


def test_get_dynamic_feed_requires_auth():
    client = client_mod.BilibiliClient("")
    try:
        mod.get_dynamic_feed(client)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "AUTH_REQUIRED"
