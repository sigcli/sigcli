"""Tests for linkedin/scripts/linkedin_search_posts.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("linkedin", "linkedin_search_posts")
client_mod = load_script("linkedin", "linkedin_client")

FAKE_COOKIE = 'JSESSIONID="ajax:fakecsrf123"; li_at=fakesession'

_RSC_HTML = (
    "<html><head><title>LinkedIn</title></head><body>"
    '<script>window.__INITIAL_STATE__ = {'
    '\\"actorName\\":\\"John Doe\\"'
    ',\\"postSlugUrl\\":\\"https:\\/\\/www.linkedin.com\\/posts\\/johndoe_testing-activity\\"'
    ',\\"children\\":[null,\\"This is a great post about AI\\"]'
    ",}"
    '\\"actorName\\":\\"Alice Wang\\"'
    ',\\"postSlugUrl\\":\\"https:\\/\\/www.linkedin.com\\/posts\\/alicewang_engineering-update\\"'
    ',\\"children\\":[null,\\"Sharing my thoughts on engineering\\"]'
    "</script></body></html>"
)


@responses.activate
def test_search_posts_parses_rsc_html():
    """search_posts extracts posts from RSC-embedded HTML."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/search/results/content/"),
        body=_RSC_HTML,
        status=200,
        content_type="text/html",
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.search_posts(client, "AI", limit=10)

    assert result["query"] == "AI"
    assert result["count"] == 2
    assert len(result["posts"]) == 2
    assert result["posts"][0]["author"] == "John Doe"
    assert "linkedin.com/posts/" in result["posts"][0]["url"]
    assert result["posts"][0]["rank"] == 1
    assert result["posts"][1]["author"] == "Alice Wang"


@responses.activate
def test_search_posts_empty():
    """search_posts returns empty when no matching content in HTML."""
    responses.get(
        url=re.compile(r"https://www\.linkedin\.com/search/results/content/"),
        body="<html><body>No results</body></html>",
        status=200,
        content_type="text/html",
    )

    client = client_mod.LinkedInClient(FAKE_COOKIE)
    result = mod.search_posts(client, "xyznonexistent", limit=10)

    assert result["count"] == 0
    assert result["posts"] == []


def test_search_posts_requires_auth():
    """search_posts raises AUTH_REQUIRED when no cookie is provided."""
    client = client_mod.LinkedInClient("")
    try:
        mod.search_posts(client, "test")
        assert False, "Should have raised"
    except client_mod.LinkedInApiError as e:
        assert e.code == "AUTH_REQUIRED"
