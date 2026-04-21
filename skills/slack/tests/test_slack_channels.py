"""Tests for slack/scripts/slack_channels.py"""

import responses

from test_helpers import load_script

mod = load_script("slack", "slack_channels")
client_mod = load_script("slack", "slack_client")


@responses.activate
def test_list_channels_returns_formatted_list():
    """list_channels returns correctly formatted channel list."""
    responses.post(
        "https://slack.com/api/conversations.list",
        json={
            "ok": True,
            "channels": [
                {
                    "id": "C001",
                    "name": "general",
                    "is_private": False,
                    "num_members": 120,
                    "topic": {"value": "Company-wide"},
                    "purpose": {"value": "General discussion"},
                },
                {
                    "id": "C002",
                    "name": "random",
                    "is_private": False,
                    "num_members": 85,
                    "topic": {"value": "Random stuff"},
                    "purpose": {"value": "Non-work banter"},
                },
            ],
            "response_metadata": {"next_cursor": ""},
        },
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.list_channels(client, "public_channel", None, 100, None)

    assert result["count"] == 2
    assert len(result["channels"]) == 2
    assert result["next_cursor"] is None

    ch1 = result["channels"][0]
    assert ch1["id"] == "C001"
    assert ch1["name"] == "general"
    assert ch1["is_private"] is False
    assert ch1["num_members"] == 120
    assert ch1["topic"] == "Company-wide"
    assert ch1["purpose"] == "General discussion"

    ch2 = result["channels"][1]
    assert ch2["id"] == "C002"
    assert ch2["name"] == "random"


@responses.activate
def test_list_channels_popularity_sort():
    """Popularity sort orders channels by num_members descending."""
    responses.post(
        "https://slack.com/api/conversations.list",
        json={
            "ok": True,
            "channels": [
                {"id": "C001", "name": "small", "num_members": 10},
                {"id": "C002", "name": "big", "num_members": 500},
                {"id": "C003", "name": "medium", "num_members": 50},
            ],
            "response_metadata": {"next_cursor": ""},
        },
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.list_channels(client, "public_channel", "popularity", 100, None)

    assert result["count"] == 3
    names = [ch["name"] for ch in result["channels"]]
    assert names == ["big", "medium", "small"]
    members = [ch["num_members"] for ch in result["channels"]]
    assert members == [500, 50, 10]


@responses.activate
def test_list_channels_enterprise_fallback():
    """Falls back to search.modules.channels on enterprise_is_restricted."""
    # conversations.list returns enterprise_is_restricted
    responses.post(
        "https://slack.com/api/conversations.list",
        json={"ok": False, "error": "enterprise_is_restricted"},
        status=200,
    )
    # auth.test for workspace URL
    responses.post(
        "https://slack.com/api/auth.test",
        json={"ok": True, "url": "https://test.slack.com/", "team_id": "T1", "user_id": "U1"},
        status=200,
    )
    # search.modules.channels fallback
    responses.post(
        "https://test.slack.com/api/search.modules.channels",
        json={
            "ok": True,
            "items": [
                {
                    "id": "C001",
                    "name": "general",
                    "is_private": False,
                    "member_count": 120,
                    "topic": {"value": "Company-wide"},
                    "purpose": {"value": "General discussion"},
                },
                {
                    "id": "C002",
                    "name": "random",
                    "is_private": False,
                    "member_count": 85,
                    "topic": {"value": "Random stuff"},
                    "purpose": {"value": "Non-work banter"},
                },
            ],
            "response_metadata": {"next_cursor": ""},
        },
        status=200,
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.list_channels(client, "public_channel", None, 100, None)

    assert result["count"] == 2
    ch1 = result["channels"][0]
    assert ch1["id"] == "C001"
    assert ch1["name"] == "general"
    assert ch1["num_members"] == 120


@responses.activate
def test_list_channels_edge_popularity_sort():
    """Edge fallback sorts by member_count when popularity sort requested."""
    responses.post(
        "https://slack.com/api/conversations.list",
        json={"ok": False, "error": "enterprise_is_restricted"},
        status=200,
    )
    responses.post(
        "https://slack.com/api/auth.test",
        json={"ok": True, "url": "https://test.slack.com/", "team_id": "T1", "user_id": "U1"},
        status=200,
    )
    responses.post(
        "https://test.slack.com/api/search.modules.channels",
        json={
            "ok": True,
            "items": [
                {"id": "C001", "name": "big", "member_count": 500},
                {"id": "C002", "name": "small", "member_count": 10},
            ],
            "response_metadata": {"next_cursor": ""},
        },
        status=200,
    )

    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    result = mod.list_channels(client, "public_channel", "popularity", 100, None)

    # Edge API handles sort server-side, so items come pre-sorted
    assert result["count"] == 2
    assert result["channels"][0]["name"] == "big"
    assert result["channels"][0]["num_members"] == 500
