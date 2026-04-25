"""Tests for bilibili/scripts/bilibili_subtitle.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("bilibili", "bilibili_subtitle")
client_mod = load_script("bilibili", "bilibili_client")

_VIDEO_RESPONSE = {
    "code": 0,
    "data": {
        "bvid": "BV1test1111",
        "cid": 99999,
        "title": "Test Video With Subs",
        "pages": [{"cid": 99999}],
    },
}

_NAV_RESPONSE = {
    "code": 0,
    "data": {"wbi_img": {"img_url": "https://i0.hdslb.com/bfs/wbi/abc.png", "sub_url": "https://i0.hdslb.com/bfs/wbi/def.png"}},
}

_PLAYER_RESPONSE = {
    "code": 0,
    "data": {
        "subtitle": {
            "subtitles": [
                {"lan": "zh-CN", "lan_doc": "中文（中国）", "subtitle_url": "//aisubtitle.hdslb.com/bfs/ai/12345.json"},
                {"lan": "en-US", "lan_doc": "English", "subtitle_url": "//aisubtitle.hdslb.com/bfs/ai/67890.json"},
            ]
        }
    },
}

_SUBTITLE_CDN = {
    "body": [
        {"from": 0.0, "to": 2.5, "content": "Hello"},
        {"from": 2.5, "to": 5.0, "content": "World"},
    ]
}


@responses.activate
def test_get_subtitle():
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"), json=_VIDEO_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json=_NAV_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/player/wbi/v2"), json=_PLAYER_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://aisubtitle\.hdslb\.com"), json=_SUBTITLE_CDN, status=200)

    client = client_mod.BilibiliClient()
    result = mod.get_subtitle(client, "BV1test1111")
    assert result["bvid"] == "BV1test1111"
    assert result["subtitle_count"] == 2
    assert result["selected_language"] == "zh-CN"
    assert len(result["items"]) == 2
    assert result["items"][0]["content"] == "Hello"
    assert result["items"][1]["content"] == "World"
    assert len(result["available_languages"]) == 2


@responses.activate
def test_get_subtitle_select_language():
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"), json=_VIDEO_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json=_NAV_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/player/wbi/v2"), json=_PLAYER_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://aisubtitle\.hdslb\.com"), json=_SUBTITLE_CDN, status=200)

    client = client_mod.BilibiliClient()
    result = mod.get_subtitle(client, "BV1test1111", lang="en-US")
    assert result["selected_language"] == "en-US"


@responses.activate
def test_get_subtitle_no_subtitles():
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"), json=_VIDEO_RESPONSE, status=200)
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/nav"), json=_NAV_RESPONSE, status=200)
    no_subs = {"code": 0, "data": {"subtitle": {"subtitles": []}}}
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/player/wbi/v2"), json=no_subs, status=200)

    client = client_mod.BilibiliClient()
    result = mod.get_subtitle(client, "BV1test1111")
    assert result["subtitle_count"] == 0
    assert result["items"] == []


@responses.activate
def test_get_subtitle_video_not_found():
    responses.get(url=re.compile(r"https://api\.bilibili\.com/x/web-interface/view"), json={"code": -404, "message": "啥都木有"}, status=200)

    client = client_mod.BilibiliClient()
    try:
        mod.get_subtitle(client, "BV1nonexist")
        assert False, "Should have raised"
    except client_mod.BilibiliApiError as e:
        assert e.code == "API_ERROR"
