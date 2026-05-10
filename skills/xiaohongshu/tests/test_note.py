"""Tests for xiaohongshu/scripts/xhs_note.py"""

import re
from unittest.mock import patch

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_note")
client_mod = load_script("xiaohongshu", "xhs_client")

_NOTE_IMAGE_RESPONSE = {
    "code": 0,
    "success": True,
    "data": {
        "items": [
            {
                "id": "note001",
                "note_card": {
                    "note_id": "note001",
                    "title": "Weekend Trip to Kyoto",
                    "desc": "Beautiful temples and cherry blossoms",
                    "type": "normal",
                    "user": {"nickname": "Traveler", "user_id": "user1"},
                    "interact_info": {
                        "liked_count": "3200",
                        "collected_count": "1500",
                        "comment_count": "200",
                        "share_count": "80",
                    },
                    "image_list": [
                        {"url_default": "https://img.xhs.com/1.jpg"},
                        {"url_default": "https://img.xhs.com/2.jpg"},
                    ],
                    "tag_list": [
                        {"name": "travel"},
                        {"name": "kyoto"},
                    ],
                    "time": 1715300000,
                    "ip_location": "Japan",
                },
            }
        ]
    },
}

_NOTE_VIDEO_RESPONSE = {
    "code": 0,
    "success": True,
    "data": {
        "items": [
            {
                "id": "note002",
                "note_card": {
                    "note_id": "note002",
                    "title": "Cooking Tutorial",
                    "desc": "How to make ramen from scratch",
                    "type": "video",
                    "user": {"nickname": "Chef", "user_id": "user2"},
                    "interact_info": {
                        "liked_count": "5000",
                        "collected_count": "2000",
                        "comment_count": "400",
                        "share_count": "150",
                    },
                    "image_list": [],
                    "video": {
                        "consumer": {"origin_video_key": "video_key_abc"},
                    },
                    "tag_list": [{"name": "cooking"}],
                    "time": 1715400000,
                    "ip_location": "Shanghai",
                },
            }
        ]
    },
}

_NOTE_NOT_FOUND = {
    "code": 0,
    "success": True,
    "data": {
        "items": [],
    },
}


def _make_client():
    """Create a client without env vars using constructor directly."""
    return client_mod.XhsClient("a1=test; web_session=sess; webId=wid", "test", "sess", "wid")


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_note_image_type(mock_jitter):
    """get_note returns parsed note detail for image note."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/feed"),
        json=_NOTE_IMAGE_RESPONSE,
        status=200,
    )

    client = _make_client()
    result = mod.get_note(client, "note001", "xsec_tok_123")

    assert result["note_id"] == "note001"
    assert result["title"] == "Weekend Trip to Kyoto"
    assert result["desc"] == "Beautiful temples and cherry blossoms"
    assert result["type"] == "normal"
    assert result["author"] == "Traveler"
    assert result["author_id"] == "user1"
    assert result["liked_count"] == "3200"
    assert result["collected_count"] == "1500"
    assert result["comment_count"] == "200"
    assert result["share_count"] == "80"
    assert len(result["images"]) == 2
    assert result["images"][0] == "https://img.xhs.com/1.jpg"
    assert result["video_url"] == ""
    assert result["tags"] == ["travel", "kyoto"]
    assert result["time"] == 1715300000
    assert result["ip_location"] == "Japan"


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_note_video_type(mock_jitter):
    """get_note returns video_url for video notes."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/feed"),
        json=_NOTE_VIDEO_RESPONSE,
        status=200,
    )

    client = _make_client()
    result = mod.get_note(client, "note002", "xsec_tok_456")

    assert result["note_id"] == "note002"
    assert result["type"] == "video"
    assert result["video_url"] == "video_key_abc"
    assert result["images"] == []
    assert result["tags"] == ["cooking"]


@responses.activate
@patch("xhs_client.XhsClient._jitter")
def test_get_note_not_found(mock_jitter):
    """get_note raises NOT_FOUND when items list is empty."""
    responses.post(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v1/feed"),
        json=_NOTE_NOT_FOUND,
        status=200,
    )

    client = _make_client()
    try:
        mod.get_note(client, "nonexistent", "xsec_tok")
        assert False, "Should have raised"
    except client_mod.XhsApiError as e:
        assert e.code == "NOT_FOUND"


def test_xsec_token_required():
    """xhs_note.py requires --xsec-token argument (enforced by argparse)."""
    import inspect
    source = inspect.getsource(mod.main)
    assert 'required=True' in source
    assert '--xsec-token' in source
