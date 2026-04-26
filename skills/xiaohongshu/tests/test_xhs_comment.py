"""Tests for xiaohongshu/scripts/xhs_comment.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_comment")
client_mod = load_script("xiaohongshu", "xhs_client")

FAKE_COOKIE = "web_session=abc123; a1=def456"


@responses.activate
def test_post_comment():
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/comment/post"),
        json={"data": {"id": "comment_new_001"}, "code": 0},
        status=200,
    )

    result = mod.post_comment(FAKE_COOKIE, "69aa7160000000001b01634d", "好棒！")

    assert result["success"] is True
    assert result["note_id"] == "69aa7160000000001b01634d"
    assert result["comment_id"] == "comment_new_001"
    assert result["content"] == "好棒！"


def test_comment_requires_cookie():
    try:
        mod.post_comment("", "69aa7160000000001b01634d", "test")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "AUTH_REQUIRED"


def test_empty_comment_rejected():
    try:
        mod.post_comment(FAKE_COOKIE, "69aa7160000000001b01634d", "   ")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "EMPTY_COMMENT"
