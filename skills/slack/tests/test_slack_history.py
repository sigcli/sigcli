"""Tests for slack/scripts/slack_history.py"""

import responses

from test_helpers import load_script

mod = load_script("slack", "slack_history")
client_mod = load_script("slack", "slack_client")


@responses.activate
def test_get_history_with_numeric_limit():
    """get_history with a numeric limit fetches the requested number of messages."""
    responses.post(
        "https://slack.com/api/conversations.history",
        json={
            "ok": True,
            "messages": [
                {
                    "ts": "111.000",
                    "user": "U001",
                    "text": "Hello everyone",
                },
                {
                    "ts": "222.000",
                    "user": "U002",
                    "text": "Hi there",
                    "reactions": [{"name": "wave", "count": 3}],
                },
            ],
            "has_more": False,
        },
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.get_history(client, "C123", "10", None, False)

    assert result["channel"] == "C123"
    assert result["count"] == 2
    assert len(result["messages"]) == 2
    assert result["next_cursor"] is None

    msg1 = result["messages"][0]
    assert msg1["ts"] == "111.000"
    assert msg1["user"] == "U001"
    assert msg1["text"] == "Hello everyone"

    msg2 = result["messages"][1]
    assert msg2["ts"] == "222.000"
    assert msg2["reactions"] == [{"name": "wave", "count": 3}]


@responses.activate
def test_get_history_filters_activity_messages():
    """Activity messages (join/leave) are filtered out by default."""
    responses.post(
        "https://slack.com/api/conversations.history",
        json={
            "ok": True,
            "messages": [
                {
                    "ts": "111.000",
                    "user": "U001",
                    "text": "Real message",
                },
                {
                    "ts": "222.000",
                    "user": "U002",
                    "text": "U002 has joined the channel",
                    "subtype": "channel_join",
                },
                {
                    "ts": "333.000",
                    "user": "U003",
                    "text": "Another real message",
                },
            ],
            "has_more": False,
        },
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.get_history(client, "C123", "50", None, False)

    # The channel_join message should be filtered out
    assert result["count"] == 2
    texts = [m["text"] for m in result["messages"]]
    assert "Real message" in texts
    assert "Another real message" in texts
    assert "U002 has joined the channel" not in texts
