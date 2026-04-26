"""Tests for linkedin/scripts/linkedin_follow.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_follow")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_USER_URN = "urn:li:fsd_profile:ACoAAA123456"


@responses.activate
def test_follow_user_success():
    """follow_user follows a user and returns success."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/feed/follows"),
        json={},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.follow_user(client, _USER_URN)

    assert result["success"] is True
    assert result["action"] == "followed"
    assert result["urn"] == _USER_URN


@responses.activate
def test_unfollow_user_success():
    """follow_user with undo=True unfollows a user."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/feed/follows"),
        json={},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.follow_user(client, _USER_URN, undo=True)

    assert result["success"] is True
    assert result["action"] == "unfollowed"
    assert result["urn"] == _USER_URN


def test_follow_user_requires_auth():
    """follow_user raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.follow_user(client, _USER_URN)
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"


@responses.activate
def test_follow_user_expired_session():
    """follow_user raises AUTH_EXPIRED on 401."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/feed/follows"),
        json={},
        status=401,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    try:
        mod.follow_user(client, _USER_URN)
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_EXPIRED"
