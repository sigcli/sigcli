"""Tests for x/scripts/x_follow.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_follow")
client_mod = load_script("x", "x_client")

COOKIE = "ct0=testcsrf123; auth_token=testabc"

_USER_RESPONSE = {
    "data": {
        "user": {
            "result": {
                "rest_id": "44196397",
                "legacy": {"screen_name": "elonmusk"},
            },
        },
    },
}


@responses.activate
def test_follow_user_success():
    """follow_user returns success for follow action."""
    responses.get(url=re.compile(r".+/UserByScreenName"), json=_USER_RESPONSE, status=200)
    responses.post(url=re.compile(r".+/friendships/create\.json"), json={"id": 44196397}, status=200)
    result = mod.follow_user(COOKIE, "elonmusk")
    assert result["success"] is True
    assert result["action"] == "followed"
    assert result["username"] == "elonmusk"
    assert result["user_id"] == "44196397"


@responses.activate
def test_unfollow_user_success():
    """follow_user with undo returns success for unfollow action."""
    responses.get(url=re.compile(r".+/UserByScreenName"), json=_USER_RESPONSE, status=200)
    responses.post(url=re.compile(r".+/friendships/destroy\.json"), json={"id": 44196397}, status=200)
    result = mod.follow_user(COOKIE, "elonmusk", undo=True)
    assert result["success"] is True
    assert result["action"] == "unfollowed"


def test_follow_requires_auth():
    """follow_user raises XApiError without cookie."""
    try:
        mod.follow_user("", "elonmusk")
        assert False, "Expected XApiError"
    except client_mod.XApiError as e:
        assert e.code == "AUTH_REQUIRED"
