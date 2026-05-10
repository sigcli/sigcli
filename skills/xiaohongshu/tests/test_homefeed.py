"""Tests for xiaohongshu/scripts/xhs_homefeed.py"""

import re
from unittest.mock import patch

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_homefeed")
client_mod = load_script("xiaohongshu", "xhs_client")

_HOMEFEED_RESPONSE = {
    "code": 0,
    "success": True,
    "data": {
        "items": [
            {
                "id": "feed_note_001",
                "xsec_token": "tok_feed_1",
                "note_card": {
                    "display_title": "Morning Coffee",
                    "type": "normal",
                    "user": {"nickname": "CoffeeLover", "user_id": "u10"},
                    "interact_info": {"liked_count": "2500"},
                    "cover": {"url_default": "https://img.xhs.com/coffee.jpg"},
                },
            },
            {
                "id": "feed_note_002",
                "xsec_token": "tok_feed_2",
                "note_card": {
                    "display_title": "Sunset View",
                    "type": "video",
                    "user": {"nickname": "Photographer", "user_id": "u11"},
                    "interact_info": {"liked_count": "8000"},
                    "cover": {"url_default": "https://img.xhs.com/sunset.jpg"},
                },
            },
        ],
        "cursor_score": "score_abc",
    },
}

_HOMEFEED_EMPTY = {
    "code": 0,
    "success": True,
    "data": {
        "items": [],
        "cursor_score": "",
    },
}


def _make_client():
    """Create a client without env vars using constructor directly."""
    return client_mod.XhsClient("a1=test; web_session=sess; webId=wid", "test", "sess", "wid")


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_homefeed_returns_notes(mock_jitter):
    """get_homefeed returns parsed note list."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/homefeed"),
        json=_HOMEFEED_RESPONSE,
        status=200,
    )

    client = _make_client()
    result = mod.get_homefeed(client)

    assert result["category"] == "homefeed_recommend"
    assert len(result["notes"]) == 2
    assert result["notes"][0]["note_id"] == "feed_note_001"
    assert result["notes"][0]["title"] == "Morning Coffee"
    assert result["notes"][1]["note_id"] == "feed_note_002"
    assert result["notes"][1]["type"] == "video"
    assert result["cursor_score"] == "score_abc"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_homefeed_empty(mock_jitter):
    """get_homefeed returns empty list when no items."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/homefeed"),
        json=_HOMEFEED_EMPTY,
        status=200,
    )

    client = _make_client()
    result = mod.get_homefeed(client)

    assert result["notes"] == []
    assert result["cursor_score"] == ""


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_homefeed_respects_limit(mock_jitter):
    """get_homefeed trims results to specified limit."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/homefeed"),
        json=_HOMEFEED_RESPONSE,
        status=200,
    )

    client = _make_client()
    result = mod.get_homefeed(client, limit=1)

    assert len(result["notes"]) == 1
    assert result["notes"][0]["note_id"] == "feed_note_001"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_homefeed_custom_category(mock_jitter):
    """get_homefeed passes custom category to API."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/homefeed"),
        json=_HOMEFEED_EMPTY,
        status=200,
    )

    client = _make_client()
    result = mod.get_homefeed(client, category="homefeed.fashion_v3")

    assert result["category"] == "homefeed.fashion_v3"
