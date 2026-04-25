"""Tests for x/scripts/x_post.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_post")
client_mod = load_script("x", "x_client")

COOKIE = "ct0=testcsrf123; auth_token=testabc"


@responses.activate
def test_create_tweet_success():
    """create_tweet returns success with tweet ID."""
    responses.post(
        url=re.compile(r".+/CreateTweet"),
        json={
            "data": {
                "create_tweet": {
                    "tweet_results": {
                        "result": {"rest_id": "12345678"},
                    },
                },
            },
        },
        status=200,
    )
    result = mod.create_tweet(COOKIE, "Hello from sigcli!")
    assert result["success"] is True
    assert result["tweet_id"] == "12345678"
    assert result["text"] == "Hello from sigcli!"


@responses.activate
def test_create_tweet_with_reply():
    """create_tweet sets reply variables when reply_to is provided."""
    responses.post(
        url=re.compile(r".+/CreateTweet"),
        json={
            "data": {
                "create_tweet": {
                    "tweet_results": {
                        "result": {"rest_id": "99999"},
                    },
                },
            },
        },
        status=200,
    )
    result = mod.create_tweet(COOKIE, "Reply!", reply_to="12345")
    assert result["success"] is True
    assert result["tweet_id"] == "99999"


@responses.activate
def test_create_tweet_failure():
    """create_tweet raises XApiError when response has no result."""
    responses.post(
        url=re.compile(r".+/CreateTweet"),
        json={"data": {"create_tweet": {"tweet_results": {}}}},
        status=200,
    )
    try:
        mod.create_tweet(COOKIE, "fail tweet")
        assert False, "Expected XApiError"
    except client_mod.XApiError as e:
        assert e.code == "POST_FAILED"


def test_create_tweet_requires_auth():
    """create_tweet raises XApiError without cookie."""
    try:
        mod.create_tweet("", "no auth")
        assert False, "Expected XApiError"
    except client_mod.XApiError as e:
        assert e.code == "AUTH_REQUIRED"
