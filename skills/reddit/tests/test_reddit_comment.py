"""Tests for reddit/scripts/reddit_comment.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_comment")
client_mod = load_script("reddit", "reddit_client")


@responses.activate
def test_post_comment_success():
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/api/me\.json"),
        json={"data": {"modhash": "abc123"}},
        status=200,
    )
    responses.post(
        url=re.compile(r"https://www\.reddit\.com/api/comment"),
        json={"json": {"errors": [], "data": {"things": [{"data": {"id": "comment1"}}]}}},
        status=200,
    )
    result = mod.post_comment("fakecookie", "t3_post1", "Great post!")
    assert result["success"] is True
    assert result["comment_id"] == "comment1"
    assert result["parent"] == "t3_post1"


@responses.activate
def test_post_comment_adds_prefix():
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/api/me\.json"),
        json={"data": {"modhash": "abc"}},
        status=200,
    )
    responses.post(
        url=re.compile(r"https://www\.reddit\.com/api/comment"),
        json={"json": {"errors": [], "data": {"things": []}}},
        status=200,
    )
    result = mod.post_comment("fakecookie", "barepost", "Hello")
    assert result["parent"] == "t3_barepost"


def test_requires_cookie():
    try:
        mod.post_comment("", "t3_xxx", "text")
        assert False, "Should have raised"
    except client_mod.RedditApiError as e:
        assert e.code == "AUTH_REQUIRED"


@responses.activate
def test_comment_errors_raised():
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/api/me\.json"),
        json={"data": {"modhash": "abc"}},
        status=200,
    )
    responses.post(
        url=re.compile(r"https://www\.reddit\.com/api/comment"),
        json={"json": {"errors": [["RATELIMIT", "too much"]], "data": {}}},
        status=200,
    )
    try:
        mod.post_comment("fakecookie", "t3_xxx", "spam")
        assert False, "Should have raised"
    except client_mod.RedditApiError as e:
        assert e.code == "COMMENT_FAILED"
