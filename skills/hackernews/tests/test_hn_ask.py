"""Tests for hackernews/scripts/hn_ask.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("hackernews", "hn_ask")

_ITEM1 = {"id": 1, "type": "story", "title": "Ask HN: Test?", "by": "user1", "score": 10, "descendants": 5}
_ITEM2 = {"id": 2, "type": "story", "title": "Ask HN: Another?", "by": "user2", "score": 20, "descendants": 3}


@responses.activate
def test_get_ask_stories():
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/askstories\.json"), json=[1, 2], status=200)
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/1\.json"), json=_ITEM1, status=200)
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/item/2\.json"), json=_ITEM2, status=200)
    result = mod.get_ask(limit=5)
    assert result["count"] == 2
    assert result["stories"][0]["title"] == "Ask HN: Test?"


@responses.activate
def test_get_ask_empty():
    responses.get(url=re.compile(r"https://hacker-news\.firebaseio\.com/v0/askstories\.json"), json=[], status=200)
    result = mod.get_ask(limit=5)
    assert result["count"] == 0
