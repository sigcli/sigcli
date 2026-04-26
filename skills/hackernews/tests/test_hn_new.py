"""Tests for hackernews/scripts/hn_new.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_new")

SAMPLE_ITEM = {
    "id": 40000010,
    "type": "story",
    "by": "newuser",
    "time": 1714001000,
    "title": "Just launched my side project",
    "url": "https://example.com/launch",
    "text": "",
    "score": 5,
    "descendants": 2,
    "kids": [200],
}


class TestGetNew:
    @responses.activate
    def test_new_stories(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/newstories\.json"),
            json=[40000010],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000010\.json"),
            json=SAMPLE_ITEM,
            status=200,
        )
        result = mod.get_new(limit=1)
        assert result["count"] == 1
        s = result["stories"][0]
        assert s["id"] == 40000010
        assert s["title"] == "Just launched my side project"
        assert s["by"] == "newuser"

    @responses.activate
    def test_new_empty(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/newstories\.json"),
            json=[],
            status=200,
        )
        result = mod.get_new(limit=10)
        assert result["count"] == 0
        assert result["stories"] == []

    @responses.activate
    def test_new_respects_limit(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/newstories\.json"),
            json=[40000010, 40000011, 40000012],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/\d+\.json"),
            json=SAMPLE_ITEM,
            status=200,
        )
        result = mod.get_new(limit=2)
        assert result["count"] == 2
