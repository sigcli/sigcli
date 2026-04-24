"""Tests for reddit/scripts/reddit_search.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_search")
client_mod = load_script("reddit", "reddit_client")

_SEARCH_LISTING = {
    "kind": "Listing",
    "data": {
        "children": [
            {
                "kind": "t3",
                "data": {
                    "id": "s001",
                    "title": "Machine Learning Tutorial",
                    "author": "mlguru",
                    "subreddit": "machinelearning",
                    "score": 200,
                    "upvote_ratio": 0.92,
                    "num_comments": 50,
                    "created_utc": 1700000000,
                    "url": "https://example.com/ml",
                    "permalink": "/r/machinelearning/comments/s001/ml_tutorial/",
                    "selftext": "Learn ML basics",
                    "is_self": True,
                    "thumbnail": "self",
                    "link_flair_text": "Tutorial",
                    "over_18": False,
                },
            },
        ],
        "after": "t3_s001",
        "before": None,
    },
}


@responses.activate
def test_search_posts_returns_results():
    """search_posts returns formatted search results."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/search\.json"),
        json=_SEARCH_LISTING,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.search_posts(client, "machine learning", None, "relevance", "all", 25)

    assert result["query"] == "machine learning"
    assert result["count"] == 1
    assert result["after"] == "t3_s001"

    post = result["posts"][0]
    assert post["id"] == "s001"
    assert post["title"] == "Machine Learning Tutorial"


@responses.activate
def test_search_posts_within_subreddit():
    """search_posts restricts search to a specific subreddit."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/python/search\.json"),
        json=_SEARCH_LISTING,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.search_posts(client, "async", "python", "top", "month", 10)

    assert result["query"] == "async"
    assert result["count"] == 1


@responses.activate
def test_search_posts_empty_results():
    """search_posts returns empty list when no results found."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/search\.json"),
        json={"kind": "Listing", "data": {"children": [], "after": None, "before": None}},
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.search_posts(client, "nonexistenttopic12345", None, "relevance", "all", 25)

    assert result["query"] == "nonexistenttopic12345"
    assert result["count"] == 0
    assert result["posts"] == []
    assert result["after"] is None
