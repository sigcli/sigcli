"""Tests for hackernews/scripts/hn_show.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_show")

_ITEM = {"id": 10, "type": "story", "title": "Show HN: My Project", "by": "maker", "score": 50, "url": "https://example.com"}


@responses.activate
def test_get_show_stories():
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/showstories\.json"), json=[10], status=200)
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/10\.json"), json=_ITEM, status=200)
    result = mod.get_show(limit=5)
    assert result["count"] == 1
    assert result["stories"][0]["title"] == "Show HN: My Project"


@responses.activate
def test_get_show_empty():
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/showstories\.json"), json=[], status=200)
    result = mod.get_show(limit=5)
    assert result["count"] == 0
