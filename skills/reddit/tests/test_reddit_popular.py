"""Tests for reddit/scripts/reddit_popular.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_popular")
client_mod = load_script("reddit", "reddit_client")

_POST_DATA = {
    "id": "pop1",
    "title": "Popular Post",
    "author": "u1",
    "subreddit": "funny",
    "score": 5000,
    "upvote_ratio": 0.97,
    "num_comments": 200,
    "created_utc": 1700000000,
    "url": "",
    "permalink": "",
    "selftext": "",
    "is_self": False,
    "thumbnail": "",
    "link_flair_text": None,
    "over_18": False,
}

_LISTING = {
    "kind": "Listing",
    "data": {
        "children": [{"kind": "t3", "data": _POST_DATA}],
        "after": "t3_pop1",
    },
}

_EMPTY_LISTING = {
    "kind": "Listing",
    "data": {"children": [], "after": None},
}


@responses.activate
def test_get_popular():
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/popular\.json"),
        json=_LISTING,
        status=200,
    )
    client = client_mod.RedditClient()
    result = mod.get_popular(client, 25)
    assert result["count"] == 1
    assert result["posts"][0]["id"] == "pop1"
    assert result["after"] == "t3_pop1"


@responses.activate
def test_get_popular_empty():
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/popular\.json"),
        json=_EMPTY_LISTING,
        status=200,
    )
    client = client_mod.RedditClient()
    result = mod.get_popular(client, 10)
    assert result["count"] == 0
