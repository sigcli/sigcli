"""Tests for linkedin/scripts/linkedin_job.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_job")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_JOB_RESPONSE = {
    "title": "Senior Software Engineer",
    "companyDetails": {"company": {"name": "Acme Corp"}},
    "description": {"text": "We are looking for an experienced engineer to join our team."},
    "formattedLocation": "San Francisco, CA",
    "workplaceTypesResolutionResults": {
        "urn:li:fsd_workplaceType:1": {"localizedName": "On-site"}
    },
    "listedAt": 1700000000000,
    "applies": 150,
    "views": 2500,
}


@responses.activate
def test_get_job_returns_details():
    """get_job returns formatted job posting details."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/jobs/jobPostings/12345678"),
        json=_JOB_RESPONSE,
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.get_job(client, "12345678")

    assert result["jobId"] == "12345678"
    assert result["title"] == "Senior Software Engineer"
    assert result["company"] == "Acme Corp"
    assert result["location"] == "San Francisco, CA"
    assert result["workplaceType"] == "On-site"
    assert result["applies"] == 150
    assert result["views"] == 2500
    assert result["url"] == "https://www.linkedin.com/jobs/view/12345678"


@responses.activate
def test_get_job_minimal_data():
    """get_job handles minimal job data gracefully."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/voyager/api/jobs/jobPostings/99999999"),
        json={"title": "Intern", "formattedLocation": "Remote"},
        status=200,
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.get_job(client, "99999999")

    assert result["jobId"] == "99999999"
    assert result["title"] == "Intern"
    assert result["location"] == "Remote"
    assert result["company"] == ""


def test_get_job_requires_auth():
    """get_job raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.get_job(client, "12345678")
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"
