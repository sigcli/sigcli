"""Tests for x/scripts/x_search.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("x", "x_search")
client_mod = load_script("x", "x_client")

_SEARCH_RESPONSE = {
    "data": {
        "search_by_raw_query": {
            "search_timeline": {
                "timeline": {
                    "instructions": [
                        {
                            "type": "TimelineAddEntries",
                            "entries": [
                                {
                                    "entryId": "tweet-100",
                                    "content": {
                                        "itemContent": {
                                            "tweet_results": {
                                                "result": {
                                                    "rest_id": "100",
                                                    "core": {
                                                        "user_results": {
                                                            "result": {
                                                                "legacy": {"screen_name": "dev1", "name": "Dev One"},
                                                            },
                                                        },
                                                    },
                                                    "legacy": {
                                                        "full_text": "Claude is amazing for coding",
                                                        "favorite_count": 50,
                                                        "retweet_count": 10,
                                                        "reply_count": 3,
                                                        "created_at": "Mon Jan 01 12:00:00 +0000 2024",
                                                    },
                                                    "views": {"count": "1000"},
                                                },
                                            },
                                        },
                                    },
                                },
                                {
                                    "entryId": "tweet-200",
                                    "content": {
                                        "itemContent": {
                                            "tweet_results": {
                                                "result": {
                                                    "rest_id": "200",
                                                    "core": {
                                                        "user_results": {
                                                            "result": {
                                                                "legacy": {"screen_name": "dev2", "name": "Dev Two"},
                                                            },
                                                        },
                                                    },
                                                    "legacy": {
                                                        "full_text": "AI coding assistants are the future",
                                                        "favorite_count": 25,
                                                        "retweet_count": 5,
                                                        "reply_count": 1,
                                                        "created_at": "Tue Jan 02 12:00:00 +0000 2024",
                                                    },
                                                    "views": {"count": "500"},
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
        },
    },
}


@responses.activate
def test_search_tweets_returns_results():
    """search_tweets returns formatted search results."""
    responses.get(url=re.compile(r".+/SearchTimeline"), json=_SEARCH_RESPONSE, status=200)
    client = client_mod.XClient()
    result = mod.search_tweets(client, "claude code", limit=20)
    assert result["query"] == "claude code"
    assert result["product"] == "Latest"
    assert result["count"] == 2
    assert result["tweets"][0]["text"] == "Claude is amazing for coding"
    assert result["tweets"][0]["author"] == "dev1"


@responses.activate
def test_search_tweets_empty():
    """search_tweets returns empty for no results."""
    empty = {"data": {"search_by_raw_query": {"search_timeline": {"timeline": {"instructions": []}}}}}
    responses.get(url=re.compile(r".+/SearchTimeline"), json=empty, status=200)
    client = client_mod.XClient()
    result = mod.search_tweets(client, "xyznonexistent", limit=20)
    assert result["count"] == 0
    assert result["tweets"] == []


@responses.activate
def test_search_tweets_respects_limit():
    """search_tweets respects the limit parameter."""
    responses.get(url=re.compile(r".+/SearchTimeline"), json=_SEARCH_RESPONSE, status=200)
    client = client_mod.XClient()
    result = mod.search_tweets(client, "claude", limit=1)
    assert result["count"] == 1
    assert len(result["tweets"]) == 1
