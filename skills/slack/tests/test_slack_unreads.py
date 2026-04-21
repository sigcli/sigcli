"""Tests for slack/scripts/slack_unreads.py"""

import responses

from test_helpers import load_script

mod = load_script("slack", "slack_unreads")
client_mod = load_script("slack", "slack_client")


def _setup_unreads_mocks():
    """Register the standard mock sequence for get_unreads.

    1. users.prefs.get  -> muted_channels = "C999"
    2. client.counts    -> one unread channel C1, one unread DM D1
    3. conversations.info for C1 -> #general
    4. conversations.info for D1 -> DM with U2
    """
    # 1. Muted channels
    responses.post(
        "https://slack.com/api/users.prefs.get",
        json={
            "ok": True,
            "prefs": {"muted_channels": "C999"},
        },
    )

    # 2. client.counts (via webclient_call -> workspace URL)
    responses.post(
        "https://test.slack.com/api/client.counts",
        json={
            "ok": True,
            "channels": [
                {
                    "id": "C1",
                    "has_unreads": True,
                    "mention_count": 2,
                    "last_read": "100.0",
                    "latest": "200.0",
                },
            ],
            "mpims": [],
            "ims": [
                {
                    "id": "D1",
                    "has_unreads": True,
                    "mention_count": 1,
                    "last_read": "150.0",
                    "latest": "250.0",
                },
            ],
        },
    )

    # 3. conversations.info for C1
    responses.post(
        "https://slack.com/api/conversations.info",
        json={
            "ok": True,
            "channel": {"name": "general", "is_im": False},
        },
    )

    # 4. conversations.info for D1
    responses.post(
        "https://slack.com/api/conversations.info",
        json={
            "ok": True,
            "channel": {"name": "", "is_im": True, "user": "U2"},
        },
    )


def _make_client():
    """Create a SlackClient with pre-set workspace URL to skip auth.test."""
    client = client_mod.SlackClient("xoxc-fake", "xoxd-fake")
    client._workspace_url = "https://test.slack.com/"
    return client


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@responses.activate
def test_get_unreads_summary_only():
    """summary_only=True returns counts without message backfill."""
    _setup_unreads_mocks()
    client = _make_client()

    result = mod.get_unreads(
        client,
        type_filter="all",
        max_channels=50,
        max_messages=10,
        mentions_only=False,
        summary_only=True,
    )

    assert result["unread_count"] == 2
    assert result["mention_count"] == 3  # 2 from C1 + 1 from D1

    # Channels should have names resolved
    names = {ch["name"] for ch in result["channels"]}
    assert "#general" in names
    assert "@U2" in names

    # summary_only means no messages backfilled
    for ch in result["channels"]:
        assert ch["messages"] is None
        assert ch["unread_count"] is None


@responses.activate
def test_get_unreads_excludes_muted():
    """Muted channel C999 should not appear in results."""
    # Add C999 as a channel with unreads in client.counts
    responses.post(
        "https://slack.com/api/users.prefs.get",
        json={
            "ok": True,
            "prefs": {"muted_channels": "C999"},
        },
    )
    responses.post(
        "https://test.slack.com/api/client.counts",
        json={
            "ok": True,
            "channels": [
                {
                    "id": "C999",
                    "has_unreads": True,
                    "mention_count": 5,
                    "last_read": "10.0",
                    "latest": "20.0",
                },
                {
                    "id": "C1",
                    "has_unreads": True,
                    "mention_count": 1,
                    "last_read": "100.0",
                    "latest": "200.0",
                },
            ],
            "mpims": [],
            "ims": [],
        },
    )
    responses.post(
        "https://slack.com/api/conversations.info",
        json={
            "ok": True,
            "channel": {"name": "general", "is_im": False},
        },
    )

    client = _make_client()
    result = mod.get_unreads(
        client,
        type_filter="all",
        max_channels=50,
        max_messages=10,
        mentions_only=False,
        summary_only=True,
    )

    channel_ids = {ch["id"] for ch in result["channels"]}
    assert "C999" not in channel_ids
    assert "C1" in channel_ids
    assert result["unread_count"] == 1


