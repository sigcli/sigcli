"""Tests for slack/scripts/slack_reactions.py"""

import responses

from test_helpers import load_script

mod = load_script("slack", "slack_reactions")
client_mod = load_script("slack", "slack_client")


@responses.activate
def test_manage_reaction_add():
    """manage_reaction with action 'add' calls reactions.add."""
    responses.post(
        "https://slack.com/api/reactions.add",
        json={"ok": True},
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.manage_reaction(client, "add", "C123", "1234567890.123456", "thumbsup")

    assert result["success"] is True
    assert result["action"] == "add"
    assert result["channel"] == "C123"
    assert result["timestamp"] == "1234567890.123456"
    assert result["emoji"] == "thumbsup"

    # Verify the correct API endpoint was called
    assert len(responses.calls) == 1
    assert responses.calls[0].request.url == "https://slack.com/api/reactions.add"
    assert "thumbsup" in responses.calls[0].request.body


@responses.activate
def test_manage_reaction_remove():
    """manage_reaction with action 'remove' calls reactions.remove."""
    responses.post(
        "https://slack.com/api/reactions.remove",
        json={"ok": True},
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.manage_reaction(client, "remove", "C123", "1234567890.123456", "thumbsup")

    assert result["success"] is True
    assert result["action"] == "remove"
    assert result["channel"] == "C123"
    assert result["timestamp"] == "1234567890.123456"
    assert result["emoji"] == "thumbsup"

    # Verify the correct API endpoint was called
    assert len(responses.calls) == 1
    assert responses.calls[0].request.url == "https://slack.com/api/reactions.remove"
    assert "thumbsup" in responses.calls[0].request.body
