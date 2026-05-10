"""Tests for xiaohongshu/scripts/xhs_follow.py"""

import re
from unittest.mock import patch

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_follow")
client_mod = load_script("xiaohongshu", "xhs_client")


def _make_client():
    """Create a client without env vars using constructor directly."""
    return client_mod.XhsClient("a1=test; web_session=sess; webId=wid", "test", "sess", "wid")


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_follow_user(mock_jitter):
    """follow_user sends POST to /user/follow with target_user_id."""
    captured_body = None

    def capture(request):
        nonlocal captured_body
        import json
        captured_body = json.loads(request.body)
        return (200, {}, '{"code":0,"success":true,"data":{}}')

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/user/follow"),
        callback=capture,
    )

    client = _make_client()
    result = mod.follow_user(client, "user_123")

    assert result["user_id"] == "user_123"
    assert result["action"] == "follow"
    assert result["success"] is True
    assert captured_body["target_user_id"] == "user_123"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_unfollow_user(mock_jitter):
    """unfollow_user sends POST to /user/unfollow with target_user_id."""
    captured_body = None

    def capture(request):
        nonlocal captured_body
        import json
        captured_body = json.loads(request.body)
        return (200, {}, '{"code":0,"success":true,"data":{}}')

    responses.add_callback(
        responses.POST,
        re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/user/unfollow"),
        callback=capture,
    )

    client = _make_client()
    result = mod.unfollow_user(client, "user_123")

    assert result["user_id"] == "user_123"
    assert result["action"] == "unfollow"
    assert result["success"] is True
    assert captured_body["target_user_id"] == "user_123"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_follow_session_expired(mock_jitter):
    """follow_user raises SESSION_EXPIRED on 401."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/user/follow"),
        json={},
        status=401,
    )

    client = _make_client()
    try:
        mod.follow_user(client, "user_123")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "SESSION_EXPIRED"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_follow_captcha(mock_jitter):
    """follow_user raises CAPTCHA_REQUIRED on 461."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/user/follow"),
        json={},
        status=461,
    )

    client = _make_client()
    try:
        mod.follow_user(client, "user_123")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "CAPTCHA_REQUIRED"
