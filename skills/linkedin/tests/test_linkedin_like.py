"""Tests for linkedin/scripts/linkedin_like.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_like")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_POST_URN = "urn:li:activity:7100000000000000001"


@responses.activate
def test_like_post_success():
    """like_post likes a post and returns success."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/feed/reactions"),
        json={},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.like_post(client, _POST_URN)

    assert result["success"] is True
    assert result["action"] == "liked"
    assert result["urn"] == _POST_URN


@responses.activate
def test_unlike_post_success():
    """like_post with undo=True unlikes a post."""
    responses.post(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/feed/reactions"),
        json={},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.like_post(client, _POST_URN, undo=True)

    assert result["success"] is True
    assert result["action"] == "unliked"
    assert result["urn"] == _POST_URN


def test_like_post_requires_auth():
    """like_post raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.like_post(client, _POST_URN)
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"
