"""Tests for xiaohongshu/scripts/xhs_user.py"""

import json
import re

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_user")
client_mod = load_script("xiaohongshu", "xhs_client")

_USER_STATE = {
    "user": {
        "userPageData": {
            "basicInfo": {
                "nickname": "测试博主",
                "desc": "旅行达人",
                "gender": "1",
                "ipLocation": "上海",
                "imageb": "https://example.com/avatar.jpg",
            },
            "interactions": [
                {"type": "follows", "count": "120"},
                {"type": "fans", "count": "5000"},
                {"type": "interaction", "count": "1.5万"},
            ],
        },
        "notes": [
            {
                "noteId": "bbb222000000000000000001",
                "noteCard": {
                    "displayTitle": "用户笔记1",
                    "type": "normal",
                    "interactInfo": {"likedCount": "300"},
                },
                "xsecToken": "token123",
            },
        ],
    }
}

_SSR_HTML = (
    "<html><script>window.__INITIAL_STATE__="
    + json.dumps(_USER_STATE)
    + "</script></html>"
)


@responses.activate
def test_get_user_profile():
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/user/profile/"), body=_SSR_HTML, status=200)

    client = client_mod.XhsClient()
    result = mod.get_user(client, "user123abc")

    assert result["user_id"] == "user123abc"
    assert result["nickname"] == "测试博主"
    assert result["desc"] == "旅行达人"
    assert result["fans"] == "5000"
    assert result["note_count"] == 1


@responses.activate
def test_get_user_from_url():
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/user/profile/"), body=_SSR_HTML, status=200)

    client = client_mod.XhsClient()
    result = mod.get_user(client, "https://www.xiaohongshu.com/user/profile/user123abc")

    assert result["user_id"] == "user123abc"
    assert result["notes"][0]["title"] == "用户笔记1"
    assert "xsec_token=token123" in result["notes"][0]["url"]


@responses.activate
def test_get_user_without_notes():
    responses.get(url=re.compile(r"https://www\.xiaohongshu\.com/user/profile/"), body=_SSR_HTML, status=200)

    client = client_mod.XhsClient()
    result = mod.get_user(client, "user123abc", include_notes=False)

    assert "notes" not in result
    assert "note_count" not in result
    assert result["nickname"] == "测试博主"
