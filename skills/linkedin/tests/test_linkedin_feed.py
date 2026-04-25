"""Tests for linkedin/scripts/linkedin_feed.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_feed")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_FEED_RESPONSE = {
    "elements": [
        {
            "value": {
                "actor": {
                    "name": {"text": "Jane Doe"},
                    "navigationContext": {"actionTarget": "https://www.linkedin.com/in/janedoe"},
                },
                "commentary": {"text": {"text": "Excited to share my latest project!"}},
                "socialDetail": {
                    "totalSocialActivityCounts": {"numLikes": 42, "numComments": 5},
                },
                "updateUrn": "urn:li:activity:7100000000000000001",
            }
        },
        {
            "value": {
                "actor": {
                    "name": {"text": "Bob Smith"},
                    "navigationContext": {"actionTarget": "https://www.linkedin.com/in/bobsmith"},
                },
                "commentary": {"text": {"text": "Great article on AI trends."}},
                "socialDetail": {
                    "totalSocialActivityCounts": {"numLikes": 10, "numComments": 2},
                },
                "updateUrn": "urn:li:activity:7100000000000000002",
            }
        },
    ],
    "included": [],
}


@responses.activate
def test_get_feed_returns_posts():
    """get_feed returns formatted feed posts."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/feed/updatesV2"),
        json=_FEED_RESPONSE,
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.get_feed(client, limit=10)

    assert result["count"] == 2
    assert len(result["posts"]) == 2
    assert result["posts"][0]["author"] == "Jane Doe"
    assert result["posts"][0]["text"] == "Excited to share my latest project!"
    assert result["posts"][0]["reactions"] == 42
    assert result["posts"][0]["comments"] == 5


@responses.activate
def test_get_feed_empty():
    """get_feed returns empty list when feed has no posts."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/feed/updatesV2"),
        json={"elements": [], "included": []},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.get_feed(client, limit=10)

    assert result["count"] == 0
    assert result["posts"] == []


def test_get_feed_requires_auth():
    """get_feed raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.get_feed(client)
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"
