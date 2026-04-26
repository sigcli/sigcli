"""Tests for x/scripts/x_followers.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_followers")
client_mod = load_script("x", "x_client")

_USER_RESPONSE = {
    "data": {
        "user": {
            "result": {
                "rest_id": "123",
                "legacy": {"screen_name": "testuser"},
            },
        },
    },
}

_FOLLOWERS_RESPONSE = {
    "data": {
        "user": {
            "result": {
                "timeline": {
                    "timeline": {
                        "instructions": [
                            {
                                "type": "TimelineAddEntries",
                                "entries": [
                                    {
                                        "entryId": "user-111",
                                        "content": {
                                            "itemContent": {
                                                "user_results": {
                                                    "result": {
                                                        "__typename": "User",
                                                        "core": {"screen_name": "follower1", "name": "Follower One"},
                                                        "legacy": {
                                                            "screen_name": "follower1",
                                                            "name": "Follower One",
                                                            "description": "I follow you",
                                                            "followers_count": 100,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    {
                                        "entryId": "user-222",
                                        "content": {
                                            "itemContent": {
                                                "user_results": {
                                                    "result": {
                                                        "__typename": "User",
                                                        "core": {"screen_name": "follower2", "name": "Follower Two"},
                                                        "legacy": {
                                                            "screen_name": "follower2",
                                                            "name": "Follower Two",
                                                            "description": "Another follower",
                                                            "followers_count": 200,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    {
                                        "entryId": "cursor-bottom-abc",
                                        "content": {"value": "cursor-abc"},
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
        },
    },
}


@responses.activate
def test_get_followers_returns_list():
    """get_followers returns formatted followers list."""
    responses.get(url=re.compile(r".+/UserByScreenName"), json=_USER_RESPONSE, status=200)
    responses.get(url=re.compile(r".+/Followers"), json=_FOLLOWERS_RESPONSE, status=200)
    client = client_mod.XClient(cookie="ct0=abc123; auth_token=xyz")
    result = mod.get_followers(client, "testuser", limit=50, mode="followers")
    assert result["username"] == "testuser"
    assert result["mode"] == "followers"
    assert result["count"] == 2
    assert result["users"][0]["screen_name"] == "follower1"
    assert result["users"][1]["followers"] == 200


@responses.activate
def test_get_followers_respects_limit():
    """get_followers respects the limit parameter."""
    responses.get(url=re.compile(r".+/UserByScreenName"), json=_USER_RESPONSE, status=200)
    responses.get(url=re.compile(r".+/Followers"), json=_FOLLOWERS_RESPONSE, status=200)
    client = client_mod.XClient(cookie="ct0=abc123; auth_token=xyz")
    result = mod.get_followers(client, "testuser", limit=1)
    assert result["count"] == 1
    assert len(result["users"]) == 1


def test_get_followers_requires_auth():
    """get_followers raises XApiError without cookie."""
    client = client_mod.XClient()
    try:
        mod.get_followers(client, "testuser")
        assert False, "Expected XApiError"
    except client_mod.XApiError as e:
        assert e.code == "AUTH_REQUIRED"
