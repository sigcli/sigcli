"""Tests for x/scripts/x_delete.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_delete")
client_mod = load_script("x", "x_client")

COOKIE = "ct0=testcsrf123; auth_token=testabc"


@responses.activate
def test_delete_tweet_success():
    """delete_tweet returns success only when X confirms the deletion."""
    responses.post(
        url=re.compile(r".+/DeleteTweet"),
        json={
            "data": {
                "delete_tweet": {
                    "tweet_results": {
                        "result": {"rest_id": "12345"},
                    },
                },
            },
        },
        status=200,
    )

    result = mod.delete_tweet(COOKIE, "12345")

    assert result["success"] is True
    assert result["tweet_id"] == "12345"


@responses.activate
def test_delete_tweet_rejects_empty_result():
    """delete_tweet raises XApiError when X does not confirm deletion."""
    responses.post(
        url=re.compile(r".+/DeleteTweet"),
        json={"data": {"delete_tweet": {"tweet_results": {}}}},
        status=200,
    )

    try:
        mod.delete_tweet(COOKIE, "12345")
        assert False, "Expected XApiError"
    except client_mod.XApiError as error:
        assert error.code == "DELETE_FAILED"


def test_delete_tweet_requires_auth():
    """delete_tweet raises XApiError without a session cookie."""
    try:
        mod.delete_tweet("", "12345")
        assert False, "Expected XApiError"
    except client_mod.XApiError as error:
        assert error.code == "AUTH_REQUIRED"
