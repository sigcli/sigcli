"""Tests for xiaohongshu/scripts/xhs_favorite.py"""

import re
from unittest.mock import patch

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_favorite")
client_mod = load_script("xiaohongshu", "xhs_client")


def _make_client():
    """Create a client without env vars using constructor directly."""
    return client_mod.XhsClient("a1=test; web_session=sess; webId=wid", "test", "sess", "wid")


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_favorite_note(mock_jitter):
    """favorite_note sends POST to /note/collect with note_id."""
    captured_body = None

    def capture(request):
        nonlocal captured_body
        import json
        captured_body = json.loads(request.body)
        return (200, {}, '{"code":0,"success":true,"data":{}}')

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/note/collect"),
        callback=capture,
    )

    client = _make_client()
    result = mod.favorite_note(client, "note_xyz")

    assert result["note_id"] == "note_xyz"
    assert result["action"] == "favorite"
    assert result["success"] is True
    assert captured_body["note_id"] == "note_xyz"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_unfavorite_note(mock_jitter):
    """unfavorite_note sends POST to /note/uncollect with note_ids."""
    captured_body = None

    def capture(request):
        nonlocal captured_body
        import json
        captured_body = json.loads(request.body)
        return (200, {}, '{"code":0,"success":true,"data":{}}')

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/note/uncollect"),
        callback=capture,
    )

    client = _make_client()
    result = mod.unfavorite_note(client, "note_xyz")

    assert result["note_id"] == "note_xyz"
    assert result["action"] == "unfavorite"
    assert result["success"] is True
    assert captured_body["note_ids"] == "note_xyz"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_favorite_captcha(mock_jitter):
    """favorite_note raises CAPTCHA_REQUIRED on 461."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/note/collect"),
        json={},
        status=461,
    )

    client = _make_client()
    try:
        mod.favorite_note(client, "note_xyz")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "CAPTCHA_REQUIRED"
