"""Tests for reddit/scripts/reddit_submit.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_submit")
client_mod = load_script("reddit", "reddit_client")

FAKE_COOKIE = "token_v2=faketoken123; reddit_session=fakesession"


@responses.activate
def test_submit_self_post():
    responses.post(
        url=re.compile(r"https://oauth\.reddit\.com/api/submit"),
        json={"json": {"errors": [], "data": {"id": "abc123", "name": "t3_abc123", "url": "https://reddit.com/r/test/comments/abc123/test/"}}},
        status=200,
    )
    result = mod.submit_post(FAKE_COOKIE, "test", "Test Title", kind="self", text="Body text")
    assert result["success"] is True
    assert result["id"] == "abc123"
    assert result["name"] == "t3_abc123"


@responses.activate
def test_submit_link_post():
    responses.post(
        url=re.compile(r"https://oauth\.reddit\.com/api/submit"),
        json={"json": {"errors": [], "data": {"id": "def456", "name": "t3_def456", "url": "https://reddit.com/r/test/comments/def456/"}}},
        status=200,
    )
    result = mod.submit_post(FAKE_COOKIE, "test", "Link Title", kind="link", url="https://example.com")
    assert result["success"] is True
    assert result["id"] == "def456"


@responses.activate
def test_submit_errors_raised():
    responses.post(
        url=re.compile(r"https://oauth\.reddit\.com/api/submit"),
        json={"json": {"errors": [["SUBREDDIT_NOEXIST", "not found"]], "data": {}}},
        status=200,
    )
    try:
        mod.submit_post(FAKE_COOKIE, "nonexistent_sub_xyz", "Title")
        assert False, "Should have raised"
    except client_mod.RedditApiError as e:
        assert e.code == "SUBMIT_FAILED"


def test_requires_cookie():
    try:
        mod.submit_post("", "test", "Title")
        assert False
    except client_mod.RedditApiError as e:
        assert e.code == "AUTH_REQUIRED"