@responses.activate
def test_get_unreads_mentions_only_filter():
    """mentions_only=True excludes channels with zero mentions."""
    responses.post(
        "https://slack.com/api/users.prefs.get",
        json={"ok": True, "prefs": {"muted_channels": ""}},
    )
    responses.post(
        "https://test.slack.com/api/client.counts",
        json={
            "ok": True,
            "channels": [
                {
                    "id": "C1",
                    "has_unreads": True,
                    "mention_count": 3,
                    "last_read": "100.0",
                    "latest": "200.0",
                },
                {
                    "id": "C2",
                    "has_unreads": True,
                    "mention_count": 0,
                    "last_read": "100.0",
                    "latest": "200.0",
                },
            ],
            "mpims": [],
            "ims": [],
        },
    )
    # Only C1 passes the filter, so only one conversations.info call
    responses.post(
        "https://slack.com/api/conversations.info",
        json={
            "ok": True,
            "channel": {"name": "alerts", "is_im": False},
        },
    )

    client = _make_client()
    result = mod.get_unreads(
        client,
        type_filter="all",
        max_channels=50,
        max_messages=10,
        mentions_only=True,
        summary_only=True,
    )

    assert result["unread_count"] == 1
    assert result["channels"][0]["id"] == "C1"
    assert result["channels"][0]["name"] == "#alerts"
    assert result["mention_count"] == 3


@responses.activate
def test_get_unreads_type_filter_dm():
    """type_filter='dm' returns only DM channels."""
    _setup_unreads_mocks()
    client = _make_client()

    result = mod.get_unreads(
        client,
        type_filter="dm",
        max_channels=50,
        max_messages=10,
        mentions_only=False,
        summary_only=True,
    )

    assert result["unread_count"] == 1
    assert result["channels"][0]["id"] == "D1"
    assert result["channels"][0]["type"] == "dm"


@responses.activate
def test_get_unreads_sorted_by_mentions_then_latest():
    """Results are sorted by mention_count desc, then latest desc."""
    responses.post(
        "https://slack.com/api/users.prefs.get",
        json={"ok": True, "prefs": {"muted_channels": ""}},
    )
    responses.post(
        "https://test.slack.com/api/client.counts",
        json={
            "ok": True,
            "channels": [
                {
                    "id": "C1",
                    "has_unreads": True,
                    "mention_count": 0,
                    "last_read": "100.0",
                    "latest": "300.0",
                },
                {
                    "id": "C2",
                    "has_unreads": True,
                    "mention_count": 5,
                    "last_read": "100.0",
                    "latest": "200.0",
                },
                {
                    "id": "C3",
                    "has_unreads": True,
                    "mention_count": 5,
                    "last_read": "100.0",
                    "latest": "400.0",
                },
            ],
            "mpims": [],
            "ims": [],
        },
    )
    # Three conversations.info calls (sorted order: C3, C2, C1)
    responses.post(
        "https://slack.com/api/conversations.info",
        json={"ok": True, "channel": {"name": "high-latest", "is_im": False}},
    )
    responses.post(
        "https://slack.com/api/conversations.info",
        json={"ok": True, "channel": {"name": "low-latest", "is_im": False}},
    )
    responses.post(
        "https://slack.com/api/conversations.info",
        json={"ok": True, "channel": {"name": "no-mentions", "is_im": False}},
    )

    client = _make_client()
    result = mod.get_unreads(
        client,
        type_filter="all",
        max_channels=50,
        max_messages=10,
        mentions_only=False,
        summary_only=True,
    )

    ids = [ch["id"] for ch in result["channels"]]
    # C3 (5 mentions, latest 400) > C2 (5 mentions, latest 200) > C1 (0 mentions)
    assert ids == ["C3", "C2", "C1"]
