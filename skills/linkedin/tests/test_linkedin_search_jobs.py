"""Tests for linkedin/scripts/linkedin_search_jobs.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_search_jobs")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_JOBS_RESPONSE = {
    "elements": [
        {
            "jobCardUnion": {
                "jobPostingCard": {
                    "jobPostingUrn": "urn:li:fsd_jobPosting:3800000001",
                    "jobPostingTitle": "Senior Python Developer",
                    "primaryDescription": {"text": "Acme Corp"},
                    "secondaryDescription": {"text": "San Francisco, CA"},
                    "tertiaryDescription": {"text": "$150k - $200k"},
                    "footerItems": [
                        {"type": "LISTED_DATE", "timeAt": 1700000000000}
                    ],
                }
            }
        },
        {
            "jobCardUnion": {
                "jobPostingCard": {
                    "jobPostingUrn": "urn:li:fsd_jobPosting:3800000002",
                    "jobPostingTitle": "Backend Engineer",
                    "primaryDescription": {"text": "Widgets Inc"},
                    "secondaryDescription": {"text": "Remote"},
                    "tertiaryDescription": {"text": ""},
                    "footerItems": [],
                }
            }
        },
    ]
}


@responses.activate
def test_search_jobs_returns_results():
    """search_jobs returns formatted job listings."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/voyagerJobsDashJobCards"),
        json=_JOBS_RESPONSE,
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.search_jobs(client, "python developer", limit=10)

    assert result["query"] == "python developer"
    assert result["count"] == 2
    assert len(result["jobs"]) == 2
    assert result["jobs"][0]["title"] == "Senior Python Developer"
    assert result["jobs"][0]["company"] == "Acme Corp"
    assert result["jobs"][0]["location"] == "San Francisco, CA"
    assert result["jobs"][0]["jobId"] == "3800000001"
    assert result["jobs"][0]["rank"] == 1


@responses.activate
def test_search_jobs_empty():
    """search_jobs returns empty list when no jobs match."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/voyagerJobsDashJobCards"),
        json={"elements": []},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.search_jobs(client, "nonexistent job xyz", limit=10)

    assert result["count"] == 0
    assert result["jobs"] == []


def test_search_jobs_requires_auth():
    """search_jobs raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.search_jobs(client, "python")
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"
