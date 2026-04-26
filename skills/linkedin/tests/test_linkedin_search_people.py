"""Tests for linkedin/scripts/linkedin_search_people.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_search_people")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_PEOPLE_RESPONSE = {
    "elements": [
        {
            "items": [
                {
                    "item": {
                        "entityResult": {
                            "title": {"text": "Jane Doe"},
                            "primarySubtitle": {"text": "Software Engineer at Acme"},
                            "secondarySubtitle": {"text": "San Francisco Bay Area"},
                            "navigationContext": {
                                "url": "https://www.linkedin.com/in/janedoe?miniProfileUrn=urn"
                            },
                            "entityUrn": "urn:li:fsd_entityResultViewModel:(urn:li:fsd_profile:ACoAAA111111,SEARCH,ALL)",
                        }
                    }
                },
                {
                    "item": {
                        "entityResult": {
                            "title": {"text": "Bob Smith"},
                            "primarySubtitle": {"text": "Product Manager"},
                            "secondarySubtitle": {"text": "New York"},
                            "navigationContext": {
                                "url": "https://www.linkedin.com/in/bobsmith?miniProfileUrn=urn"
                            },
                            "entityUrn": "urn:li:fsd_entityResultViewModel:(urn:li:fsd_profile:ACoAAB222222,SEARCH,ALL)",
                        }
                    }
                },
            ]
        }
    ]
}


@responses.activate
def test_search_people_returns_results():
    """search_people returns formatted people results."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/voyagerSearchDashClusters"),
        json=_PEOPLE_RESPONSE,
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.search_people(client, "software engineer", limit=10)

    assert result["query"] == "software engineer"
    assert result["count"] == 2
    assert len(result["people"]) == 2
    assert result["people"][0]["name"] == "Jane Doe"
    assert result["people"][0]["headline"] == "Software Engineer at Acme"
    assert result["people"][0]["location"] == "San Francisco Bay Area"
    assert result["people"][0]["publicIdentifier"] == "janedoe"
    assert result["people"][0]["profileUrl"] == "https://www.linkedin.com/in/janedoe"


@responses.activate
def test_search_people_empty():
    """search_people returns empty list when no results found."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/voyagerSearchDashClusters"),
        json={"elements": []},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.search_people(client, "xyznonexistent", limit=10)

    assert result["count"] == 0
    assert result["people"] == []


def test_search_people_requires_auth():
    """search_people raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.search_people(client, "test")
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"
