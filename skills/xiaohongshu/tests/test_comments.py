"""Tests for xiaohongshu/scripts/xhs_comments.py"""

import re
from unittest.mock import patch

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_comments")
client_mod = load_script("xiaohongshu", "xhs_client")

_COMMENTS_RESPONSE = {
    "code": 0,
    "success": True,
    "data": {
        "comments": [
            {
                "id": "comment001",
                "user_info": {"nickname": "Alice", "user_id": "u1"},
                "content": "Great post!",
                "like_count": "50",
                "sub_comment_count": "3",
                "create_time": 1715300000,
                "ip_location": "Beijing",
            },
            {
                "id": "comment002",
                "user_info": {"nickname": "Bob", "user_id": "u2"},
                "content": "Thanks for sharing",
                "like_count": "10",
                "sub_comment_count": "0",
                "create_time": 1715301000,
                "ip_location": "Shanghai",
            },
        ],
        "cursor": "next_cursor_abc",
        "has_more": True,
    },
}

_COMMENTS_EMPTY = {
    "code": 0,
    "success": True,
    "data": {
        "comments": [],
        "cursor": "",
        "has_more": False,
    },
}

_COMMENTS_PAGE2 = {
    "code": 0,
    "success": True,
    "data": {
        "comments": [
            {
                "id": "comment003",
                "user_info": {"nickname": "Charlie", "user_id": "u3"},
                "content": "Nice!",
                "like_count": "5",
                "sub_comment_count": "0",
                "create_time": 1715302000,
                "ip_location": "Guangzhou",
            },
        ],
        "cursor": "",
        "has_more": False,
    },
}


def _make_client():
    """Create a client without env vars using constructor directly."""
    return client_mod.XhsClient("a1=test; web_session=sess; webId=wid", "test", "sess", "wid")


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_comments_normal(mock_jitter):
    """get_comments returns parsed comment list."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v2/comment/page"),
        json=_COMMENTS_RESPONSE,
        status=200,
    )

    client = _make_client()
    result = mod.get_comments(client, "note001", "xsec_tok_123")

    assert len(result["comments"]) == 2
    assert result["comments"][0]["comment_id"] == "comment001"
    assert result["comments"][0]["author"] == "Alice"
    assert result["comments"][0]["content"] == "Great post!"
    assert result["comments"][0]["like_count"] == "50"
    assert result["comments"][0]["sub_comment_count"] == "3"
    assert result["comments"][0]["create_time"] == 1715300000
    assert result["comments"][1]["comment_id"] == "comment002"
    assert result["comments"][1]["author"] == "Bob"
    assert result["cursor"] == "next_cursor_abc"
    assert result["has_more"] is True


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_comments_empty(mock_jitter):
    """get_comments returns empty list when no comments."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v2/comment/page"),
        json=_COMMENTS_EMPTY,
        status=200,
    )

    client = _make_client()
    result = mod.get_comments(client, "note001", "xsec_tok_123")

    assert result["comments"] == []
    assert result["cursor"] == ""
    assert result["has_more"] is False


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_comments_pagination(mock_jitter):
    """get_comments supports cursor-based pagination."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v2/comment/page"),
        json=_COMMENTS_PAGE2,
        status=200,
    )

    client = _make_client()
    result = mod.get_comments(client, "note001", "xsec_tok_123", cursor="next_cursor_abc")

    assert len(result["comments"]) == 1
    assert result["comments"][0]["comment_id"] == "comment003"
    assert result["comments"][0]["author"] == "Charlie"
    assert result["cursor"] == ""
    assert result["has_more"] is False


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_comments_session_expired(mock_jitter):
    """get_comments raises SESSION_EXPIRED on 401."""
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v2/comment/page"),
        json={},
        status=401,
    )

    client = _make_client()
    try:
        mod.get_comments(client, "note001", "xsec_tok_123")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "SESSION_EXPIRED"
