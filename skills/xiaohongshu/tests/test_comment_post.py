"""Tests for xiaohongshu/scripts/xhs_comment.py"""

import re
from unittest.mock import patch

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_comment")
client_mod = load_script("xiaohongshu", "xhs_client")

_COMMENT_POST_RESPONSE = {
    "code": 0,
    "success": True,
    "data": {
        "comment": {
            "id": "new_comment_001",
            "content": "Great post!",
            "create_time": 1715500000,
        },
    },
}


def _make_client():
    """Create a client without env vars using constructor directly."""
    return client_mod.XhsClient("a1=test; web_session=sess; webId=wid", "test", "sess", "wid")


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_post_comment(mock_jitter):
    """post_comment sends correct payload to /comment/post."""
    captured_body = None

    def capture(request):
        nonlocal captured_body
        import json
        captured_body = json.loads(request.body)
        return (200, {}, '{"code":0,"success":true,"data":{"comment":{"id":"new_comment_001","content":"Great post!","create_time":1715500000}}}')

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/comment/post"),
        callback=capture,
    )

    client = _make_client()
    result = mod.post_comment(client, "note_abc", "Great post!")

    assert result["note_id"] == "note_abc"
    assert result["content"] == "Great post!"
    assert result["action"] == "comment"
    assert result["success"] is True
    assert result["comment_id"] == "new_comment_001"
    assert captured_body["note_id"] == "note_abc"
    assert captured_body["content"] == "Great post!"
    assert captured_body["at_users"] == []
    assert "target_comment_id" not in captured_body


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_reply_to_comment(mock_jitter):
    """post_comment with target_comment_id sends reply payload."""
    captured_body = None

    def capture(request):
        nonlocal captured_body
        import json
        captured_body = json.loads(request.body)
        return (200, {}, '{"code":0,"success":true,"data":{"comment":{"id":"reply_001"}}}')

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/comment/post"),
        callback=capture,
    )

    client = _make_client()
    result = mod.post_comment(client, "note_abc", "Thanks!", target_comment_id="parent_comment")

    assert result["action"] == "reply"
    assert result["success"] is True
    assert captured_body["target_comment_id"] == "parent_comment"
    assert captured_body["note_id"] == "note_abc"
    assert captured_body["content"] == "Thanks!"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_comment_session_expired(mock_jitter):
    """post_comment raises SESSION_EXPIRED on 403."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/comment/post"),
        json={},
        status=403,
    )

    client = _make_client()
    try:
        mod.post_comment(client, "note_abc", "Hello")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "SESSION_EXPIRED"
