"""Tests for hackernews/scripts/hn_best.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_best")

SAMPLE_ITEM = {
    "id": 40000020,
    "type": "story",
    "by": "dang",
    "time": 1714002000,
    "title": "The Best of Hacker News 2026",
    "url": "https://example.com/best",
    "text": "",
    "score": 500,
    "descendants": 200,
    "kids": [300, 301],
}


class TestGetBest:
    @responses.activate
    def test_best_stories(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/beststories\.json"),
            json=[40000020],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000020\.json"),
            json=SAMPLE_ITEM,
            status=200,
        )
        result = mod.get_best(limit=1, story_type="best")
        assert result["type"] == "best"
        assert result["count"] == 1
        s = result["stories"][0]
        assert s["id"] == 40000020
        assert s["score"] == 500

    @responses.activate
    def test_ask_stories(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/askstories\.json"),
            json=[40000020],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000020\.json"),
            json=SAMPLE_ITEM,
            status=200,
        )
        result = mod.get_best(limit=1, story_type="ask")
        assert result["type"] == "ask"
        assert result["count"] == 1

    @responses.activate
    def test_show_stories(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/showstories\.json"),
            json=[40000020],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000020\.json"),
            json=SAMPLE_ITEM,
            status=200,
        )
        result = mod.get_best(limit=1, story_type="show")
        assert result["type"] == "show"

    @responses.activate
    def test_job_stories(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/jobstories\.json"),
            json=[40000020],
            status=200,
        )
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/40000020\.json"),
            json=SAMPLE_ITEM,
            status=200,
        )
        result = mod.get_best(limit=1, story_type="job")
        assert result["type"] == "job"

    @responses.activate
    def test_best_empty(self):
        responses.get(
            url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/beststories\.json"),
            json=[],
            status=200,
        )
        result = mod.get_best(limit=10)
        assert result["count"] == 0
        assert result["stories"] == []
