"""Tests for hackernews/scripts/hn_search.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_search")


class TestSearch:
    @responses.activate
    def test_basic_search(self):
        responses.get(
            url=re.compile(r"https://hn\.algolia\.com/api/v1/search"),
            json={
                "nbHits": 1,
                "hits": [
                    {
                        "objectID": "40000001",
                        "title": "Rust Is the Future",
                        "url": "https://example.com/rust",
                        "author": "rustfan",
                        "points": 200,
                        "num_comments": 85,
                        "created_at": "2026-04-01T10:00:00.000Z",
                        "story_text": None,
                    }
                ],
            },
            status=200,
        )
        result = mod.search("Rust programming")
        assert result["total"] == 1
        assert result["count"] == 1
        h = result["hits"][0]
        assert h["id"] == "40000001"
        assert h["title"] == "Rust Is the Future"
        assert h["author"] == "rustfan"
        assert h["points"] == 200

    @responses.activate
    def test_empty_search(self):
        responses.get(
            url=re.compile(r"https://hn\.algolia\.com/api/v1/search"),
            json={"nbHits": 0, "hits": []},
            status=200,
        )
        result = mod.search("nonexistent_query_xyz_12345")
        assert result["total"] == 0
        assert result["count"] == 0
        assert result["hits"] == []

    @responses.activate
    def test_search_with_type_filter(self):
        responses.get(
            url=re.compile(r"https://hn\.algolia\.com/api/v1/search"),
            json={
                "nbHits": 1,
                "hits": [
                    {
                        "objectID": "40000002",
                        "title": "Ask HN: Best Rust resources?",
                        "url": "",
                        "author": "learner",
                        "points": 50,
                        "num_comments": 30,
                        "created_at": "2026-04-02T12:00:00.000Z",
                        "story_text": "Looking for good Rust learning resources.",
                    }
                ],
            },
            status=200,
        )
        result = mod.search("Rust", search_type="ask_hn")
        assert result["count"] == 1
        assert result["hits"][0]["title"] == "Ask HN: Best Rust resources?"

    @responses.activate
    def test_search_by_date(self):
        responses.get(
            url=re.compile(r"https://hn\.algolia\.com/api/v1/search_by_date"),
            json={
                "nbHits": 1,
                "hits": [
                    {
                        "objectID": "40000003",
                        "title": "Latest Rust Release",
                        "url": "https://example.com/rust-latest",
                        "author": "rustdev",
                        "points": 100,
                        "num_comments": 40,
                        "created_at": "2026-04-20T08:00:00.000Z",
                        "story_text": None,
                    }
                ],
            },
            status=200,
        )
        result = mod.search("Rust", sort="date")
        assert result["count"] == 1

    @responses.activate
    def test_story_text_truncation(self):
        long_text = "x" * 300
        responses.get(
            url=re.compile(r"https://hn\.algolia\.com/api/v1/search"),
            json={
                "nbHits": 1,
                "hits": [
                    {
                        "objectID": "1",
                        "title": "Test",
                        "url": "",
                        "author": "a",
                        "points": 1,
                        "num_comments": 0,
                        "created_at": "",
                        "story_text": long_text,
                    }
                ],
            },
            status=200,
        )
        result = mod.search("test")
        assert len(result["hits"][0]["story_text"]) <= 200
