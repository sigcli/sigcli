"""Tests for x/scripts/x_like.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_like")
client_mod = load_script("x", "x_client")

COOKIE = "ct0=testcsrf123; auth_token=testabc"


@responses.activate
def test_like_tweet_success():
    """like_tweet returns success for like action."""
    responses.post(
        url=re.compile(r".+/FavoriteTweet"),
        json={"data": {"favorite_tweet": "Done"}},
        status=200,
    )
    result = mod.like_tweet(COOKIE, "12345")
    assert result["success"] is True
    assert result["action"] == "liked"
    assert result["tweet_id"] == "12345"


@responses.activate
def test_unlike_tweet_success():
    """like_tweet with undo returns success for unlike action."""
    responses.post(
        url=re.compile(r".+/UnfavoriteTweet"),
        json={"data": {"unfavorite_tweet": "Done"}},
        status=200,
    )
    result = mod.like_tweet(COOKIE, "12345", undo=True)
    assert result["success"] is True
    assert result["action"] == "unliked"


def test_like_requires_auth():
    """like_tweet raises XApiError without cookie."""
    try:
        mod.like_tweet("", "12345")
        assert False, "Expected XApiError"
    except client_mod.XApiError as e:
        assert e.code == "AUTH_REQUIRED"
