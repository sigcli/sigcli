"""Tests for x/scripts/x_tweet.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_tweet")
client_mod = load_script("x", "x_client")

_TWEET_DETAIL = {
    "data": {
        "threaded_conversation_with_injections_v2": {
            "instructions": [
                {
                    "type": "TimelineAddEntries",
                    "entries": [
                        {
                            "entryId": "tweet-999",
                            "content": {
                                "itemContent": {
                                    "tweet_results": {
                                        "result": {
                                            "rest_id": "999",
                                            "core": {
                                                "user_results": {
                                                    "result": {
                                                        "legacy": {"screen_name": "author1", "name": "Author One"},
                                                    },
                                                },
                                            },
                                            "legacy": {
                                                "full_text": "Original tweet",
                                                "favorite_count": 100,
                                                "retweet_count": 20,
                                                "reply_count": 5,
                                                "created_at": "Mon Jan 01 12:00:00 +0000 2024",
                                            },
                                            "views": {"count": "5000"},
                                        },
                                    },
                                },
                            },
                        },
                        {
                            "entryId": "conversationthread-999",
                            "content": {
                                "items": [
                                    {
                                        "item": {
                                            "itemContent": {
                                                "tweet_results": {
                                                    "result": {
                                                        "rest_id": "1000",
                                                        "core": {
                                                            "user_results": {
                                                                "result": {
                                                                    "legacy": {"screen_name": "replier", "name": "Replier"},
                                                                },
                                                            },
                                                        },
                                                        "legacy": {
                                                            "full_text": "Great tweet!",
                                                            "favorite_count": 5,
                                                            "retweet_count": 0,
                                                            "reply_count": 0,
                                                            "in_reply_to_status_id_str": "999",
                                                            "created_at": "Mon Jan 01 13:00:00 +0000 2024",
                                                        },
                                                        "views": {"count": "200"},
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    ],
                },
            ],
        },
    },
}


@responses.activate
def test_get_tweet_returns_thread():
    """get_tweet returns the tweet and its replies."""
    responses.get(url=re.compile(r".+/TweetDetail"), json=_TWEET_DETAIL, status=200)
    client = client_mod.XClient()
    result = mod.get_tweet(client, "999", limit=50)
    assert result["tweet_id"] == "999"
    assert result["count"] == 2
    assert result["tweets"][0]["text"] == "Original tweet"
    assert result["tweets"][0]["likes"] == 100
    assert result["tweets"][1]["text"] == "Great tweet!"
    assert result["tweets"][1]["in_reply_to"] == "999"


@responses.activate
def test_get_tweet_single():
    """get_tweet works with a single tweet and no replies."""
    single = {
        "data": {
            "threaded_conversation_with_injections_v2": {
                "instructions": [
                    {
                        "type": "TimelineAddEntries",
                        "entries": [
                            {
                                "entryId": "tweet-555",
                                "content": {
                                    "itemContent": {
                                        "tweet_results": {
                                            "result": {
                                                "rest_id": "555",
                                                "core": {
                                                    "user_results": {
                                                        "result": {"legacy": {"screen_name": "solo", "name": "Solo"}},
                                                    },
                                                },
                                                "legacy": {
                                                    "full_text": "Just a tweet",
                                                    "favorite_count": 1,
                                                    "retweet_count": 0,
                                                    "reply_count": 0,
                                                    "created_at": "Tue Jan 02 10:00:00 +0000 2024",
                                                },
                                                "views": {"count": "50"},
                                            },
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        },
    }
    responses.get(url=re.compile(r".+/TweetDetail"), json=single, status=200)
    client = client_mod.XClient()
    result = mod.get_tweet(client, "555")
    assert result["count"] == 1
    assert result["tweets"][0]["id"] == "555"


@responses.activate
def test_get_tweet_from_url():
    """resolve_tweet_id extracts ID from a full URL."""
    assert client_mod.resolve_tweet_id("https://x.com/user/status/12345") == "12345"
    assert client_mod.resolve_tweet_id("12345") == "12345"
