"""Tests for xiaohongshu/scripts/xhs_like.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_like")
client_mod = load_script("xiaohongshu", "xhs_client")

FAKE_COOKIE = "web_session=abc123; a1=def456"


@responses.activate
def test_like_note():
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/note/like"),
        json={"success": True, "code": 0},
        status=200,
    )

    result = mod.like_note(FAKE_COOKIE, "69aa7160000000001b01634d")

    assert result["success"] is True
    assert result["action"] == "liked"
    assert result["note_id"] == "69aa7160000000001b01634d"


@responses.activate
def test_unlike_note():
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/note/dislike"),
        json={"success": True, "code": 0},
        status=200,
    )

    result = mod.like_note(FAKE_COOKIE, "69aa7160000000001b01634d", undo=True)

    assert result["success"] is True
    assert result["action"] == "unliked"


def test_like_requires_cookie():
    try:
        mod.like_note("", "69aa7160000000001b01634d")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "AUTH_REQUIRED"
