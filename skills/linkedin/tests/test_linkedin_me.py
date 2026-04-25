"""Tests for linkedin/scripts/linkedin_me.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_me")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_ME_RESPONSE = {
    "miniProfile": {
        "firstName": "Jane",
        "lastName": "Doe",
        "headline": "Software Engineer at Acme",
        "publicIdentifier": "janedoe",
    },
    "entityUrn": "urn:li:fsd_profile:ACoAAA123456",
}


@responses.activate
def test_get_me_returns_profile():
    """get_me returns the current user profile."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/me"),
        json=_ME_RESPONSE,
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.get_me(client)

    assert result["firstName"] == "Jane"
    assert result["lastName"] == "Doe"
    assert result["headline"] == "Software Engineer at Acme"
    assert result["publicIdentifier"] == "janedoe"
    assert result["entityUrn"] == "urn:li:fsd_profile:ACoAAA123456"


@responses.activate
def test_get_me_without_mini_profile():
    """get_me falls back to top-level fields when miniProfile is absent."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/me"),
        json={
            "firstName": "John",
            "lastName": "Smith",
            "headline": "PM",
            "publicIdentifier": "johnsmith",
            "entityUrn": "urn:li:fsd_profile:ACoAAB999999",
        },
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.get_me(client)

    assert result["firstName"] == "John"
    assert result["lastName"] == "Smith"


def test_get_me_requires_auth():
    """get_me raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.get_me(client)
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"


@responses.activate
def test_get_me_expired_session():
    """get_me raises AUTH_EXPIRED on 401."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/me"),
        json={},
        status=401,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    try:
        mod.get_me(client)
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_EXPIRED"
