"""Tests for xiaohongshu/scripts/xhs_note.py"""

import json
import re

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_note")
client_mod = load_script("xiaohongshu", "xhs_client")

_NOTE_DATA = {
    "noteId": "69aa7160000000001b01634d",
    "title": "测试笔记标题",
    "desc": "这是一个测试笔记描述",
    "type": "normal",
    "user": {"userId": "user123", "nickname": "测试用户", "avatar": "https://example.com/avatar.jpg"},
    "interactInfo": {"likedCount": "100", "collectedCount": "50", "commentCount": "20", "shareCount": "10"},
    "imageList": [{"urlDefault": "https://example.com/img1.jpg"}, {"urlDefault": "https://example.com/img2.jpg"}],
    "tagList": [{"name": "旅行"}, {"name": "美食"}],
}

_SSR_HTML = (
    '<html><head></head><body><script>window.__INITIAL_STATE__='
    + json.dumps({"note": {"noteDetailMap": {"69aa7160000000001b01634d": _NOTE_DATA}}})
    + "</script></body></html>"
)


@responses.activate
def test_get_note_returns_parsed_detail():
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/explore/"), body=_SSR_HTML, status=200)

    client = client_mod.XhsClient()
    result = mod.get_note(client, "69aa7160000000001b01634d")

    assert result["note_id"] == "69aa7160000000001b01634d"
    assert result["title"] == "测试笔记标题"
    assert result["desc"] == "这是一个测试笔记描述"
    assert result["author"] == "测试用户"
    assert result["likes"] == 100
    assert result["collects"] == 50
    assert result["comments"] == 20
    assert len(result["images"]) == 2
    assert result["tags"] == ["旅行", "美食"]


@responses.activate
def test_get_note_from_url():
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/explore/"), body=_SSR_HTML, status=200)

    client = client_mod.XhsClient()
    result = mod.get_note(client, "https://www.xiaohongshu.com/explore/69aa7160000000001b01634d?xsec_token=abc")

    assert result["note_id"] == "69aa7160000000001b01634d"
    assert result["author_id"] == "user123"


@responses.activate
def test_get_note_login_required():
    html = "<html><body>登录后查看更多内容</body></html>"
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/explore/"), body=html, status=200)

    client = client_mod.XhsClient()
    try:
        mod.get_note(client, "69aa7160000000001b01634d")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "LOGIN_REQUIRED"


@responses.activate
def test_get_note_not_found_in_state():
    empty_html = (
        '<html><script>window.__INITIAL_STATE__='
        + json.dumps({"note": {"noteDetailMap": {}}})
        + "</script></html>"
    )
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/explore/"), body=empty_html, status=200)

    client = client_mod.XhsClient()
    try:
        mod.get_note(client, "69aa7160000000001b01634d")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "NOT_FOUND"
