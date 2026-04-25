"""Tests for bilibili/scripts/bilibili_comments.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_comments")
client_mod = load_script("bilibili", "bilibili_client")

_VIEW_RESPONSE = {
    "code": 0,
    "data": {"aid": 123456, "bvid": "BV1test"},
}

_COMMENTS_RESPONSE = {
    "code": 0,
    "message": "0",
    "data": {
        "page": {"count": 100},
        "replies": [
            {
                "rpid": 1001,
                "member": {"mid": 50, "uname": "Commenter1"},
                "content": {"message": "Great video!"},
                "like": 20,
                "rcount": 2,
                "ctime": 1700000000,
            },
            {
                "rpid": 1002,
                "member": {"mid": 51, "uname": "Commenter2"},
                "content": {"message": "Nice work"},
                "like": 5,
                "rcount": 0,
                "ctime": 1700001000,
            },
        ],
    },
}


@responses.activate
def test_get_comments_returns_list():
    """get_comments returns correctly formatted comment list."""
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"), json=_VIEW_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/v2/reply"), json=_COMMENTS_RESPONSE, status=200)

    client = client_mod.BilibiliClient()
    result = mod.get_comments(client, "BV1test")

    assert result["bvid"] == "BV1test"
    assert result["aid"] == 123456
    assert result["total"] == 100
    assert result["count"] == 2
    assert result["comments"][0]["author"] == "Commenter1"
    assert result["comments"][0]["text"] == "Great video!"
    assert result["comments"][0]["like"] == 20


@responses.activate
def test_get_comments_empty():
    """get_comments returns empty list when no comments."""
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"), json=_VIEW_RESPONSE, status=200)
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/v2/reply"),
        json={"code": 0, "data": {"page": {"count": 0}, "replies": []}},
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_comments(client, "BV1test")

    assert result["count"] == 0
    assert result["comments"] == []


@responses.activate
def test_get_comments_video_not_found():
    """get_comments raises when video cannot be resolved."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"),
        json={"code": -404, "message": "Video not found"},
        status=200,
    )

    client = client_mod.BilibiliClient()
    try:
        mod.get_comments(client, "BVnotfound")
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "API_ERROR"


@responses.activate
def test_get_comments_null_replies():
    """get_comments handles null replies gracefully."""
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"), json=_VIEW_RESPONSE, status=200)
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/v2/reply"),
        json={"code": 0, "data": {"page": {"count": 0}, "replies": None}},
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_comments(client, "BV1test")

    assert result["count"] == 0
    assert result["comments"] == []
