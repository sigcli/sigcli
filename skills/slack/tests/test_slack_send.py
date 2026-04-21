"""Tests for slack/scripts/slack_send.py"""

import responses

from test_helpers import load_script

mod = load_script("slack", "slack_send")
client_mod = load_script("slack", "slack_client")


@responses.activate
def test_send_message_success():
    """send_message sends correctly and returns success dict."""
    responses.post(
        "https://slack.com/api/chat.postMessage",
        json={"ok": True, "channel": "C123", "ts": "123.456"},
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.send_message(client, "C123", "Hello world", None, "text/markdown")

    assert result["success"] is True
    assert result["channel"] == "C123"
    assert result["ts"] == "123.456"
    assert result["message"] == "Message sent"

    # Verify the request was made correctly
    assert len(responses.calls) == 1
    body = responses.calls[0].request.body
    assert "Hello+world" in body or "Hello%20world" in body or "Hello world" in body


@responses.activate
def test_send_message_with_thread_ts():
    """send_message with thread_ts sends a threaded reply."""
    responses.post(
        "https://slack.com/api/chat.postMessage",
        json={"ok": True, "channel": "C123", "ts": "999.888"},
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.send_message(client, "C123", "Threaded reply", "123.456", "text/plain")

    assert result["success"] is True
    assert result["channel"] == "C123"
    assert result["ts"] == "999.888"

    # Verify thread_ts was included in the request
    assert len(responses.calls) == 1
    body = responses.calls[0].request.body
    assert "thread_ts=123.456" in body
