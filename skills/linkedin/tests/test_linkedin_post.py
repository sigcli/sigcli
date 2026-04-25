"""Tests for linkedin/scripts/linkedin_post.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_post")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'


@responses.activate
def test_create_post_success():
    """create_post returns success with URN."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/contentcreation/normShares"),
        json={"urn": "urn:li:activity:7100000000000000099"},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.create_post(client, "Hello LinkedIn!")

    assert result["success"] is True
    assert result["urn"] == "urn:li:activity:7100000000000000099"
    assert "linkedin.com/feed/update/" in result["url"]
    assert result["message"] == "Post created successfully"


@responses.activate
def test_create_post_with_value_urn():
    """create_post extracts URN from value.urn fallback."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/contentcreation/normShares"),
        json={"value": {"urn": "urn:li:activity:7100000000000000100"}},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.create_post(client, "Another post")

    assert result["success"] is True
    assert result["urn"] == "urn:li:activity:7100000000000000100"


def test_create_post_requires_auth():
    """create_post raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.create_post(client, "test")
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"
