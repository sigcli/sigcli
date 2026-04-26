"""Tests for linkedin/scripts/linkedin_connect.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_connect")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_PROFILE_URN = "urn:li:fsd_profile:ACoAAA123456"


@responses.activate
def test_send_connection_success():
    """send_connection returns success."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/voyagerRelationshipsDashMemberRelationships"),
        json={},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.send_connection(client, _PROFILE_URN)

    assert result["success"] is True
    assert result["action"] == "connection_sent"
    assert result["profileUrn"] == _PROFILE_URN


@responses.activate
def test_send_connection_with_message():
    """send_connection includes custom message in payload."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/voyagerRelationshipsDashMemberRelationships"),
        json={},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.send_connection(client, _PROFILE_URN, message="Hi, let's connect!")

    assert result["success"] is True
    assert result["action"] == "connection_sent"
    # Verify the request body included the custom message
    body = responses.calls[0].request.body
    assert "connect" in body.decode() if isinstance(body, bytes) else "connect" in body


def test_send_connection_requires_auth():
    """send_connection raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.send_connection(client, _PROFILE_URN)
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"
