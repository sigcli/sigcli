"""Tests for slack/scripts/slack_threads.py"""

import responses

from test_helpers import load_script

mod = load_script("slack", "slack_threads")
client_mod = load_script("slack", "slack_client")


@responses.activate
def test_get_thread_returns_formatted_thread():
    """get_thread returns correctly formatted thread with all replies."""
    responses.post(
        "https://slack.com/api/conversations.replies",
        json={
            "ok": True,
            "messages": [
                {
                    "ts": "100.000",
                    "user": "U001",
                    "text": "Parent message",
                    "thread_ts": "100.000",
                    "reply_count": 2,
                },
                {
                    "ts": "200.000",
                    "user": "U002",
                    "text": "First reply",
                    "thread_ts": "100.000",
                },
                {
                    "ts": "300.000",
                    "user": "U003",
                    "text": "Second reply",
                    "thread_ts": "100.000",
                    "reactions": [{"name": "thumbsup", "count": 1}],
                },
            ],
            "has_more": False,
        },
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.get_thread(client, "C123", "100.000", "50", None)

    assert result["channel"] == "C123"
    assert result["thread_ts"] == "100.000"
    assert result["count"] == 3
    assert len(result["messages"]) == 3
    assert result["next_cursor"] is None

    parent = result["messages"][0]
    assert parent["ts"] == "100.000"
    assert parent["user"] == "U001"
    assert parent["text"] == "Parent message"
    assert parent["reply_count"] == 2

    reply1 = result["messages"][1]
    assert reply1["ts"] == "200.000"
    assert reply1["text"] == "First reply"

    reply2 = result["messages"][2]
    assert reply2["ts"] == "300.000"
    assert reply2["text"] == "Second reply"
    assert reply2["reactions"] == [{"name": "thumbsup", "count": 1}]
