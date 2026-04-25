"""Tests for xiaohongshu/scripts/xhs_comments.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("xiaohongshu", "xhs_comments")
client_mod = load_script("xiaohongshu", "xhs_client")

_COMMENTS_RESPONSE = {
    "data": {
        "comments": [
            {
                "id": "comment001",
                "user_info": {"nickname": "评论者1", "user_id": "uid001"},
                "content": "写得真好！",
                "like_count": 15,
                "create_time": 1700000000,
                "sub_comment_count": 1,
                "sub_comments": [
                    {
                        "id": "sub001",
                        "user_info": {"nickname": "回复者1", "user_id": "uid002"},
                        "content": "同意",
                        "like_count": 3,
                        "create_time": 1700001000,
                        "target_comment": {"user_info": {"nickname": "评论者1"}},
                    }
                ],
            },
            {
                "id": "comment002",
                "user_info": {"nickname": "评论者2", "user_id": "uid003"},
                "content": "收藏了",
                "like_count": 5,
                "create_time": 1700002000,
                "sub_comment_count": 0,
                "sub_comments": [],
            },
        ],
        "has_more": True,
        "cursor": "next_cursor_token",
    }
}


@responses.activate
def test_get_comments_returns_list():
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v2/comment/page"),
        json=_COMMENTS_RESPONSE,
        status=200,
    )

    client = client_mod.XhsClient()
    result = mod.get_comments(client, "69aa7160000000001b01634d")

    assert result["note_id"] == "69aa7160000000001b01634d"
    assert result["count"] == 3
    assert result["has_more"] is True
    assert result["cursor"] == "next_cursor_token"

    assert result["comments"][0]["author"] == "评论者1"
    assert result["comments"][0]["content"] == "写得真好！"
    assert result["comments"][0]["is_reply"] is False

    assert result["comments"][1]["author"] == "回复者1"
    assert result["comments"][1]["is_reply"] is True
    assert result["comments"][1]["reply_to"] == "评论者1"


@responses.activate
def test_get_comments_empty():
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v2/comment/page"),
        json={"data": {"comments": [], "has_more": False, "cursor": ""}},
        status=200,
    )

    client = client_mod.XhsClient()
    result = mod.get_comments(client, "69aa7160000000001b01634d")

    assert result["count"] == 0
    assert result["comments"] == []
    assert result["has_more"] is False


@responses.activate
def test_get_comments_from_url():
    responses.get(
        url=re.compile(r"https://edith\.xiaohongshu\.com/api/sns/web/v2/comment/page"),
        json=_COMMENTS_RESPONSE,
        status=200,
    )

    client = client_mod.XhsClient()
    result = mod.get_comments(client, "https://www.xiaohongshu.com/explore/69aa7160000000001b01634d")

    assert result["note_id"] == "69aa7160000000001b01634d"
    assert result["count"] == 3
