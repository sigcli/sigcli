"""Tests for reddit/scripts/reddit_post.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_post")
client_mod = load_script("reddit", "reddit_client")

_POST_RESPONSE = [
    {
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
                        "num_comments": 5,
                        "created_utc": 1700000000,
                        "url": "https://example.com",
                        "permalink": "/r/programming/comments/abc123/test_post/",
                        "selftext": "Hello world",
                        "is_self": True,
                        "thumbnail": "self",
                        "link_flair_text": None,
                        "over_18": False,
                    },
                }
            ],
        },
    },
    {
        "kind": "Listing",
        "data": {
            "children": [
                {
                    "kind": "t1",
                    "data": {
                        "id": "com001",
                        "author": "commenter1",
                        "body": "Great post!",
                        "score": 10,
                        "created_utc": 1700001000,
                        "permalink": "/r/programming/comments/abc123/test_post/com001/",
                        "replies": "",
                    },
                },
                {
                    "kind": "t1",
                    "data": {
                        "id": "com002",
                        "author": "commenter2",
                        "body": "Thanks for sharing",
                        "score": 5,
                        "created_utc": 1700002000,
                        "permalink": "/r/programming/comments/abc123/test_post/com002/",
                        "replies": {
                            "kind": "Listing",
                            "data": {
                                "children": [
                                    {
                                        "kind": "t1",
                                        "data": {
                                            "id": "com003",
                                            "author": "replier",
                                            "body": "You're welcome!",
                                            "score": 3,
                                            "created_utc": 1700003000,
                                            "permalink": "/r/programming/comments/abc123/test_post/com003/",
                                            "replies": "",
                                        },
                                    }
                                ],
                            },
                        },
                    },
                },
            ],
        },
    },
]


@responses.activate
def test_get_post_returns_post_and_comments():
    """get_post returns the post and its comments."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/comments/abc123\.json"),
        json=_POST_RESPONSE,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_post(client, "abc123", 20, "best")

    assert result["post"]["id"] == "abc123"
    assert result["post"]["title"] == "Test Post"
    assert result["post"]["selftext"] == "Hello world"

    assert result["comments"]["count"] == 2
    items = result["comments"]["items"]
    assert items[0]["id"] == "com001"
    assert items[0]["body"] == "Great post!"
    assert items[0]["depth"] == 0
    assert items[0]["replies"] is None

    assert items[1]["id"] == "com002"
    assert items[1]["replies"] is not None
    assert len(items[1]["replies"]) == 1
    assert items[1]["replies"][0]["id"] == "com003"
    assert items[1]["replies"][0]["depth"] == 1


@responses.activate
def test_get_post_no_comments():
    """get_post returns empty comments list when there are none."""
    response = [
        {
            "kind": "Listing",
            "data": {
                "children": [
                    {
                        "kind": "t3",
                        "data": {
                            "id": "xyz789",
                            "title": "No Comments Post",
                            "author": "author",
                            "subreddit": "test",
                            "score": 1,
                            "upvote_ratio": 1.0,
                            "num_comments": 0,
                            "created_utc": 1700000000,
                            "url": "https://example.com",
                            "permalink": "/r/test/comments/xyz789/no_comments/",
                            "selftext": "",
                            "is_self": True,
                            "thumbnail": "self",
                            "link_flair_text": None,
                            "over_18": False,
                        },
                    }
                ],
            },
        },
        {"kind": "Listing", "data": {"children": []}},
    ]

    responses.get(
        url=re.compile(r"https://www\.reddit\.com/comments/xyz789\.json"),
        json=response,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_post(client, "xyz789", 20, "best")

    assert result["post"]["id"] == "xyz789"
    assert result["comments"]["count"] == 0
    assert result["comments"]["items"] == []


@responses.activate
def test_get_post_invalid_response_raises():
    """get_post raises ValueError on unexpected response structure."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/comments/bad\.json"),
        json={"error": "not found"},
        status=200,
    )

    client = client_mod.RedditClient()
    try:
        mod.get_post(client, "bad", 20, "best")
        assert False, "Expected ValueError"
    except ValueError as e:
        assert "Unexpected response" in str(e)
