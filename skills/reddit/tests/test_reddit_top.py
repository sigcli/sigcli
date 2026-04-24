"""Tests for reddit/scripts/reddit_top.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_top")
client_mod = load_script("reddit", "reddit_client")

_TOP_LISTING = {
    "kind": "Listing",
    "data": {
        "children": [
            {
                "kind": "t3",
                "data": {
                    "id": "top001",
                    "title": "Top Post",
                    "author": "topuser",
                    "subreddit": "python",
                    "score": 5000,
                    "upvote_ratio": 0.97,
                    "num_comments": 300,
                    "created_utc": 1700000000,
                    "url": "https://example.com/top",
                    "permalink": "/r/python/comments/top001/top_post/",
                    "selftext": "This is the top post",
                    "is_self": True,
                    "thumbnail": "self",
                    "link_flair_text": "Tutorial",
                    "over_18": False,
                },
            },
        ],
        "after": None,
        "before": None,
    },
}


@responses.activate
def test_get_top_posts_returns_formatted_list():
    """get_top_posts returns correctly formatted post list with time period."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/python/top\.json"),
        json=_TOP_LISTING,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_top_posts(client, "python", "day", 25)

    assert result["subreddit"] == "python"
    assert result["time"] == "day"
    assert result["count"] == 1
    assert result["after"] is None

    post = result["posts"][0]
    assert post["id"] == "top001"
    assert post["title"] == "Top Post"
    assert post["score"] == 5000
    assert post["link_flair_text"] == "Tutorial"


@responses.activate
def test_get_top_posts_week_period():
    """get_top_posts passes time period correctly."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/all/top\.json"),
        json=_TOP_LISTING,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_top_posts(client, "all", "week", 10)

    assert result["time"] == "week"
    assert result["count"] == 1


@responses.activate
def test_get_top_posts_empty():
    """get_top_posts returns empty list when no posts found."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/emptysub/top\.json"),
        json={"kind": "Listing", "data": {"children": [], "after": None, "before": None}},
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_top_posts(client, "emptysub", "all", 25)

    assert result["count"] == 0
    assert result["posts"] == []
