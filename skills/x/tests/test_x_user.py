"""Tests for x/scripts/x_user.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_user")
client_mod = load_script("x", "x_client")

_USER_RESPONSE = {
    "data": {
        "user": {
            "result": {
                "__typename": "User",
                "rest_id": "44196397",
                "is_blue_verified": True,
                "legacy": {
                    "screen_name": "elonmusk",
                    "name": "Elon Musk",
                    "description": "Mars & Cars",
                    "location": "Austin, TX",
                    "followers_count": 180000000,
                    "friends_count": 500,
                    "statuses_count": 40000,
                    "favourites_count": 30000,
                    "verified": False,
                    "created_at": "Tue Jun 02 20:12:29 +0000 2009",
                    "entities": {
                        "url": {
                            "urls": [{"expanded_url": "https://tesla.com"}],
                        },
                    },
                },
            },
        },
    },
}


@responses.activate
def test_get_user_returns_profile():
    """get_user returns correctly formatted user profile."""
    responses.get(
        url=re.compile(r"https://x\.com/i/api/graphql/.+/UserByScreenName"),
        json=_USER_RESPONSE,
        status=200,
    )
    client = client_mod.XClient()
    result = mod.get_user(client, "elonmusk")
    assert result["screen_name"] == "elonmusk"
    assert result["name"] == "Elon Musk"
    assert result["followers"] == 180000000
    assert result["verified"] is True
    assert result["url"] == "https://tesla.com"


@responses.activate
def test_get_user_not_found():
    """get_user raises XApiError for missing user."""
    responses.get(
        url=re.compile(r"https://x\.com/i/api/graphql/.+/UserByScreenName"),
        json={"data": {"user": {}}},
        status=200,
    )
    client = client_mod.XClient()
    try:
        mod.get_user(client, "nonexistentuser12345")
        assert False, "Expected XApiError"
    except client_mod.XApiError as e:
        assert e.code == "NOT_FOUND"


@responses.activate
def test_get_user_without_url():
    """get_user handles users with no URL entity."""
    resp = {
        "data": {
            "user": {
                "result": {
                    "__typename": "User",
                    "rest_id": "123",
                    "is_blue_verified": False,
                    "legacy": {
                        "screen_name": "testuser",
                        "name": "Test",
                        "description": "",
                        "location": "",
                        "followers_count": 10,
                        "friends_count": 5,
                        "statuses_count": 100,
                        "favourites_count": 50,
                        "verified": False,
                        "created_at": "Mon Jan 01 00:00:00 +0000 2020",
                        "entities": {},
                    },
                },
            },
        },
    }
    responses.get(
        url=re.compile(r"https://x\.com/i/api/graphql/.+/UserByScreenName"),
        json=resp,
        status=200,
    )
    client = client_mod.XClient()
    result = mod.get_user(client, "testuser")
    assert result["screen_name"] == "testuser"
    assert result["url"] == ""
    assert result["verified"] is False
