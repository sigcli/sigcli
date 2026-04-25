"""Tests for youtube/scripts/youtube_comments.py"""

import re

import responses

from test_helpers import load_script

mod = load_script("youtube", "youtube_comments")
client_mod = load_script("youtube", "youtube_client")

_NEXT_RESPONSE = {
    "contents": {
        "twoColumnWatchNextResults": {
            "results": {
                "results": {
                    "contents": [
                        {
                            "itemSectionRenderer": {
                                "targetId": "comments-section",
                                "contents": [
                                    {
                                        "continuationItemRenderer": {
                                            "continuationEndpoint": {
                                                "continuationCommand": {
                                                    "token": "EgtoYXNoX2NvbW1lbnQ"
                                                }
                                            }
                                        }
                                    }
                                ],
                            }
                        }
                    ]
                }
            }
        }
    }
}

_COMMENTS_RESPONSE = {
    "frameworkUpdates": {
        "entityBatchUpdate": {
            "mutations": [
                {
                    "payload": {
                        "commentEntityPayload": {
                            "properties": {
                                "content": {"content": "Great video!"},
                                "publishedTime": "2 days ago",
                            },
                            "author": {"displayName": "User1"},
                            "toolbar": {"likeCountNotliked": "42", "replyCount": "5"},
                        }
                    }
                },
                {
                    "payload": {
                        "commentEntityPayload": {
                            "properties": {
                                "content": {"content": "Very informative"},
                                "publishedTime": "1 week ago",
                            },
                            "author": {"displayName": "User2"},
                            "toolbar": {"likeCountNotliked": "10", "replyCount": "0"},
                        }
                    }
                },
            ]
        }
    }
}


@responses.activate
def test_get_comments_returns_formatted_list():
    """get_comments returns correctly formatted comment list."""
    responses.post(url=re.compile(r"https://www\.youtube\.com/youtubei/v1/next"), json=_NEXT_RESPONSE, status=200)
    responses.post(url=re.compile(r"https://www\.youtube\.com/youtubei/v1/next"), json=_COMMENTS_RESPONSE, status=200)

    client = client_mod.YouTubeClient()
    result = mod.get_comments(client, "dQw4w9WgXcQ")

    assert result["videoId"] == "dQw4w9WgXcQ"
    assert result["count"] == 2
    assert len(result["comments"]) == 2

    c1 = result["comments"][0]
    assert c1["author"] == "User1"
    assert c1["text"] == "Great video!"
    assert c1["likes"] == "42"
    assert c1["replyCount"] == "5"


@responses.activate
def test_get_comments_disabled():
    """get_comments handles disabled comments gracefully."""
    no_comments = {
        "contents": {
            "twoColumnWatchNextResults": {
                "results": {"results": {"contents": []}}
            }
        }
    }
    responses.post(url=re.compile(r"https://www\.youtube\.com/youtubei/v1/next"), json=no_comments, status=200)

    client = client_mod.YouTubeClient()
    result = mod.get_comments(client, "abc123")

    assert result["count"] == 0
    assert result["comments"] == []
    assert "disabled" in result.get("message", "").lower()


@responses.activate
def test_get_comments_respects_limit():
    """get_comments respects the limit parameter."""
    responses.post(url=re.compile(r"https://www\.youtube\.com/youtubei/v1/next"), json=_NEXT_RESPONSE, status=200)
    responses.post(url=re.compile(r"https://www\.youtube\.com/youtubei/v1/next"), json=_COMMENTS_RESPONSE, status=200)

    client = client_mod.YouTubeClient()
    result = mod.get_comments(client, "dQw4w9WgXcQ", limit=1)

    assert result["count"] == 1
    assert len(result["comments"]) == 1
