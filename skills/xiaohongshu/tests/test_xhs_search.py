"""Tests for xiaohongshu/scripts/xhs_search.py"""

import re
from unittest.mock import patch

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_search")
client_mod = load_script("xiaohongshu", "xhs_client")

_SEARCH_RESPONSE = {
    "code": 0,
    "success": True,
    "data": {
        "items": [
            {
                "id": "note123",
                "model_type": "note",
                "xsec_token": "token_abc",
                "note_card": {
                    "display_title": "Paris Travel Guide",
                    "type": "normal",
                    "user": {"nickname": "Traveler", "user_id": "user1"},
                    "interact_info": {"liked_count": "1200"},
                    "cover": {"url_default": "https://img.xhs.com/cover.jpg"},
                },
            },
            {
                "id": "note456",
                "model_type": "note",
                "xsec_token": "token_def",
                "note_card": {
                    "display_title": "Tokyo Food",
                    "type": "video",
                    "user": {"nickname": "Foodie", "user_id": "user2"},
                    "interact_info": {"liked_count": "800"},
                    "cover": {"url_default": "https://img.xhs.com/cover2.jpg"},
                },
            },
        ],
        "has_more": True,
        "search_id": "search_001",
    },
}

_SEARCH_EMPTY = {
    "code": 0,
    "success": True,
    "data": {
        "items": [],
        "has_more": False,
        "search_id": "",
    },
}

_PREWARM_OK = {"code": 0, "success": True, "data": {}}


def _make_client():
    """Create a client without env vars using constructor directly."""
    return client_mod.XhsClient("a1=test; web_session=sess; webId=wid", "test", "sess", "wid")


def _mock_prewarm():
    """Register mocks for onebox and filter prewarm endpoints."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/onebox"),
        json=_PREWARM_OK,
        status=200,
    )
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/filter"),
        json=_PREWARM_OK,
        status=200,
    )


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_search_returns_notes(mock_jitter):
    """search_notes returns parsed note list with xsec_token."""
    _mock_prewarm()
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        json=_SEARCH_RESPONSE,
        status=200,
    )

    client = _make_client()
    result = mod.search_notes(client, keyword="travel", page=1, page_size=20)

    assert result["keyword"] == "travel"
    assert len(result["notes"]) == 2
    assert result["notes"][0]["note_id"] == "note123"
    assert result["notes"][0]["xsec_token"] == "token_abc"
    assert result["notes"][0]["title"] == "Paris Travel Guide"
    assert result["notes"][0]["author"] == "Traveler"
    assert result["notes"][1]["note_id"] == "note456"
    assert result["notes"][1]["type"] == "video"
    assert result["has_more"] is True
    assert result["search_id"] != ""


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_search_empty_results(mock_jitter):
    """search_notes returns empty list when no results."""
    _mock_prewarm()
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        json=_SEARCH_EMPTY,
        status=200,
    )

    client = _make_client()
    result = mod.search_notes(client, keyword="nonexistent")

    assert result["notes"] == []
    assert result["has_more"] is False


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_search_session_expired(mock_jitter):
    """search_notes raises SESSION_EXPIRED on 401."""
    _mock_prewarm()
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        json={},
        status=401,
    )

    client = _make_client()
    try:
        mod.search_notes(client, keyword="test")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "SESSION_EXPIRED"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_search_captcha(mock_jitter):
    """search_notes raises CAPTCHA_REQUIRED on 461."""
    _mock_prewarm()
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        json={},
        status=461,
    )

    client = _make_client()
    try:
        mod.search_notes(client, keyword="test")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "CAPTCHA_REQUIRED"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_search_api_error_code(mock_jitter):
    """search_notes raises API_ERROR on non-zero code."""
    _mock_prewarm()
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        json={"code": -1, "msg": "System busy"},
        status=200,
    )

    client = _make_client()
    try:
        mod.search_notes(client, keyword="test")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "API_ERROR"
        assert "System busy" in e.message


def test_create_without_env_raises():
    """XhsClient.create raises AUTH_REQUIRED without env vars."""
    try:
        client_mod.XhsClient.create()
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "AUTH_REQUIRED"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_search_filters_non_note_items(mock_jitter):
    """search_notes only includes items with model_type=note."""
    _mock_prewarm()
    response_with_ads = {
        "code": 0,
        "success": True,
        "data": {
            "items": [
                {
                    "id": "note789",
                    "model_type": "note",
                    "xsec_token": "tok",
                    "note_card": {
                        "display_title": "Real Note",
                        "type": "normal",
                        "user": {"nickname": "User", "user_id": "u1"},
                        "interact_info": {"liked_count": "10"},
                        "cover": {},
                    },
                },
                {
                    "id": "ad001",
                    "model_type": "ad",
                    "note_card": {"display_title": "Ad"},
                },
            ],
            "has_more": False,
            "search_id": "",
        },
    }
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        json=response_with_ads,
        status=200,
    )

    client = _make_client()
    result = mod.search_notes(client, keyword="test")

    assert len(result["notes"]) == 1
    assert result["notes"][0]["note_id"] == "note789"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_search_skips_prewarm_with_existing_search_id(mock_jitter):
    """When search_id is provided, prewarm is skipped."""
    # Only mock the search endpoint - no prewarm mocks
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/search/notes"),
        json=_SEARCH_EMPTY,
        status=200,
    )

    client = _make_client()
    result = mod.search_notes(client, keyword="test", search_id="existing_id")

    assert result["search_id"] == "existing_id"
