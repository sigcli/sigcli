"""Tests for reddit/scripts/reddit_vote.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_vote")
client_mod = load_script("reddit", "reddit_client")


@responses.activate
def test_upvote():
    responses.get(url=re.compile(r"https://www\.reddit\.com/api/me\.json"), json={"data": {"modhash": "mh1"}}, status=200)
    responses.post(url=re.compile(r"https://www\.reddit\.com/api/vote"), json={}, status=200)
    result = mod.vote("fakecookie", "t3_abc", "up")
    assert result["success"] is True
    assert result["direction"] == "up"


@responses.activate
def test_downvote():
    responses.get(url=re.compile(r"https://www\.reddit\.com/api/me\.json"), json={"data": {"modhash": "mh1"}}, status=200)
    responses.post(url=re.compile(r"https://www\.reddit\.com/api/vote"), json={}, status=200)
    result = mod.vote("fakecookie", "t3_abc", "down")
    assert result["direction"] == "down"


@responses.activate
def test_unvote():
    responses.get(url=re.compile(r"https://www\.reddit\.com/api/me\.json"), json={"data": {"modhash": "mh1"}}, status=200)
    responses.post(url=re.compile(r"https://www\.reddit\.com/api/vote"), json={}, status=200)
    result = mod.vote("fakecookie", "abc", "none")
    assert result["id"] == "t3_abc"
    assert result["direction"] == "none"


def test_requires_cookie():
    try:
        mod.vote("", "t3_abc", "up")
        assert False
    except client_mod.RedditApiError as e:
        assert e.code == "AUTH_REQUIRED"
