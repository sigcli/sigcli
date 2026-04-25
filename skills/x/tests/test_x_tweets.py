"""Tests for x/scripts/x_tweets.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_tweets")
client_mod = load_script("x", "x_client")

_USER_BY_SCREEN_NAME = {
    "data": {
        "user": {
            "result": {
                "rest_id": "44196397",
                "legacy": {"screen_name": "testuser"},
            },
        },
    },
}

_USER_TWEETS = {
    "data": {
        "user": {
            "result": {
                "timeline_v2": {
                    "timeline": {
                        "instructions": [
                            {
                                "type": "TimelineAddEntries",
                                "entries": [
                                    {
                                        "entryId": "tweet-1",
                                        "content": {
                                            "itemContent": {
                                                "tweet_results": {
                                                    "result": {
                                                        "rest_id": "111",
                                                        "core": {
                                                            "user_results": {
                                                                "result": {
                                                                    "legacy": {"screen_name": "testuser", "name": "Test User"},
                                                                },
                                                            },
                                                        },
                                                        "legacy": {
                                                            "full_text": "Hello world",
                                                            "favorite_count": 10,
                                                            "retweet_count": 2,
                                                            "reply_count": 1,
                                                            "created_at": "Mon Jan 01 12:00:00 +0000 2024",
                                                        },
                                                        "views": {"count": "500"},
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    {
                                        "entryId": "tweet-2",
                                        "content": {
                                            "itemContent": {
                                                "tweet_results": {
                                                    "result": {
                                                        "rest_id": "222",
                                                        "core": {
                                                            "user_results": {
                                                                "result": {
                                                                    "legacy": {"screen_name": "testuser", "name": "Test User"},
                                                                },
                                                            },
                                                        },
                                                        "legacy": {
                                                            "full_text": "Second tweet",
                                                            "favorite_count": 5,
                                                            "retweet_count": 0,
                                                            "reply_count": 0,
                                                            "created_at": "Mon Jan 02 12:00:00 +0000 2024",
                                                        },
                                                        "views": {"count": "100"},
                                                    },
                                                },
                                            },
                                        },
                                    },
                                    {
                                        "entryId": "cursor-bottom-abc",
                                        "content": {"value": "cursor-abc-123"},
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
        },
    },
}


@responses.activate
def test_get_user_tweets_returns_list():
    """get_user_tweets returns formatted tweet list."""
    responses.get(url=re.compile(r".+/UserByScreenName"), json=_USER_BY_SCREEN_NAME, status=200)
    responses.get(url=re.compile(r".+/UserTweets"), json=_USER_TWEETS, status=200)
    client = client_mod.XClient()
    result = mod.get_user_tweets(client, "testuser", limit=20)
    assert result["username"] == "testuser"
    assert result["user_id"] == "44196397"
    assert result["count"] == 2
    assert len(result["tweets"]) == 2
    assert result["tweets"][0]["text"] == "Hello world"
    assert result["tweets"][0]["likes"] == 10
    assert result["tweets"][1]["text"] == "Second tweet"


@responses.activate
def test_get_user_tweets_empty():
    """get_user_tweets handles users with no tweets."""
    empty_timeline = {
        "data": {
            "user": {
                "result": {
                    "timeline_v2": {
                        "timeline": {
                            "instructions": [{"type": "TimelineAddEntries", "entries": []}],
                        },
                    },
                },
            },
        },
    }
    responses.get(url=re.compile(r".+/UserByScreenName"), json=_USER_BY_SCREEN_NAME, status=200)
    responses.get(url=re.compile(r".+/UserTweets"), json=empty_timeline, status=200)
    client = client_mod.XClient()
    result = mod.get_user_tweets(client, "testuser", limit=20)
    assert result["count"] == 0
    assert result["tweets"] == []


@responses.activate
def test_get_user_tweets_respects_limit():
    """get_user_tweets respects the limit parameter."""
    responses.get(url=re.compile(r".+/UserByScreenName"), json=_USER_BY_SCREEN_NAME, status=200)
    responses.get(url=re.compile(r".+/UserTweets"), json=_USER_TWEETS, status=200)
    client = client_mod.XClient()
    result = mod.get_user_tweets(client, "testuser", limit=1)
    assert result["count"] == 1
    assert len(result["tweets"]) == 1
