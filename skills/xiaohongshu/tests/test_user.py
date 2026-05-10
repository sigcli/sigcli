"""Tests for xiaohongshu/scripts/xhs_user.py and xhs_user_notes.py"""

import re
from unittest.mock import patch

import responses

from test_helpers import load_script

user_mod = load_script("xiaohongshu", "xhs_user")
notes_mod = load_script("xiaohongshu", "xhs_user_notes")
client_mod = load_script("xiaohongshu", "xhs_client")

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_SELF_INFO_RESPONSE = {
    "code": 0,
    "success": True,
    "data": {
        "user_id": "self_001",
        "nickname": "MyProfile",
        "desc": "Hello world",
        "gender": 1,
        "imageb": "https://img.xhs.com/avatar_big.jpg",
        "image": "https://img.xhs.com/avatar.jpg",
        "ip_location": "Shanghai",
        "fans": "1000",
        "follows": "200",
        "interaction": "5000",
        "level": {"name": "Lv5"},
    },
}

_OTHER_USER_RESPONSE = {
    "code": 0,
    "success": True,
    "data": {
        "user_id": "other_002",
        "nickname": "OtherUser",
        "desc": "Travel blogger",
        "gender": 0,
        "imageb": "",
        "image": "https://img.xhs.com/other_avatar.jpg",
        "ip_location": "Beijing",
        "fans": "50000",
        "follows": "300",
        "interaction": "120000",
        "level": {"name": "Lv7"},
    },
}

_USER_NOT_FOUND_RESPONSE = {
    "code": -1,
    "success": False,
    "msg": "User not found",
}

_USER_NOTES_RESPONSE = {
    "code": 0,
    "success": True,
    "data": {
        "notes": [
            {
                "id": "note_a",
                "xsec_token": "tok_a",
                "note_card": {
                    "display_title": "My First Post",
                    "type": "normal",
                    "user": {"nickname": "OtherUser", "user_id": "other_002"},
                    "interact_info": {"liked_count": "500"},
                    "cover": {"url_default": "https://img.xhs.com/cover_a.jpg"},
                },
            },
            {
                "id": "note_b",
                "xsec_token": "tok_b",
                "note_card": {
                    "display_title": "My Video",
                    "type": "video",
                    "user": {"nickname": "OtherUser", "user_id": "other_002"},
                    "interact_info": {"liked_count": "1200"},
                    "cover": {"url_default": "https://img.xhs.com/cover_b.jpg"},
                },
            },
        ],
        "cursor": "cursor_page2",
        "has_more": True,
    },
}

_USER_NOTES_EMPTY = {
    "code": 0,
    "success": True,
    "data": {
        "notes": [],
        "cursor": "",
        "has_more": False,
    },
}

_USER_NOTES_PAGE2 = {
    "code": 0,
    "success": True,
    "data": {
        "notes": [
            {
                "id": "note_c",
                "xsec_token": "tok_c",
                "note_card": {
                    "display_title": "Third Post",
                    "type": "normal",
                    "user": {"nickname": "OtherUser", "user_id": "other_002"},
                    "interact_info": {"liked_count": "300"},
                    "cover": {"url_default": "https://img.xhs.com/cover_c.jpg"},
                },
            },
        ],
        "cursor": "",
        "has_more": False,
    },
}


def _make_client():
    """Create a client without env vars using constructor directly."""
    return client_mod.XhsClient("a1=test; web_session=sess; webId=wid", "test", "sess", "wid")


# ---------------------------------------------------------------------------
# User info tests
# ---------------------------------------------------------------------------


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_self_info(mock_jitter):
    """get_user_info without user_id returns current user profile."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v2/user/me"),
        json=_SELF_INFO_RESPONSE,
        status=200,
    )

    client = _make_client()
    result = user_mod.get_user_info(client)

    assert result["user_id"] == "self_001"
    assert result["nickname"] == "MyProfile"
    assert result["desc"] == "Hello world"
    assert result["gender"] == 1
    assert result["avatar"] == "https://img.xhs.com/avatar_big.jpg"
    assert result["ip_location"] == "Shanghai"
    assert result["fans"] == "1000"
    assert result["follows"] == "200"
    assert result["interaction"] == "5000"
    assert result["level"] == "Lv5"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_other_user_info(mock_jitter):
    """get_user_info with user_id returns that user's profile."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/user/otherinfo"),
        json=_OTHER_USER_RESPONSE,
        status=200,
    )

    client = _make_client()
    result = user_mod.get_user_info(client, user_id="other_002")

    assert result["user_id"] == "other_002"
    assert result["nickname"] == "OtherUser"
    assert result["desc"] == "Travel blogger"
    assert result["avatar"] == "https://img.xhs.com/other_avatar.jpg"
    assert result["fans"] == "50000"
    assert result["level"] == "Lv7"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_user_not_found(mock_jitter):
    """get_user_info raises API_ERROR when user not found."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/user/otherinfo"),
        json=_USER_NOT_FOUND_RESPONSE,
        status=200,
    )

    client = _make_client()
    try:
        user_mod.get_user_info(client, user_id="nonexistent")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "API_ERROR"
        assert "User not found" in e.message


# ---------------------------------------------------------------------------
# User notes tests
# ---------------------------------------------------------------------------


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_user_notes_with_data(mock_jitter):
    """get_user_notes returns parsed notes list."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/user_posted"),
        json=_USER_NOTES_RESPONSE,
        status=200,
    )

    client = _make_client()
    result = notes_mod.get_user_notes(client, user_id="other_002")

    assert result["user_id"] == "other_002"
    assert len(result["notes"]) == 2
    assert result["notes"][0]["note_id"] == "note_a"
    assert result["notes"][0]["title"] == "My First Post"
    assert result["notes"][0]["author"] == "OtherUser"
    assert result["notes"][1]["note_id"] == "note_b"
    assert result["notes"][1]["type"] == "video"
    assert result["cursor"] == "cursor_page2"
    assert result["has_more"] is True


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_user_notes_empty(mock_jitter):
    """get_user_notes returns empty list when user has no notes."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/user_posted"),
        json=_USER_NOTES_EMPTY,
        status=200,
    )

    client = _make_client()
    result = notes_mod.get_user_notes(client, user_id="other_002")

    assert result["user_id"] == "other_002"
    assert result["notes"] == []
    assert result["cursor"] == ""
    assert result["has_more"] is False


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_user_notes_pagination(mock_jitter):
    """get_user_notes with cursor returns next page of notes."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/user_posted"),
        json=_USER_NOTES_PAGE2,
        status=200,
    )

    client = _make_client()
    result = notes_mod.get_user_notes(client, user_id="other_002", cursor="cursor_page2")

    assert len(result["notes"]) == 1
    assert result["notes"][0]["note_id"] == "note_c"
    assert result["notes"][0]["title"] == "Third Post"
    assert result["cursor"] == ""
    assert result["has_more"] is False
