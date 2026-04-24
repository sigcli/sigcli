"""Tests for reddit/scripts/reddit_hot.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_hot")
client_mod = load_script("reddit", "reddit_client")

# Reusable mock listing payload
_HOT_LISTING = {
    "kind": "Listing",
    "data": {
        "children": [
            {
                "kind": "t3",
                "data": {
                    "id": "abc123",
                    "title": "Test Post",
                    "author": "testuser",
                    "subreddit": "programming",
                    "score": 100,
                    "upvote_ratio": 0.95,
                    "num_comments": 42,
                    "created_utc": 1700000000,
                    "url": "https://example.com",
                    "permalink": "/r/programming/comments/abc123/test_post/",
                    "selftext": "",
                    "is_self": False,
                    "thumbnail": "https://example.com/thumb.jpg",
                    "link_flair_text": "Discussion",
                    "over_18": False,
                },
            },
            {
                "kind": "t3",
                "data": {
                    "id": "def456",
                    "title": "Another Post",
                    "author": "user2",
                    "subreddit": "programming",
                    "score": 50,
                    "upvote_ratio": 0.88,
                    "num_comments": 10,
                    "created_utc": 1700001000,
                    "url": "https://example2.com",
                    "permalink": "/r/programming/comments/def456/another_post/",
                    "selftext": "Some text",
                    "is_self": True,
                    "thumbnail": "self",
                    "link_flair_text": None,
                    "over_18": False,
                },
            },
        ],
        "after": "t3_def456",
        "before": None,
    },
}


@responses.activate
def test_get_hot_posts_returns_formatted_list():
    """get_hot_posts returns correctly formatted post list."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/programming/hot\.json"),
        json=_HOT_LISTING,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_hot_posts(client, "programming", 25)

    assert result["subreddit"] == "programming"
    assert result["count"] == 2
    assert result["after"] == "t3_def456"
    assert len(result["posts"]) == 2

    post1 = result["posts"][0]
    assert post1["id"] == "abc123"
    assert post1["title"] == "Test Post"
    assert post1["author"] == "testuser"
    assert post1["score"] == 100
    assert post1["num_comments"] == 42


@responses.activate
def test_get_hot_posts_empty_subreddit():
    """get_hot_posts returns empty list for subreddit with no posts."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/emptysub/hot\.json"),
        json={"kind": "Listing", "data": {"children": [], "after": None, "before": None}},
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_hot_posts(client, "emptysub", 25)

    assert result["subreddit"] == "emptysub"
    assert result["count"] == 0
    assert result["posts"] == []
    assert result["after"] is None


@responses.activate
def test_get_hot_posts_default_subreddit_all():
    """get_hot_posts works with the default 'all' subreddit."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/r/all/hot\.json"),
        json=_HOT_LISTING,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_hot_posts(client, "all", 10)

    assert result["subreddit"] == "all"
    assert result["count"] == 2
