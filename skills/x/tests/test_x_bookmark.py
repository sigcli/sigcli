"""Tests for x/scripts/x_bookmark.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_bookmark")
client_mod = load_script("x", "x_client")

COOKIE = "ct0=testcsrf123; auth_token=testabc"


@responses.activate
def test_bookmark_tweet_success():
    """bookmark_tweet returns success for bookmark action."""
    responses.post(
        url=re.compile(r".+/CreateBookmark"),
        json={"data": {"tweet_bookmark_put": "Done"}},
        status=200,
    )
    result = mod.bookmark_tweet(COOKIE, "12345")
    assert result["success"] is True
    assert result["action"] == "bookmarked"
    assert result["tweet_id"] == "12345"


@responses.activate
def test_unbookmark_tweet_success():
    """bookmark_tweet with undo returns success for unbookmark action."""
    responses.post(
        url=re.compile(r".+/DeleteBookmark"),
        json={"data": {"tweet_bookmark_delete": "Done"}},
        status=200,
    )
    result = mod.bookmark_tweet(COOKIE, "12345", undo=True)
    assert result["success"] is True
    assert result["action"] == "unbookmarked"


def test_bookmark_requires_auth():
    """bookmark_tweet raises XApiError without cookie."""
    try:
        mod.bookmark_tweet("", "12345")
        assert False, "Expected XApiError"
    except client_mod.XApiError as e:
        assert e.code == "AUTH_REQUIRED"
