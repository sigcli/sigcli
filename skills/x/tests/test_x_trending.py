"""Tests for x/scripts/x_trending.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_trending")
client_mod = load_script("x", "x_client")

_GUIDE_RESPONSE = {
    "timeline": {
        "instructions": [
            {
                "addEntries": {
                    "entries": [
                        {
                            "content": {
                                "timelineModule": {
                                    "items": [
                                        {
                                            "item": {
                                                "content": {
                                                    "trend": {
                                                        "name": "#AI",
                                                        "tweetCount": 150000,
                                                        "trendMetadata": {"domainContext": "Technology"},
                                                    },
                                                },
                                            },
                                        },
                                        {
                                            "item": {
                                                "content": {
                                                    "trend": {
                                                        "name": "#Python",
                                                        "tweetCount": 80000,
                                                        "trendMetadata": {"domainContext": "Technology"},
                                                    },
                                                },
                                            },
                                        },
                                        {
                                            "item": {
                                                "content": {
                                                    "trend": {
                                                        "name": "Breaking News",
                                                        "tweetCount": None,
                                                        "trendMetadata": {"domainContext": "News"},
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                },
            },
        ],
    },
}


@responses.activate
def test_get_trending_returns_topics():
    """get_trending returns formatted trending topics."""
    responses.get(url=re.compile(r"https://x\.com/i/api/2/guide\.json"), json=_GUIDE_RESPONSE, status=200)
    client = client_mod.XClient(cookie="ct0=abc123; auth_token=xyz")
    result = mod.get_trending(client, limit=20)
    assert result["count"] == 3
    assert result["trends"][0]["rank"] == 1
    assert result["trends"][0]["topic"] == "#AI"
    assert result["trends"][0]["tweets"] == "150000"
    assert result["trends"][0]["category"] == "Technology"
    assert result["trends"][2]["tweets"] == "N/A"


@responses.activate
def test_get_trending_respects_limit():
    """get_trending respects the limit parameter."""
    responses.get(url=re.compile(r"https://x\.com/i/api/2/guide\.json"), json=_GUIDE_RESPONSE, status=200)
    client = client_mod.XClient(cookie="ct0=abc123; auth_token=xyz")
    result = mod.get_trending(client, limit=1)
    assert result["count"] == 1
    assert len(result["trends"]) == 1


@responses.activate
def test_get_trending_empty():
    """get_trending returns empty for no trends."""
    empty = {"timeline": {"instructions": []}}
    responses.get(url=re.compile(r"https://x\.com/i/api/2/guide\.json"), json=empty, status=200)
    client = client_mod.XClient(cookie="ct0=abc123; auth_token=xyz")
    result = mod.get_trending(client, limit=20)
    assert result["count"] == 0
    assert result["trends"] == []


def test_get_trending_requires_auth():
    """get_trending raises XApiError without cookie."""
    client = client_mod.XClient()
    try:
        mod.get_trending(client)
        assert False, "Expected XApiError"
    except client_mod.XApiError as e:
        assert e.code == "AUTH_REQUIRED"
