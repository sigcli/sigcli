"""Tests for hackernews/scripts/hn_top.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_top")

SAMPLE_ITEM = {
    "id": 40000001,
    "type": "story",
    "by": "pg",
    "time": 1714000000,
    "title": "Show HN: A New Way to Build CLIs",
    "url": "https://example.com/cli",
    "text": "",
    "score": 150,
    "descendants": 42,
    "kids": [100, 101],
}


class TestGetTop:
    @responses.activate
    def test_top_stories(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/topstories\.json"),
            json=[40000001],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000001\.json"),
            json=SAMPLE_ITEM,
            status=200,
        )
        result = mod.get_top(limit=1)
        assert result["count"] == 1
        s = result["stories"][0]
        assert s["id"] == 40000001
        assert s["title"] == "Show HN: A New Way to Build CLIs"
        assert s["by"] == "pg"
        assert s["score"] == 150

    @responses.activate
    def test_top_empty(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/topstories\.json"),
            json=[],
            status=200,
        )
        result = mod.get_top(limit=10)
        assert result["count"] == 0
        assert result["stories"] == []

    @responses.activate
    def test_top_respects_limit(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/topstories\.json"),
            json=[40000001, 40000002, 40000003],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/\d+\.json"),
            json=SAMPLE_ITEM,
            status=200,
        )
        result = mod.get_top(limit=2)
        assert result["count"] == 2
