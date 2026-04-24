"""Tests for reddit/scripts/reddit_new.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_new")
client_mod = load_script("reddit", "reddit_client")

_POST_DATA = {
    "id": "new1",
    "title": "New Post",
    "author": "u1",
    "subreddit": "python",
    "score": 5,
    "upvote_ratio": 1.0,
    "num_comments": 0,
    "created_utc": 1700000000,
    "url": "",
    "permalink": "",
    "selftext": "",
    "is_self": True,
    "thumbnail": "",
    "link_flair_text": None,
    "over_18": False,
}

_LISTING = {
    "kind": "Listing",
    "data": {
        "children": [{"kind": "t3", "data": _POST_DATA}],
        "after": "t3_new1",
    },
}


@responses.activate
def test_get_new_posts():
    responses.get(url=re.compile(r"https://www\.reddit\.com/r/python/new\.json"), json=_LISTING, status=200)
    client = client_mod.RedditClient()
    result = mod.get_new_posts(client, "python", "new", 25)
    assert result["count"] == 1
    assert result["sort"] == "new"
    assert result["posts"][0]["id"] == "new1"
    assert result["after"] == "t3_new1"


@responses.activate
def test_get_rising_posts():
    responses.get(url=re.compile(r"https://www\.reddit\.com/r/all/rising\.json"), json=_LISTING, status=200)
    client = client_mod.RedditClient()
    result = mod.get_new_posts(client, "all", "rising", 10)
    assert result["sort"] == "rising"


@responses.activate
def test_pagination():
    responses.get(url=re.compile(r"https://www\.reddit\.com/r/python/new\.json"), json=_LISTING, status=200)
    client = client_mod.RedditClient()
    mod.get_new_posts(client, "python", "new", 25, after="t3_prev")
    assert "after=t3_prev" in responses.calls[0].request.url
