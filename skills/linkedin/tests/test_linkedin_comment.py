"""Tests for linkedin/scripts/linkedin_comment.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_comment")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_POST_URN = "urn:li:activity:7100000000000000001"


@responses.activate
def test_post_comment_success():
    """post_comment returns success with comment URN."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/voyagerSocialDashNormComments"),
        json={"data": {"entityUrn": "urn:li:fsd_normComment:urn:li:fsd_comment:(7200000000000000001,urn:li:activity:7100000000000000001)"}},
        status=201,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.post_comment(client, _POST_URN, "Great insight!")

    assert result["success"] is True
    assert result["postUrn"] == _POST_URN
    assert "comment" in result["commentUrn"].lower() or "Comment" in result["commentUrn"]
    assert result["message"] == "Comment posted successfully"


@responses.activate
def test_post_comment_empty_response():
    """post_comment handles empty entityUrn in response."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/voyagerSocialDashNormComments"),
        json={"data": {}},
        status=201,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.post_comment(client, _POST_URN, "Nice post")

    assert result["success"] is True
    assert result["commentUrn"] == ""


def test_post_comment_requires_auth():
    """post_comment raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.post_comment(client, _POST_URN, "test")
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"
