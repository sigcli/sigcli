"""Tests for bilibili/scripts/bilibili_video.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_video")
client_mod = load_script("bilibili", "bilibili_client")

_VIDEO_RESPONSE = {
    "code": 0,
    "message": "0",
    "data": {
        "bvid": "BV1xx411c7mD",
        "aid": 123456,
        "title": "Test Video Title",
        "desc": "A test video description",
        "pic": "https://i0.hdslb.com/bfs/archive/test.jpg",
        "duration": 300,
        "pubdate": 1700000000,
        "owner": {"mid": 789, "name": "TestAuthor", "face": "https://face.jpg"},
        "stat": {"view": 10000, "like": 500, "coin": 200, "favorite": 100, "share": 50, "reply": 80, "danmaku": 30},
        "videos": 1,
    },
}


@responses.activate
def test_get_video_returns_parsed_data():
    """get_video returns correctly parsed video data."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"),
        json=_VIDEO_RESPONSE,
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_video(client, "BV1xx411c7mD")

    assert result["bvid"] == "BV1xx411c7mD"
    assert result["aid"] == 123456
    assert result["title"] == "Test Video Title"
    assert result["author"] == "TestAuthor"
    assert result["author_mid"] == 789
    assert result["view"] == 10000
    assert result["like"] == 500
    assert result["duration"] == 300
    assert result["duration_text"] == "5m0s"


@responses.activate
def test_get_video_api_error():
    """get_video raises BilibiliApiError on non-zero code."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"),
        json={"code": -400, "message": "Invalid bvid"},
        status=200,
    )

    client = client_mod.BilibiliClient()
    try:
        mod.get_video(client, "BVinvalid")
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "API_ERROR"
        assert "Invalid bvid" in e.message


@responses.activate
def test_get_video_missing_stats():
    """get_video handles missing stat fields gracefully."""
    data = dict(_VIDEO_RESPONSE)
    data["data"] = {**data["data"], "stat": {}}
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"),
        json=data,
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_video(client, "BV1xx411c7mD")

    assert result["view"] == 0
    assert result["like"] == 0
