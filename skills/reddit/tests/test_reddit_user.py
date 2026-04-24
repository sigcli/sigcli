"""Tests for reddit/scripts/reddit_user.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("reddit", "reddit_user")
client_mod = load_script("reddit", "reddit_client")

_USER_ABOUT = {
    "kind": "t2",
    "data": {
        "name": "testuser",
        "link_karma": 10000,
        "comment_karma": 25000,
        "created_utc": 1500000000,
        "is_gold": True,
        "icon_img": "https://example.com/icon.png",
    },
}

_USER_POSTS = {
    "kind": "Listing",
    "data": {
        "children": [
            {
                "kind": "t3",
                "data": {
                    "id": "up001",
                    "title": "My Post",
                    "author": "testuser",
                    "subreddit": "python",
                    "score": 50,
                    "upvote_ratio": 0.9,
                    "num_comments": 5,
                    "created_utc": 1700000000,
                    "url": "https://example.com",
                    "permalink": "/r/python/comments/up001/my_post/",
                    "selftext": "Post content",
                    "is_self": True,
                    "thumbnail": "self",
                    "link_flair_text": None,
                    "over_18": False,
                },
            },
        ],
        "after": None,
    },
}

_USER_COMMENTS = {
    "kind": "Listing",
    "data": {
        "children": [
            {
                "kind": "t1",
                "data": {
                    "id": "uc001",
                    "author": "testuser",
                    "body": "Great discussion!",
                    "score": 15,
                    "created_utc": 1700001000,
                    "permalink": "/r/python/comments/abc/test/uc001/",
                    "replies": "",
                },
            },
        ],
        "after": None,
    },
}


@responses.activate
def test_get_user_profile_only():
    """get_user returns profile without posts or comments by default."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/user/testuser/about\.json"),
        json=_USER_ABOUT,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_user(client, "testuser", False, False)

    assert result["user"]["name"] == "testuser"
    assert result["user"]["link_karma"] == 10000
    assert result["user"]["comment_karma"] == 25000
    assert result["user"]["is_gold"] is True
    assert "posts" not in result
    assert "comments" not in result


@responses.activate
def test_get_user_with_posts():
    """get_user includes posts when include_posts is True."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/user/testuser/about\.json"),
        json=_USER_ABOUT,
        status=200,
    )
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/user/testuser/submitted\.json"),
        json=_USER_POSTS,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_user(client, "testuser", True, False)

    assert result["user"]["name"] == "testuser"
    assert len(result["posts"]) == 1
    assert result["posts"][0]["id"] == "up001"
    assert result["posts"][0]["title"] == "My Post"
    assert "comments" not in result


@responses.activate
def test_get_user_with_comments():
    """get_user includes comments when include_comments is True."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/user/testuser/about\.json"),
        json=_USER_ABOUT,
        status=200,
    )
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/user/testuser/comments\.json"),
        json=_USER_COMMENTS,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_user(client, "testuser", False, True)

    assert result["user"]["name"] == "testuser"
    assert "posts" not in result
    assert len(result["comments"]) == 1
    assert result["comments"][0]["id"] == "uc001"
    assert result["comments"][0]["body"] == "Great discussion!"


@responses.activate
def test_get_user_with_posts_and_comments():
    """get_user includes both posts and comments when both flags are set."""
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/user/testuser/about\.json"),
        json=_USER_ABOUT,
        status=200,
    )
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/user/testuser/submitted\.json"),
        json=_USER_POSTS,
        status=200,
    )
    responses.get(
        url=re.compile(r"https://www\.reddit\.com/user/testuser/comments\.json"),
        json=_USER_COMMENTS,
        status=200,
    )

    client = client_mod.RedditClient()
    result = mod.get_user(client, "testuser", True, True)

    assert result["user"]["name"] == "testuser"
    assert len(result["posts"]) == 1
    assert len(result["comments"]) == 1
