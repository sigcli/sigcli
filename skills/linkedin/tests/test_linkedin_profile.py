"""Tests for linkedin/scripts/linkedin_profile.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_profile")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_PROFILE_RESPONSE = {
    "elements": [
        {
            "miniProfile": {
                "firstName": "Alice",
                "lastName": "Wonder",
                "headline": "Data Scientist",
                "publicIdentifier": "alicewonder",
            },
            "multiLocaleFirstName": {"en_US": "Alice"},
            "multiLocaleLastName": {"en_US": "Wonder"},
            "multiLocaleHeadline": {"en_US": "Data Scientist"},
            "geoLocation": {"geo": {"defaultLocalizedName": "San Francisco"}},
        }
    ]
}


@responses.activate
def test_get_profile_returns_data():
    """get_profile returns formatted profile data."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/identity/dash/profiles"),
        json=_PROFILE_RESPONSE,
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.get_profile(client, "alicewonder")

    assert result["firstName"] == "Alice"
    assert result["lastName"] == "Wonder"
    assert result["headline"] == "Data Scientist"
    assert result["location"] == "San Francisco"
    assert result["profileUrl"] == "https://www.linkedin.com/in/alicewonder"


@responses.activate
def test_get_profile_not_found():
    """get_profile raises NOT_FOUND when profile data is empty."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/identity/dash/profiles"),
        json={"elements": []},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    try:
        mod.get_profile(client, "nonexistent")
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "NOT_FOUND"


def test_get_profile_requires_auth():
    """get_profile raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.get_profile(client, "someone")
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"


@responses.activate
def test_get_profile_from_included_fallback():
    """get_profile extracts from included array when elements is empty."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/identity/dash/profiles"),
        json={
            "elements": [],
            "included": [
                {
                    "$type": "com.linkedin.voyager.identity.shared.MiniProfile",
                    "firstName": "Bob",
                    "lastName": "Builder",
                    "headline": "Engineer",
                    "publicIdentifier": "bobbuilder",
                }
            ],
        },
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.get_profile(client, "bobbuilder")

    assert result["firstName"] == "Bob"
    assert result["lastName"] == "Builder"
