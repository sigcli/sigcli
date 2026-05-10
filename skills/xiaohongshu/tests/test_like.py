"""Tests for xiaohongshu/scripts/xhs_like.py"""

import re
from unittest.mock import patch

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_like")
client_mod = load_script("xiaohongshu", "xhs_client")

_LIKE_OK = {"code": 0, "success": True, "data": {}}
_DISLIKE_OK = {"code": 0, "success": True, "data": {}}


def _make_client():
    """Create a client without env vars using constructor directly."""
    return client_mod.XhsClient("a1=test; web_session=sess; webId=wid", "test", "sess", "wid")


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_like_note(mock_jitter):
    """like_note sends POST to /note/like with note_oid."""
    captured_body = None

    def capture(request):
        nonlocal captured_body
        import json
        captured_body = json.loads(request.body)
        return (200, {}, '{"code":0,"success":true,"data":{}}')

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/note/like"),
        callback=capture,
    )

    client = _make_client()
    result = mod.like_note(client, "note_abc")

    assert result["note_id"] == "note_abc"
    assert result["action"] == "like"
    assert result["success"] is True
    assert captured_body["note_oid"] == "note_abc"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_unlike_note(mock_jitter):
    """unlike_note sends POST to /note/dislike with note_oid."""
    captured_body = None

    def capture(request):
        nonlocal captured_body
        import json
        captured_body = json.loads(request.body)
        return (200, {}, '{"code":0,"success":true,"data":{}}')

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/note/dislike"),
        callback=capture,
    )

    client = _make_client()
    result = mod.unlike_note(client, "note_abc")

    assert result["note_id"] == "note_abc"
    assert result["action"] == "unlike"
    assert result["success"] is True
    assert captured_body["note_oid"] == "note_abc"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_like_session_expired(mock_jitter):
    """like_note raises SESSION_EXPIRED on 401."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/note/like"),
        json={},
        status=401,
    )

    client = _make_client()
    try:
        mod.like_note(client, "note_abc")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "SESSION_EXPIRED"
