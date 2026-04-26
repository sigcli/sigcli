"""Tests for hackernews/scripts/hn_item.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_item")

SAMPLE_STORY = {
    "id": 40000001,
    "type": "story",
    "by": "pg",
    "time": 1714000000,
    "title": "A Great Article",
    "url": "https://example.com/article",
    "text": "",
    "score": 150,
    "descendants": 3,
    "kids": [50001, 50002],
}

SAMPLE_COMMENT_1 = {
    "id": 50001,
    "type": "comment",
    "by": "commenter1",
    "time": 1714001000,
    "text": "Great article!",
    "parent": 40000001,
    "kids": [50003],
}

SAMPLE_COMMENT_2 = {
    "id": 50002,
    "type": "comment",
    "by": "commenter2",
    "time": 1714001100,
    "text": "Interesting read.",
    "parent": 40000001,
    "kids": [],
}

SAMPLE_REPLY = {
    "id": 50003,
    "type": "comment",
    "by": "replier",
    "time": 1714001200,
    "text": "I agree!",
    "parent": 50001,
    "kids": [],
}


class TestGetItem:
    @responses.activate
    def test_item_with_comments(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000001\.json"),
            json=SAMPLE_STORY,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/50001\.json"),
            json=SAMPLE_COMMENT_1,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/50002\.json"),
            json=SAMPLE_COMMENT_2,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/50003\.json"),
            json=SAMPLE_REPLY,
            status=200,
        )
        result = mod.get_item("40000001", depth=2, comments_limit=20)
        assert result["item"]["id"] == 40000001
        assert result["item"]["title"] == "A Great Article"
        assert len(result["comments"]) == 2
        assert result["comments"][0]["by"] == "commenter1"
        assert result["comments"][0]["text"] == "Great article!"
        assert len(result["comments"][0]["replies"]) == 1
        assert result["comments"][0]["replies"][0]["by"] == "replier"

    @responses.activate
    def test_item_no_comments(self):
        story = {**SAMPLE_STORY, "kids": []}
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000001\.json"),
            json=story,
            status=200,
        )
        result = mod.get_item("40000001", depth=2, comments_limit=20)
        assert result["item"]["id"] == 40000001
        assert result["comments"] == []

    @responses.activate
    def test_item_depth_limit(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000001\.json"),
            json=SAMPLE_STORY,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/50001\.json"),
            json=SAMPLE_COMMENT_1,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/50002\.json"),
            json=SAMPLE_COMMENT_2,
            status=200,
        )
        # depth=1 means only top-level comments, no replies fetched
        result = mod.get_item("40000001", depth=1, comments_limit=20)
        assert len(result["comments"]) == 2
        assert result["comments"][0]["replies"] == []

    @responses.activate
    def test_item_comments_limit(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000001\.json"),
            json=SAMPLE_STORY,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/50001\.json"),
            json=SAMPLE_COMMENT_1,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/50003\.json"),
            json=SAMPLE_REPLY,
            status=200,
        )
        # comments_limit=2 allows only 2 comments total (comment1 + its reply)
        result = mod.get_item("40000001", depth=2, comments_limit=2)
        assert len(result["comments"]) == 1
        assert result["comments"][0]["by"] == "commenter1"

    @responses.activate
    def test_item_deleted_comment_skipped(self):
        deleted_comment = {"id": 50001, "deleted": True}
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000001\.json"),
            json=SAMPLE_STORY,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/50001\.json"),
            json=deleted_comment,
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/50002\.json"),
            json=SAMPLE_COMMENT_2,
            status=200,
        )
        result = mod.get_item("40000001", depth=2, comments_limit=20)
        assert len(result["comments"]) == 1
        assert result["comments"][0]["by"] == "commenter2"
