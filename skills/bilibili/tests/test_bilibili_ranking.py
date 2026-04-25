"""Tests for bilibili/scripts/bilibili_ranking.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_ranking")
client_mod = load_script("bilibili", "bilibili_client")

_RANKING_RESPONSE = {
    "code": 0,
    "message": "0",
    "data": {
        "list": [
            {
                "bvid": "BVrank1",
                "aid": 444,
                "title": "Ranked Video 1",
                "desc": "",
                "pic": "",
                "duration": 240,
                "pubdate": 1700000000,
                "owner": {"mid": 20, "name": "RankAuthor", "face": ""},
                "stat": {"view": 50000, "like": 3000, "coin": 1000, "favorite": 500, "share": 200, "reply": 400, "danmaku": 150},
            },
            {
                "bvid": "BVrank2",
                "aid": 555,
                "title": "Ranked Video 2",
                "desc": "",
                "pic": "",
                "duration": 360,
                "pubdate": 1700001000,
                "owner": {"mid": 21, "name": "RankAuthor2", "face": ""},
                "stat": {"view": 40000, "like": 2000, "coin": 800, "favorite": 400, "share": 150, "reply": 300, "danmaku": 100},
            },
        ],
    },
}


@responses.activate
def test_get_ranking_returns_list():
    """get_ranking returns correctly formatted ranking list."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/ranking/v2"),
        json=_RANKING_RESPONSE,
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_ranking(client, "all", 20)

    assert result["category"] == "all"
    assert result["tid"] == 0
    assert result["count"] == 2
    assert result["videos"][0]["title"] == "Ranked Video 1"
    assert result["videos"][0]["view"] == 50000


@responses.activate
def test_get_ranking_respects_limit():
    """get_ranking slices results to the given limit."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/ranking/v2"),
        json=_RANKING_RESPONSE,
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_ranking(client, "all", 1)

    assert result["count"] == 1
    assert len(result["videos"]) == 1


@responses.activate
def test_get_ranking_api_error():
    """get_ranking raises on API error."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/ranking/v2"),
        json={"code": -500, "message": "Server error"},
        status=200,
    )

    client = client_mod.BilibiliClient()
    try:
        mod.get_ranking(client, "all", 20)
        assert False, "Should have raised"
    except client_mod.BilibiliApiError:
        pass


@responses.activate
def test_get_ranking_with_category():
    """get_ranking resolves category name to tid."""
    responses.get(
        url=re.compile(r"https://api\.bilibili\.com/x/web-interface/ranking/v2"),
        json=_RANKING_RESPONSE,
        status=200,
    )

    client = client_mod.BilibiliClient()
    result = mod.get_ranking(client, "music", 20)

    assert result["category"] == "music"
    assert result["tid"] == 3
