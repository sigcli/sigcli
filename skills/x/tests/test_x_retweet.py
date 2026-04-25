"""Tests for x/scripts/x_retweet.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_retweet")
client_mod = load_script("x", "x_client")

COOKIE = "ct0=testcsrf123; auth_token=testabc"


@responses.activate
def test_retweet_success():
    """retweet returns success for retweet action."""
    responses.post(
        url=re.compile(r".+/CreateRetweet"),
        json={"data": {"create_retweet": {"retweet_results": {"result": {"rest_id": "99"}}}}},
        status=200,
    )
    result = mod.retweet(COOKIE, "12345")
    assert result["success"] is True
    assert result["action"] == "retweeted"
    assert result["tweet_id"] == "12345"


@responses.activate
def test_undo_retweet_success():
    """retweet with undo returns success for unretweet action."""
    responses.post(
        url=re.compile(r".+/DeleteRetweet"),
        json={"data": {"unretweet": {"source_tweet_results": {"result": {"rest_id": "12345"}}}}},
        status=200,
    )
    result = mod.retweet(COOKIE, "12345", undo=True)
    assert result["success"] is True
    assert result["action"] == "unretweeted"


def test_retweet_requires_auth():
    """retweet raises XApiError without cookie."""
    try:
        mod.retweet("", "12345")
        assert False, "Expected XApiError"
    except client_mod.XApiError as e:
        assert e.code == "AUTH_REQUIRED"
