"""Tests for reddit/scripts/reddit_subreddit.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_subreddit")
client_mod = load_script("reddit", "reddit_client")

_SUBREDDIT_ABOUT = {
    "kind": "t5",
    "data": {
        "display_name": "python",
        "title": "Python",
        "public_description": "News about the Python programming language",
        "subscribers": 1200000,
        "active_user_count": 5000,
        "created_utc": 1200000000,
        "over18": False,
        "url": "/r/python/",
    },
}


@responses.activate
def test_get_subreddit_returns_info():
    """get_subreddit returns formatted subreddit information."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/python/about\.json"),
        json=_SUBREDDIT_ABOUT,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_subreddit(client, "python")

    sub = result["subreddit"]
    assert sub["display_name"] == "python"
    assert sub["title"] == "Python"
    assert sub["subscribers"] == 1200000
    assert sub["active_user_count"] == 5000
    assert sub["over18"] is False
    assert sub["url"] == "/r/python/"


@responses.activate
def test_get_subreddit_nsfw():
    """get_subreddit correctly reports NSFW subreddits."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/nsfw_test/about\.json"),
        json={
            "kind": "t5",
            "data": {
                "display_name": "nsfw_test",
                "title": "NSFW Test",
                "public_description": "Test subreddit",
                "subscribers": 100,
                "active_user_count": 10,
                "created_utc": 1600000000,
                "over18": True,
                "url": "/r/nsfw_test/",
            },
        },
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_subreddit(client, "nsfw_test")

    assert result["subreddit"]["over18"] is True


@responses.activate
def test_get_subreddit_minimal_data():
    """get_subreddit handles missing optional fields gracefully."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/minimal/about\.json"),
        json={
            "kind": "t5",
            "data": {
                "display_name": "minimal",
            },
        },
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_subreddit(client, "minimal")

    sub = result["subreddit"]
    assert sub["display_name"] == "minimal"
    assert sub["title"] == ""
    assert sub["subscribers"] == 0
    assert sub["active_user_count"] == 0
